/**
 * 把逐帧的 OCR 文本框整理成「一段画面文字」：同帧按行分组 → 跨帧跟踪 → 启发式过滤。
 *
 * 全部是几何和统计，不碰模型。三件事必须在这里做而不能交给模型：
 * 1. 片头片尾名单：8B 模型曾把片尾赞助名单 30 条全判成画面文字；职位词密度一扫就干净。
 * 2. 烧录字幕：模型判不准（曾把 37 条聊天气泡当字幕），而烧录字幕在几何上极其规整——
 *    全片固定在下半屏同一条带里、水平居中、与人声重叠。两部真烧录片实测占比 38%/39%，
 *    无烧录的片最高 8%。
 * 3. 置信度与闪现：多帧持续出现本身就是「真有字」的证据，手写体艺术字置信度常年 0.3。
 */
import type { SpeechRegion } from '../asr/vad'
import type { OcrBox, OcrFrame, SignBlock, SignBlocksResult } from './types'

const norm = (s: string): string => s.normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase()

/** 字符二元组 Dice 相似度：短文本够用，比编辑距离快 */
export function textSimilarity(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const grams = (s: string): Map<string, number> => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const ga = grams(na)
  const gb = grams(nb)
  let inter = 0
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0)
  return (2 * inter) / (na.length - 1 + nb.length - 1)
}

/** 至少要有一个字母/汉字/假名：纯数字、纯符号（「60」「¥980」「100%」）不值得单独出一条 */
const HAS_TEXT = /\p{L}/u
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

/** 同一帧里上下相邻（间距 < 0.8 倍行高）且水平重叠的框并成多行一块：一张便签、一段告示只算一条 */
export function groupLines(boxes: OcrBox[]): OcrBox[] {
  const sorted = [...boxes].sort((a, b) => a.y - b.y)
  const groups: OcrBox[][] = []
  for (const b of sorted) {
    const g = groups.find((grp) => {
      const last = grp[grp.length - 1]
      const gap = b.y - (last.y + last.h)
      const xOverlap = Math.min(last.x + last.w, b.x + b.w) - Math.max(last.x, b.x)
      const hRatio = Math.max(b.h, last.h) / Math.max(0.001, Math.min(b.h, last.h))
      return gap > -0.3 * last.h && gap < 0.8 * Math.max(b.h, last.h) && xOverlap > 0.3 * Math.min(b.w, last.w) && hRatio < 2.2
    })
    if (g) g.push(b)
    else groups.push([b])
  }
  return groups.map((g) => {
    if (g.length === 1) return g[0]
    const x = Math.min(...g.map((b) => b.x))
    const y = Math.min(...g.map((b) => b.y))
    const x2 = Math.max(...g.map((b) => b.x + b.w))
    const y2 = Math.max(...g.map((b) => b.y + b.h))
    return { t: g.map((b) => b.t).join('\n'), c: g.reduce((n, b) => n + b.c, 0) / g.length, x, y, w: x2 - x, h: y2 - y }
  })
}

/** 职位词：只有它们算名单信号。全大写、罗马字姓名单独出现时也可能是杂志封面、商标，只用来扩边 */
const CREDIT_VOCAB = /監督|演出|作画|撮影|制作|製作|協力|プロデュース|プロデューサー|脚本|音楽|編集|美術|色彩|原作|音響|録音|効果|仕上|背景|設計|デザイン|キャラクター|アニメーション|主題歌|挿入歌|作詞|作曲|編曲|出演|配給|宣伝|著作|©(?=.{4,})|株式会社|Co\.,? ?Ltd|Inc\.|Executive|Producer|Produced|Director|Animation|Studio|Design|Music|Editor|Photography|Sound|Written|Created|Presents|Production|Cast|Starring|Copyright|Screenplay|Composer|Supervis|Opening Theme|Ending Theme|Theme Song|Lyrics|Arrangement|Vocal|Performed|Original Story|Script|Key Animation|Background Art|Color Design|Recording|Mixing|Assistant|Chief|导演|监制|编剧|摄影|剪辑|美术|配乐|制片|出品|发行|主演|领衔主演|友情出演|演员表|감독|각본|촬영|편집|음악|제작|출연/i
const LATIN_NAME = /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/
const ALLCAPS = /^[A-Z][A-Z .'&-]{3,}$/

/**
 * 名单时段：10 秒滑窗里「含职位词的帧」≥40% 的时段整段算名单（片头名单一次只出一两个名字，
 * 逐帧看很稀疏，得看密度），再把前后只剩姓名的帧吸进来。
 */
export function creditWindows(frames: OcrFrame[], fps: number): Array<[number, number]> {
  if (frames.length === 0) return []
  const roleFrame = new Map<number, boolean>()
  const nameFrame = new Map<number, boolean>()
  for (const f of frames) {
    roleFrame.set(f.i, f.boxes.some((b) => CREDIT_VOCAB.test(b.t)))
    nameFrame.set(f.i, f.boxes.some((b) => LATIN_NAME.test(b.t.trim()) || ALLCAPS.test(b.t.trim())))
  }
  const maxI = Math.max(...frames.map((f) => f.i))
  const win = Math.max(1, Math.round(10 * fps))
  const dense = new Set<number>()
  for (let i = 0; i <= maxI; i += 1) {
    let c = 0
    for (let k = i; k < i + win && k <= maxI; k += 1) if (roleFrame.get(k)) c += 1
    if (c >= 0.3 * win) for (let k = i; k < i + win && k <= maxI; k += 1) dense.add(k)
  }
  for (let pass = 0; pass < 3; pass += 1) {
    for (const i of [...dense]) {
      for (const k of [i - 1, i + 1]) if (k >= 0 && k <= maxI && !dense.has(k) && nameFrame.get(k)) dense.add(k)
    }
  }
  const windows: Array<[number, number]> = []
  let start = -1
  for (let i = 0; i <= maxI + 1; i += 1) {
    if (dense.has(i)) {
      if (start < 0) start = i
    } else if (start >= 0) {
      windows.push([start / fps, i / fps])
      start = -1
    }
  }
  return windows
}

interface Live extends SignBlock {
  lastFrame: number
  occ: OcrBox[]
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * 跨帧跟踪：文本相似（≥0.6）且位置相近的框接到同一块上，两帧没再出现就收工。
 * 文本取「置信度加权出现最多」的写法，框取各维中位数。
 */
export function trackBlocks(frames: OcrFrame[], fps: number): SignBlock[] {
  const live: Live[] = []
  const done: Live[] = []
  let nextId = 1
  for (const fr of frames) {
    const t = fr.i / fps
    const used = new Set<Live>()
    for (const b of fr.boxes) {
      let best: Live | null = null
      let bestScore = 0
      for (const L of live) {
        if (used.has(L) || fr.i - L.lastFrame > 2) continue
        const sim = textSimilarity(L.text, b.t)
        if (sim < 0.6) continue
        const dx = Math.abs(L.box.x + L.box.w / 2 - (b.x + b.w / 2))
        const dy = Math.abs(L.box.y + L.box.h / 2 - (b.y + b.h / 2))
        if (dx > Math.max(0.08, L.box.w) || dy > Math.max(0.05, L.box.h * 2)) continue
        const score = sim - (dx + dy) / 4
        if (score > bestScore) {
          best = L
          bestScore = score
        }
      }
      if (best) {
        best.lastFrame = fr.i
        best.endSec = t + 1 / fps
        best.frames += 1
        best.occ.push(b)
        used.add(best)
      } else {
        const L: Live = {
          id: nextId++, text: b.t, startSec: t, endSec: t + 1 / fps, frames: 1, conf: b.c,
          box: { x: b.x, y: b.y, w: b.w, h: b.h }, lastFrame: fr.i, occ: [b]
        }
        live.push(L)
        used.add(L)
      }
    }
    for (let i = live.length - 1; i >= 0; i -= 1) {
      if (fr.i - live[i].lastFrame > 2) {
        done.push(live[i])
        live.splice(i, 1)
      }
    }
  }
  done.push(...live)
  return done.sort((a, b) => a.startSec - b.startSec).map((L) => {
    const tally = new Map<string, number>()
    for (const o of L.occ) tally.set(o.t, (tally.get(o.t) ?? 0) + o.c)
    const text = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return {
      id: L.id, text, startSec: L.startSec, endSec: L.endSec, frames: L.frames,
      conf: L.occ.reduce((n, o) => n + o.c, 0) / L.occ.length,
      box: { x: median(L.occ.map((o) => o.x)), y: median(L.occ.map((o) => o.y)), w: median(L.occ.map((o) => o.w)), h: median(L.occ.map((o) => o.h)) }
    }
  })
}

/** 整条流水线：分组 → 跟踪 → 名单/置信度/闪现 → 人声重叠 → 烧录字幕带 */
export function buildSignBlocks(
  frames: OcrFrame[],
  fps: number,
  regions: SpeechRegion[] | null
): SignBlocksResult {
  const credits = creditWindows(frames, fps)
  const grouped = frames.map((f) => ({ i: f.i, boxes: groupLines(f.boxes) }))
  const blocks = trackBlocks(grouped, fps)

  for (const b of blocks) {
    const clean = norm(b.text)
    const dur = b.endSec - b.startSec
    const inCredits = credits.some(([s, e]) => Math.min(b.endSec, e) - Math.max(b.startSec, s) >= 0.7 * dur)
    if (!HAS_TEXT.test(clean)) b.drop = 'no-letters'
    else if (inCredits) b.drop = 'credits'
    else if (b.conf < 0.35 && b.frames < 3) b.drop = 'low-conf'
    else if (b.box.h < 0.012) b.drop = 'tiny'
    else if (b.frames === 1 && b.conf < 0.7) b.drop = 'flash'
    else if (clean.length === 1 && !CJK.test(clean)) b.drop = 'single-char'
  }

  // 台标/水印：同一段字在同一位置累计出现太久（≥ 2 分钟且 ≥ 全片 8%）——电视台 logo、频道水印、播放器 UI
  const filmSec = Math.max(1, ...frames.map((f) => (f.i + 1) / fps))
  const total = new Map<string, number>()
  const keyOf = (b: SignBlock): string => `${norm(b.text)}@${Math.round((b.box.x + b.box.w / 2) * 20)},${Math.round((b.box.y + b.box.h / 2) * 20)}`
  for (const b of blocks) total.set(keyOf(b), (total.get(keyOf(b)) ?? 0) + (b.endSec - b.startSec))
  for (const b of blocks) {
    if (!b.drop && (total.get(keyOf(b)) ?? 0) >= Math.max(120, 0.08 * filmSec)) b.drop = 'watermark'
  }

  if (regions) {
    const rs = regions.map((r) => ({ s: r.startMs / 1000, e: r.endMs / 1000 }))
    for (const b of blocks) {
      let overlap = 0
      for (const r of rs) overlap += Math.max(0, Math.min(b.endSec, r.e) - Math.max(b.startSec, r.s))
      b.speech = Math.min(1, overlap / Math.max(0.5, b.endSec - b.startSec))
    }
  }

  // 烧录字幕带：0.1 高的滑窗在下半屏找「居中文字出现占比」最高的一段；单行/双行高度不同，固定格子会把它劈成两半
  const centered = blocks.filter((b) => Math.abs(b.box.x + b.box.w / 2 - 0.5) < 0.15)
  const totalFrames = blocks.reduce((n, b) => n + b.frames, 0)
  let band: number[] = []
  let bandShare = 0
  for (let y0 = 0.7; y0 <= 0.92; y0 += 0.01) {
    const share = centered
      .filter((b) => { const cy = b.box.y + b.box.h / 2; return cy >= y0 && cy < y0 + 0.1 })
      .reduce((n, b) => n + b.frames, 0) / Math.max(1, totalFrames)
    if (share > bandShare) {
      bandShare = share
      band = [Number(y0.toFixed(2)), Number((y0 + 0.1).toFixed(2))]
    }
  }
  if (bandShare < 0.2) band = []
  if (band.length) {
    for (const b of blocks) {
      const cy = b.box.y + b.box.h / 2
      if (!b.drop && cy >= band[0] - 0.02 && cy < band[1] + 0.02 && Math.abs(b.box.x + b.box.w / 2 - 0.5) < 0.15 && (b.speech ?? 1) > 0.3) {
        b.drop = 'subtitle-band'
      }
    }
  }
  return { blocks, band, credits }
}
