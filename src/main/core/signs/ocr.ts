import { spawn } from 'node:child_process'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { LocalizedError } from '../../../shared/i18n/core'
import type { OcrFrame } from './types'

/** 各识别语言对应的 Vision 语言标签；第二个是英文兜底（招牌、界面、品牌常是英文） */
const OCR_LANGS: Record<string, string[]> = {
  ja: ['ja-JP', 'en-US'],
  zh: ['zh-Hans', 'zh-Hant', 'en-US'],
  ko: ['ko-KR', 'en-US'],
  en: ['en-US'],
  de: ['de-DE', 'en-US'],
  fr: ['fr-FR', 'en-US'],
  es: ['es-ES', 'en-US'],
  it: ['it-IT', 'en-US'],
  pt: ['pt-BR', 'en-US'],
  ru: ['ru-RU', 'en-US'],
  uk: ['uk-UA', 'en-US'],
  th: ['th-TH', 'en-US'],
  vi: ['vi-VT', 'en-US'],
  ar: ['ar-SA', 'en-US'],
  tr: ['tr-TR', 'en-US'],
  id: ['id-ID', 'en-US'],
  ms: ['ms-MY', 'en-US'],
  nl: ['nl-NL', 'en-US'],
  pl: ['pl-PL', 'en-US'],
  cs: ['cs-CZ', 'en-US'],
  da: ['da-DK', 'en-US'],
  sv: ['sv-SE', 'en-US'],
  no: ['nb-NO', 'en-US'],
  ro: ['ro-RO', 'en-US']
}

export function ocrLanguagesFor(language: string | undefined): string[] {
  const code = (language ?? '').toLowerCase().split('-')[0]
  return OCR_LANGS[code] ?? ['en-US']
}

export interface ExtractFramesOptions {
  input: string
  outDir: string
  /** 每秒几帧；1 fps 足够，画面文字通常停留一秒以上 */
  fps: number
  /** 缩放到的宽度；960 已够 Vision 读清 1080p 里的字，再大只是慢 */
  width: number
  durationSec: number
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

/** 用 ffmpeg 抽帧成 JPEG（%05d.jpg），返回按序号排好的文件列表 */
export async function extractFrames(ffmpeg: string, opts: ExtractFramesOptions): Promise<string[]> {
  await mkdir(opts.outDir, { recursive: true })
  const expected = Math.max(1, Math.round(opts.durationSec * opts.fps))
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, [
      '-y', '-loglevel', 'error', '-stats',
      '-i', opts.input,
      '-vf', `fps=${opts.fps},scale=${opts.width}:-2`,
      '-q:v', '3',
      join(opts.outDir, '%05d.jpg')
    ])
    const onAbort = (): void => { child.kill() }
    if (opts.signal?.aborted) onAbort()
    else opts.signal?.addEventListener('abort', onAbort, { once: true })
    let tail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      tail = (tail + text).slice(-2000)
      // -stats 会不断刷 "frame=  123 fps=..."
      const m = /frame=\s*(\d+)/g
      let last: RegExpExecArray | null = null
      for (let r = m.exec(text); r; r = m.exec(text)) last = r
      if (last) opts.onProgress?.(Math.min(99, Math.round((Number(last[1]) / expected) * 100)))
    })
    child.on('error', reject)
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (opts.signal?.aborted) reject(new LocalizedError('error.jobCancelled'))
      else if (code === 0) resolve()
      else reject(new Error(`抽帧失败（ffmpeg 退出码 ${code}）\n${tail}`))
    })
  })
  const files = (await readdir(opts.outDir)).filter((f) => f.endsWith('.jpg')).sort()
  opts.onProgress?.(100)
  return files.map((f) => join(opts.outDir, f))
}

/** 跑随包的 vision-ocr（macOS Vision），逐帧返回文本框；帧序号按传入顺序从 0 起 */
export async function runVisionOcr(
  bin: string,
  files: string[],
  langs: string[],
  signal?: AbortSignal
): Promise<OcrFrame[]> {
  if (files.length === 0) return []
  // 命令行参数有长度上限（macOS 约 1MB），一部两小时电影 7200 帧路径可能超，分批喂
  const CHUNK = 1500
  const frames: OcrFrame[] = []
  for (let offset = 0; offset < files.length; offset += CHUNK) {
    const part = files.slice(offset, offset + CHUNK)
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(bin, ['--langs', langs.join(','), ...part])
      const onAbort = (): void => { child.kill() }
      if (signal?.aborted) onAbort()
      else signal?.addEventListener('abort', onAbort, { once: true })
      const chunks: Buffer[] = []
      let err = ''
      child.stdout.on('data', (c: Buffer) => chunks.push(c))
      child.stderr.on('data', (c: Buffer) => { err = (err + c.toString()).slice(-2000) })
      child.on('error', reject)
      child.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort)
        if (signal?.aborted) reject(new LocalizedError('error.jobCancelled'))
        else if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'))
        else reject(new Error(`画面文字识别失败（vision-ocr 退出码 ${code}）\n${err}`))
      })
    })
    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const parsed = JSON.parse(line) as { i: number; boxes: OcrFrame['boxes'] }
      frames.push({ i: offset + parsed.i, boxes: parsed.boxes })
    }
  }
  frames.sort((a, b) => a.i - b.i)
  return frames
}
