/**
 * 让翻译模型判「这段画面文字值不值得给观众看」并翻译。
 *
 * 模型只判 sign / credits / noise 三类：名单与烧录字幕已经在 blocks.ts 里按几何剔掉，
 * 不给模型猜的机会。两个从数据里学来的规矩：
 * - 8B 会把第 n 条答案写到第 n+1 条上（曾把「業務管理室」译成 "SOLO"），所以让它照抄原文开头做 src，
 *   按相似度对齐，批量压到 15 条；
 * - OCR 文本与同时段台词相似 ⇒ 这段字正被角色念出来（短信、书信、便签），两个模型都曾把它判成 noise，
 *   直接判 sign、重要度 3，缺译文的再补译一轮。
 */
import { LocalizedError } from '../../../shared/i18n/core'
import type { Cue } from '../subtitle/types'
import { textSimilarity } from './blocks'
import type { SignBlock, SignJudgement } from './types'

export type ChatFn = (system: string, user: string) => Promise<string>

export interface JudgeOptions {
  chat: ChatFn
  /** 语音字幕（原文），做上下文与念读判定 */
  cues: Cue[]
  /** 原语言名（英文），如 Japanese */
  sourceLanguageName: string
  /** 目标语言名（英文），如 Simplified Chinese */
  targetLanguageName: string
  signal?: AbortSignal
  onProgress?: (percent: number) => void
}

const BATCH = 15
const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function posLabel(b: SignBlock): string {
  const cx = b.box.x + b.box.w / 2
  const cy = b.box.y + b.box.h / 2
  return `${cy < 0.33 ? 'top' : cy < 0.66 ? 'middle' : 'bottom'}-${cx < 0.33 ? 'left' : cx < 0.66 ? 'center' : 'right'}`
}

function systemPrompt(src: string, target: string): string {
  return `你是影视字幕组负责「屏幕字」的翻译。下面是从一部 ${src} 影片画面里 OCR 出来的文字（可能有错字、断片；多行用换行分隔），每条带出现时刻、时长（秒）、画面位置、与人声重叠比例、附近台词 ctx（语音识别结果，可能有错）和 read_aloud。本片没有烧录字幕，画面上出现的文字都不是对白字幕。
请逐条判断类别：
- sign：观众需要看懂的画面文字——招牌、店名、便签、书信、短信/聊天/邮件、文件、书页、杂志或书的标题、商品标签与价签、告示、路牌、屏幕或界面文字、章节标题、日期地点字幕卡、预告标题等。一段通顺的句子或短语（哪怕只是半句）几乎总是便签、聊天气泡、书页或告示上的字，应判 sign。read_aloud 为 true 表示这段画面文字正被角色念出来（短信、书信），它一定是 sign 且 importance 3。
- credits：制作人员/演职员表、版权声明、公司/工作室/赞助商/取材协力名单。例如「監督」「脚本」「作画監督」「Director」「Music」「Opening Theme」「Animation Production」「Produced by」、罗马字或片假名的人名、公司名、©。
- noise：无意义的碎片、品牌 logo、背景装饰文字、明显的错识别、单独的数字或符号。
sign 再给一个重要度 importance：3 = 不看就不懂剧情（短信、书信、便签、文件内容、标题卡、关键告示）；2 = 有帮助（店名、招牌、路牌、标签、价签、书名）；1 = 可有可无（界面按钮、菜单项、装饰性文字、背景书架杂志封面、商品包装上的字）。
用 ctx 理解语境：例如露营场景里的「ポール」是帐篷杆而不是人名。
只有 sign 需要翻译成 ${target}：忠实、简洁、像字幕组的屏幕字，专有名词按通行译法，多行保留换行，颜文字与表情符号原样保留；原文若被 OCR 打碎或有错字，在 fixed 里写修正后的原文再翻。
只输出 JSON 数组，每项形如 {"id":1,"src":"该条 text 的前 12 个字，照抄","category":"sign","importance":2,"fixed":"","tr":""}，src 必须照抄该条 text 的开头（用来核对没有串行），不要任何其它文字。`
}

function parseJsonArray(s: string): Array<Record<string, unknown>> {
  const cleaned = s.replace(/<think>[\s\S]*?<\/think>/g, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start < 0 || end < 0) throw new Error(`no JSON array in model output: ${cleaned.slice(0, 120)}`)
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed)) throw new Error('model output is not an array')
  return parsed as Array<Record<string, unknown>>
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const norm = (s: string): string => s.normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase()
/**
 * 译文里残留源语言文字：目标不是日语却有大量假名、不是韩语却有大量谚文 ⇒ 没翻。
 * 按占比判而不是一见就判——「欢迎来到野クル！」这种带片假名专名的译文是对的，整句照抄的才是没翻。
 */
export function leftoverScript(tr: string, targetLanguageName: string): boolean {
  const t = targetLanguageName.toLowerCase()
  const letters = (tr.match(/\p{L}/gu) ?? []).length
  if (letters === 0) return false
  const count = (re: RegExp): number => (tr.match(re) ?? []).length
  if (!t.includes('japanese') && count(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) / letters >= 0.4) return true
  if (!t.includes('korean') && count(/\p{Script=Hangul}/gu) / letters >= 0.4) return true
  return false
}

export async function judgeSigns(blocks: SignBlock[], opts: JudgeOptions): Promise<SignJudgement[]> {
  const kept = blocks.filter((b) => !b.drop)
  const cues = opts.cues
  const ctxOf = (b: SignBlock): string =>
    cues
      .filter((c) => c.endMs / 1000 >= b.startSec - 8 && c.startMs / 1000 <= b.endSec + 8)
      .slice(0, 4)
      .map((c) => c.text)
      .join(' / ')
      .slice(0, 160)
  const readAloud = (b: SignBlock): boolean =>
    cues.some((c) => c.endMs / 1000 >= b.startSec - 3 && c.startMs / 1000 <= b.endSec + 3 && textSimilarity(c.text, b.text.replace(/\n/g, '')) >= 0.5)

  const system = systemPrompt(opts.sourceLanguageName, opts.targetLanguageName)
  const judged: SignJudgement[] = []
  for (let i = 0; i < kept.length; i += BATCH) {
    if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
    const batch = kept.slice(i, i + BATCH)
    const items = batch.map((b) => ({
      id: b.id,
      time: fmtTime(b.startSec),
      dur: Number((b.endSec - b.startSec).toFixed(1)),
      pos: posLabel(b),
      speech: Number((b.speech ?? 0).toFixed(2)),
      text: b.text,
      ctx: ctxOf(b),
      read_aloud: readAloud(b)
    }))
    let out: Array<Record<string, unknown>> = []
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        out = parseJsonArray(await opts.chat(system, JSON.stringify(items)))
        break
      } catch {
        if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
      }
    }
    // 先按 src 照抄的原文开头对齐，再退回 id
    const assigned = new Map<number, Record<string, unknown>>()
    const unclaimed = new Set(out)
    for (const b of batch) {
      let best: Record<string, unknown> | undefined
      let bestSim = 0
      for (const j of unclaimed) {
        const src = str(j.src)
        const sim = src ? textSimilarity(src, b.text.slice(0, 14)) : 0
        if (sim > bestSim) {
          best = j
          bestSim = sim
        }
      }
      if (best && bestSim >= 0.6) {
        assigned.set(b.id, best)
        unclaimed.delete(best)
      }
    }
    for (const b of batch) {
      if (assigned.has(b.id)) continue
      const j = out.find((o) => Number(o.id) === b.id && unclaimed.has(o))
      if (j) {
        assigned.set(b.id, j)
        unclaimed.delete(j)
      }
    }
    for (const b of batch) {
      const j = assigned.get(b.id)
      const category = str(j?.category)
      // fixed 只认「修正后的原文」：模型常把译文写进去，与 OCR 文本不像的一律不要
      const fixedRaw = str(j?.fixed).trim()
      const fixed = fixedRaw && textSimilarity(fixedRaw, b.text) >= 0.4 ? fixedRaw : ''
      let tr = str(j?.tr).trim()
      // 目标语言不是日/韩，译文里却还留着假名/谚文，或者把原文整个抄了进来 ⇒ 没翻，清掉让补译那一轮重来
      if (tr && (leftoverScript(tr, opts.targetLanguageName) || (norm(b.text).length >= 4 && norm(tr).includes(norm(b.text))))) tr = ''
      const item: SignJudgement = j
        ? {
            id: b.id,
            category: category === 'sign' || category === 'credits' ? category : 'noise',
            importance: Math.min(3, Math.max(1, Number(j.importance ?? 2) || 2)),
            fixed,
            tr
          }
        : { id: b.id, category: 'noise', importance: 1, fixed: '', tr: '' }
      if (readAloud(b) && item.category !== 'sign') {
        item.category = 'sign'
        item.importance = 3
      }
      judged.push(item)
    }
    opts.onProgress?.(Math.round(((i + batch.length) / Math.max(1, kept.length)) * 90))
  }

  // 补译：判为 sign 却没给译文的（含念读兜底的、译文残留源语言被清掉的）
  const missing = judged.filter((j) => j.category === 'sign' && !j.tr.trim())
  if (missing.length > 0) {
    const byId = new Map(kept.map((b) => [b.id, b]))
    const items = missing.map((j) => ({ id: j.id, text: j.fixed || byId.get(j.id)!.text, dialogue_nearby: ctxOf(byId.get(j.id)!) }))
    try {
      const out = parseJsonArray(
        await opts.chat(
          `你是影视字幕翻译。把 JSON 里每一条的 text 从 ${opts.sourceLanguageName} 翻译成 ${opts.targetLanguageName}：忠实、简洁，多行保留换行，颜文字原样保留。dialogue_nearby 只是附近台词、供理解语境，不要翻译也不要输出它。只输出 JSON 数组，每项 {"id":1,"tr":"译文"}，tr 里只放译文，不要夹带原文。`,
          JSON.stringify(items)
        )
      )
      for (const o of out) {
        const j = judged.find((x) => x.id === Number(o.id))
        if (!j || j.tr.trim()) continue
        const src = j.fixed || byId.get(j.id)!.text
        const tr = str(o.tr).trim()
        // 还是没翻（残留假名、或把原文/台词抄了进来）就宁可空着出原文，也不出垃圾
        if (!tr || leftoverScript(tr, opts.targetLanguageName) || (norm(src).length >= 4 && norm(tr).includes(norm(src)))) continue
        j.tr = tr
      }
    } catch {
      // 补译失败就让这些条留着原文出片，不中断任务
    }
  }
  opts.onProgress?.(100)
  return judged
}
