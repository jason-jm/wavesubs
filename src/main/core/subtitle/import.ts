import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import type { Cue } from './types'
import { LocalizedError } from '../../../shared/i18n/core'

/** ffmpeg 能解复用的文本字幕格式 + 我们自己解析的 TTML/SBV */
export const SUBTITLE_EXTENSIONS = [
  'srt',
  'ass',
  'ssa',
  'vtt',
  'webvtt',
  'sub',
  'sbv',
  'smi',
  'sami',
  'ttml',
  'dfxp',
  'xml',
  'stl',
  'mpl2',
  'mpl',
  'jss',
  'jacosub',
  'pjs',
  'rt',
  'txt',
  'lrc',
  'aqt',
  'vpl',
  'usf',
  'sup'
] as const

/** 图形字幕：只能 OCR，不能直接转成文本 */
export const BITMAP_SUBTITLE_CODECS = new Set([
  'hdmv_pgs_subtitle',
  'dvd_subtitle',
  'dvb_subtitle',
  'xsub',
  'dvb_teletext'
])

export function isSubtitleFile(path: string): boolean {
  const ext = extname(path).slice(1).toLowerCase()
  return (SUBTITLE_EXTENSIONS as readonly string[]).includes(ext)
}

// ---------------------------------------------------------------- 编码识别

const FALLBACK_ENCODINGS = ['gb18030', 'big5', 'shift_jis', 'euc-kr', 'windows-1252']

/**
 * 最常用的汉字（简繁并列，也覆盖日文常用汉字）。解码正确时命中率很高，
 * 解码错误时几乎命中不到，用来区分 GBK / Big5 / Shift_JIS 这类互相「都能解出汉字」的编码。
 */
const COMMON_CJK = new Set(
  '的一是不了在人有我他这這个個们們中来來上大为為和国國地到以说說时時要就出会會可也你对對生能而子那得于於着下自之年过過发發后後作里用道行所然家种種事成方多经經去法学學如都同现現当當没沒动動面起看定天分还還进進好小部其些主样樣理心她本前开開但因只从從想实實日军軍者意无無力它与與长長把机機十民第公此已工使情明性知全三又关關点點正业業外将將两兩高间間由问問很最重并並物手应應战戰向头頭文体體政美相见見被利什二等产產或新己制身果加西斯月话話合回特代内信表化老给給世位次度门門任常先海通教儿兒'
)

/** 按字符分布给解码结果打分：私用区/替换符说明解码错了，常用汉字与假名说明对了 */
function scoreDecoded(text: string): number {
  let score = 0
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 0xfffd) score -= 20 // 解码失败
    else if (c < 0x80) score += 1 // ASCII
    else if (c >= 0x3040 && c <= 0x30ff) score += 6 // 平假名/片假名：日文强信号
    else if (c >= 0xff61 && c <= 0xff9f) score -= 8 // 半角片假名：几乎只在乱码里出现
    else if (COMMON_CJK.has(ch)) score += 6 // 常用汉字
    else if (c >= 0x4e00 && c <= 0x9fff) score += 1 // 其它汉字
    else if (c >= 0xac00 && c <= 0xd7af) score += 4 // 韩文
    else if (c >= 0x3000 && c <= 0x303f) score += 2 // CJK 标点
    else if (c >= 0xff00 && c <= 0xffef) score += 1 // 其它全角
    else if (c >= 0xe000 && c <= 0xf8ff) score -= 10 // 私用区
    else if (c >= 0x3400 && c <= 0x4dbf) score -= 4 // 扩展 A 区生僻字
    else score -= 2
  }
  return score
}

/** 先认 BOM，再试严格 UTF-8，最后在常见中日韩编码里按得分挑最像的 */
export function decodeSubtitleBuffer(buf: Buffer): { text: string; encoding: string } {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'utf-8' }
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(buf.subarray(2)), encoding: 'utf-16le' }
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(buf.subarray(2)), encoding: 'utf-16be' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf-8' }
  } catch {
    // 不是合法 UTF-8，进入猜测流程
  }
  let best = { text: '', encoding: 'windows-1252', score: -Infinity }
  for (const encoding of FALLBACK_ENCODINGS) {
    try {
      const text = new TextDecoder(encoding).decode(buf)
      const score = scoreDecoded(text)
      if (score > best.score) best = { text, encoding, score }
    } catch {
      // 该编码不可用，跳过
    }
  }
  return { text: best.text, encoding: best.encoding }
}

// ---------------------------------------------------------------- 文本清洗

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' '
}

/** 去掉样式标签（HTML 风格 + ASS 覆写块），保留纯文本与换行 */
export function sanitizeCueText(raw: string): string {
  return raw
    .replace(/\{\\[^}]*\}/g, '') // ASS 覆写块 {\an8}{\pos(..)}
    .replace(/\\[Nnh]/g, '\n') // ASS 换行/硬空格
    .replace(/<br\s*\/?>/gi, '\n') // TTML/SAMI 换行
    .replace(/<[^>]+>/g, '') // 其余标签
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim()
}

// ---------------------------------------------------------------- 解析器

const SRT_TIME =
  /(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})/

function toMs(h: string, m: string, s: string, frac: string): number {
  const ms = Number(frac.padEnd(3, '0').slice(0, 3))
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + ms
}

/** 宽松的 SRT/WebVTT 解析：以时间轴行为锚点，容忍缺失序号与多余空行 */
export function parseSrt(content: string): Cue[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = SRT_TIME.exec(lines[i])
    if (!match) continue
    const startMs = toMs(match[1], match[2], match[3], match[4])
    const endMs = toMs(match[5], match[6], match[7], match[8])
    const buffer: string[] = []
    i += 1
    while (i < lines.length && lines[i].trim() !== '' && !SRT_TIME.test(lines[i])) {
      buffer.push(lines[i])
      i += 1
    }
    if (SRT_TIME.test(lines[i] ?? '')) i -= 1
    const text = sanitizeCueText(buffer.join('\n'))
    if (!text || endMs <= startMs) continue
    cues.push({ index: cues.length + 1, startMs, endMs, text })
  }
  return cues
}

const TTML_CLOCK = /^(\d{1,3}):(\d{2}):(\d{2})(?:[.:](\d{1,3}))?$/
const TTML_OFFSET = /^([\d.]+)(h|m|s|ms|f|t)$/

function parseTtmlTime(value: string, frameRate = 25): number | null {
  const clock = TTML_CLOCK.exec(value)
  if (clock) {
    const frac = clock[4] ?? '0'
    // hh:mm:ss:ff 形式最后一段是帧号
    if (value.split(':').length === 4 && !value.includes('.')) {
      return ((Number(clock[1]) * 60 + Number(clock[2])) * 60 + Number(clock[3])) * 1000 +
        Math.round((Number(frac) / frameRate) * 1000)
    }
    return toMs(clock[1], clock[2], clock[3], frac)
  }
  const offset = TTML_OFFSET.exec(value)
  if (offset) {
    const n = Number(offset[1])
    switch (offset[2]) {
      case 'h': return Math.round(n * 3_600_000)
      case 'm': return Math.round(n * 60_000)
      case 's': return Math.round(n * 1000)
      case 'ms': return Math.round(n)
      case 'f': return Math.round((n / frameRate) * 1000)
      default: return Math.round(n)
    }
  }
  return null
}

/** TTML / DFXP（流媒体常见），ffmpeg 不支持解复用，这里自己解析 */
export function parseTtml(content: string): Cue[] {
  const cues: Cue[] = []
  const frameRateMatch = /ttp:frameRate\s*=\s*"(\d+)"/.exec(content)
  const frameRate = frameRateMatch ? Number(frameRateMatch[1]) : 25
  for (const match of content.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const attrs = match[1]
    const begin = /\bbegin\s*=\s*"([^"]+)"/.exec(attrs)?.[1]
    const endAttr = /\bend\s*=\s*"([^"]+)"/.exec(attrs)?.[1]
    const durAttr = /\bdur\s*=\s*"([^"]+)"/.exec(attrs)?.[1]
    if (!begin) continue
    const startMs = parseTtmlTime(begin, frameRate)
    if (startMs === null) continue
    let endMs: number | null = endAttr ? parseTtmlTime(endAttr, frameRate) : null
    if (endMs === null && durAttr) {
      const dur = parseTtmlTime(durAttr, frameRate)
      if (dur !== null) endMs = startMs + dur
    }
    if (endMs === null || endMs <= startMs) continue
    const text = sanitizeCueText(match[2])
    if (!text) continue
    cues.push({ index: cues.length + 1, startMs, endMs, text })
  }
  return cues
}

const SBV_TIME = /^(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3}),(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})$/

/** SBV（YouTube 导出格式），ffmpeg 同样不支持 */
export function parseSbv(content: string): Cue[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const match = SBV_TIME.exec(lines[i].trim())
    if (!match) continue
    const startMs = toMs(match[1], match[2], match[3], match[4])
    const endMs = toMs(match[5], match[6], match[7], match[8])
    const buffer: string[] = []
    i += 1
    while (i < lines.length && lines[i].trim() !== '') {
      buffer.push(lines[i])
      i += 1
    }
    const text = sanitizeCueText(buffer.join('\n'))
    if (!text || endMs <= startMs) continue
    cues.push({ index: cues.length + 1, startMs, endMs, text })
  }
  return cues
}

// ---------------------------------------------------------------- 载入

async function runFfmpeg(ffmpeg: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args)
    let stderrTail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-3000)
    })
    child.stdout.resume()
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 转换字幕失败（退出码 ${code}）\n${stderrTail}`))
    })
  })
}

export interface LoadedSubtitle {
  cues: Cue[]
  /** 源文件编码，用于界面提示 */
  encoding: string
}

/**
 * 扩展名 → ffmpeg demuxer。自动探测对 SRT/ASS/VTT/SAMI 够用，
 * 但 MicroDVD、MPL2 这类没有特征头的格式必须显式指定。
 */
const DEMUXER_HINTS: Record<string, string[]> = {
  srt: ['srt'],
  ass: ['ass'],
  ssa: ['ass'],
  vtt: ['webvtt'],
  webvtt: ['webvtt'],
  smi: ['sami'],
  sami: ['sami'],
  sub: ['microdvd', 'subviewer', 'subviewer1'],
  mpl: ['mpl2'],
  mpl2: ['mpl2'],
  jss: ['jacosub'],
  jacosub: ['jacosub'],
  pjs: ['pjs'],
  rt: ['realtext'],
  stl: ['stl'],
  vpl: ['vplayer'],
  lrc: ['lrc'],
  aqt: ['aqtitle'],
  txt: ['srt', 'subviewer', 'mpsub', 'vplayer', 'microdvd']
}

/** 用指定 demuxer（或自动探测）转成 SRT；失败或没解出内容返回 null */
async function tryConvert(
  ffmpeg: string,
  srcPath: string,
  outPath: string,
  demuxer?: string
): Promise<Cue[] | null> {
  const args = ['-y', '-v', 'error']
  if (demuxer) args.push('-f', demuxer)
  // MicroDVD 用帧号计时，文件没写帧率时给个电影常见值兜底
  if (demuxer === 'microdvd') args.push('-subfps', '23.976')
  args.push('-i', srcPath, '-f', 'srt', outPath)
  try {
    await runFfmpeg(ffmpeg, args)
    const cues = parseSrt(await readFile(outPath, 'utf8'))
    return cues.length > 0 ? cues : null
  } catch {
    return null
  }
}

/**
 * 读取外部字幕文件。TTML/SBV 自己解析，其余交给 ffmpeg 归一成 SRT，
 * 因此 SubRip / ASS / SSA / WebVTT / SAMI / MicroDVD / SubViewer / MPL2 /
 * VPlayer / JACOsub / RealText / STL / PJS / LRC 等格式都能读。
 */
export async function loadSubtitleFile(ffmpeg: string, path: string): Promise<LoadedSubtitle> {
  const { text, encoding } = decodeSubtitleBuffer(await readFile(path))
  const ext = extname(path).slice(1).toLowerCase()

  if (ext === 'ttml' || ext === 'dfxp' || ext === 'xml') {
    const cues = parseTtml(text)
    if (cues.length > 0) return { cues, encoding }
  }
  if (ext === 'sbv') {
    const cues = parseSbv(text)
    if (cues.length > 0) return { cues, encoding }
  }

  const workDir = await mkdtemp(join(tmpdir(), 'wavesubs-sub-'))
  try {
    // 统一转成 UTF-8 副本再交给 ffmpeg，避免它按系统编码猜错
    const srcPath = join(workDir, `input.${ext || 'srt'}`)
    const outPath = join(workDir, 'normalized.srt')
    await writeFile(srcPath, text, 'utf8')
    // 先让 ffmpeg 自动探测，再按扩展名逐个试显式 demuxer
    for (const demuxer of [undefined, ...(DEMUXER_HINTS[ext] ?? [])]) {
      const cues = await tryConvert(ffmpeg, srcPath, outPath, demuxer)
      if (cues) return { cues, encoding }
    }
    // ffmpeg 全都不认时，按 SRT/VTT 结构兜底
    const fallback = parseSrt(text)
    if (fallback.length > 0) return { cues: fallback, encoding }
    const ttml = parseTtml(text)
    if (ttml.length > 0) return { cues: ttml, encoding }
    throw new LocalizedError('error.subtitleFileEmpty')
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export interface ExtractTrackOptions {
  videoPath: string
  /** 相对序号，对应 ffmpeg 的 0:s:N */
  subtitleIndex: number
  durationSec?: number
  onProgress?: (percent: number) => void
}

/** 从视频容器里抽出指定的内嵌文本字幕轨 */
export async function extractEmbeddedSubtitle(
  ffmpeg: string,
  opts: ExtractTrackOptions
): Promise<Cue[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'wavesubs-track-'))
  const outPath = join(workDir, 'track.srt')
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpeg, [
        '-y',
        '-v', 'error',
        '-progress', 'pipe:1',
        '-i', opts.videoPath,
        '-map', `0:s:${opts.subtitleIndex}`,
        '-f', 'srt',
        outPath
      ])
      let stderrTail = ''
      child.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-3000)
      })
      child.stdout.on('data', (chunk: Buffer) => {
        for (const match of chunk.toString().matchAll(/out_time_(?:us|ms)=(\d+)/g)) {
          const seconds = Number(match[1]) / 1e6
          if (opts.durationSec && opts.durationSec > 0) {
            opts.onProgress?.(Math.min(100, (seconds / opts.durationSec) * 100))
          }
        }
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`抽取字幕轨失败（退出码 ${code}）\n${stderrTail}`))
      })
    })
    const cues = parseSrt(await readFile(outPath, 'utf8'))
    if (cues.length === 0) throw new LocalizedError('error.subtitleTrackEmpty')
    return cues
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
