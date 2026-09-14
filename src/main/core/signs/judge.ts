/**
 * 让翻译模型判「这段画面文字值不值得给观众看」并翻译。
 *
 * 模型只判 sign / credits / noise 三类：名单与烧录字幕已经在 blocks.ts 里按几何剔掉，
 * 不给模型猜的机会。两个从数据里学来的规矩：
 * - 8B 会把第 n 条答案写到第 n+1 条上（曾把「業務管理室」译成 "SOLO"），所以让它照抄原文开头做 src，
 *   按相似度对齐，批量压到 15 条；
 * - OCR 文本与同时段台词相似 ⇒ 这段字正被角色念出来（短信、书信、便签），两个模型都曾把它判成 noise，
 *   直接判 sign、重要度 3，缺译文的再补译一轮；
 * - 多行的长条目，8B 常只译第一行就收尾（整段生平只译出人名）。按信息量比对，明显短的当没译，
 *   清掉扔进补译那一轮重来。
 */
import { LocalizedError } from '../../../shared/i18n/core'
import { applicableGlossary } from '../translate/prompt'
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
  /** 用户的术语表：画面文字和对白得用同一套译名，不然同一个人名两条轨道对不上 */
  glossary?: Array<{ from: string; to: string }>
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

function glossaryLine(entries: Array<{ from: string; to: string }>): string {
  if (entries.length === 0) return ''
  return `\n术语对照（用户指定，优先级高于你的习惯译法，逐条严格遵守）：${entries.map((g) => `「${g.from}」必须译为「${g.to}」`).join('；')}。`
}

function systemPrompt(src: string, target: string, glossary: Array<{ from: string; to: string }> = []): string {
  return `你是影视字幕组负责「屏幕字」的翻译。下面是从一部 ${src} 影片画面里 OCR 出来的文字（可能有错字、断片；多行用换行分隔），每条带出现时刻、时长（秒）、画面位置、与人声重叠比例、附近台词 ctx（语音识别结果，可能有错）和 read_aloud。本片没有烧录字幕，画面上出现的文字都不是对白字幕。
请逐条判断类别：
- sign：观众需要看懂的画面文字——招牌、店名、便签、书信、短信/聊天/邮件、文件、书页、杂志或书的标题、商品标签与价签、告示、路牌、屏幕或界面文字等。**集数与章节标题、下集预告的标题、日期地点字卡、介绍人物姓名与身份的名牌，一律是 sign 且 importance 3**，别把它们当成名单或噪声。一段通顺的句子或短语（哪怕只是半句）几乎总是便签、聊天气泡、书页或告示上的字，应判 sign。read_aloud 为 true 表示这段画面文字正被角色念出来（短信、书信），它一定是 sign 且 importance 3。
- credits：制作人员/演职员表、版权声明、公司/工作室/赞助商/取材协力名单。例如「監督」「脚本」「作画監督」「Director」「Music」「Opening Theme」「Animation Production」「Produced by」、罗马字或片假名的人名、公司名、©。
- noise：无意义的碎片、品牌 logo、背景装饰文字、明显的错识别、单独的数字或符号。**被切碎的半截词也算 noise**：只有修饰语没有主体的（「はじめての」「アウトドア」这种从「はじめてのアウトドアめし」里被切出来的半截），或者只剩一两个字的残片。地图上密密麻麻的地名与编号、报纸版面里的零碎小字也算 noise：它们不是给观众读的，逐条音译出来只会糊住画面。
sign 再给一个重要度 importance：3 = 不看就不懂剧情（短信、书信、便签、文件内容、标题卡、关键告示）；2 = 有帮助（店名、招牌、路牌、标签、价签、书名）；1 = 可有可无（界面按钮、菜单项、装饰性文字、背景书架杂志封面、商品与包装上的品牌名、剧场海报或书籍封面上成排的演职员姓名、地图上的地名标注）。
用 ctx 理解语境：例如露营场景里的「ポール」是帐篷杆而不是人名。
只有 sign 需要翻译成 ${target}：忠实、简洁、像字幕组的屏幕字，专有名词按通行译法，多行保留换行，颜文字与表情符号原样保留。**原文有几行就译几行，每一行都要译完**：整段生平只译出开头的人名、整封邮件只译出日期，都算没译完。原文若被 OCR 打碎或有错字，在 fixed 里写修正后的原文再翻。**译文里不要残留源语言的词**：专有名词、简称、店名也要译出或音译，整条照抄原文等于没翻，这种情况宁可判 noise。
只输出 JSON 数组，每项形如 {"id":1,"src":"该条 text 的前 12 个字，照抄","category":"sign","importance":2,"fixed":"","tr":""}，src 必须照抄该条 text 的开头（用来核对没有串行），不要任何其它文字。${glossaryLine(glossary)}`
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
 * 译文里残留源语言文字 ⇒ 这一条没翻。两条判据：
 * - 整体占比：假名/谚文占到四成，基本是整句照抄；
 * - 连着三个以上的假名（「タルシアン」「シリウ」）：中文字幕里的外来专名一律音译，
 *   连着一串假名就是模型没敢译。两个字的（「野クル」）是作品自己在用的简称，留着没问题。
 */
export function leftoverScript(tr: string, targetLanguageName: string): boolean {
  const t = targetLanguageName.toLowerCase()
  const letters = (tr.match(/\p{L}/gu) ?? []).length
  if (letters === 0) return false
  const count = (re: RegExp): number => (tr.match(re) ?? []).length
  if (!t.includes('japanese')) {
    if (count(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) / letters >= 0.4) return true
    if (/[\p{Script=Hiragana}\p{Script=Katakana}ー]{3,}/u.test(tr)) return true
  }
  if (!t.includes('korean')) {
    if (count(/\p{Script=Hangul}/gu) / letters >= 0.4) return true
    if (/\p{Script=Hangul}{2,}/u.test(tr)) return true
  }
  return false
}

/**
 * 译文信息量按字算：汉字/谚文一个算一个，假名算 0.6（日语的助词到中文会被吃掉），西文一个词算一个。
 */
function contentUnits(s: string): number {
  const count = (re: RegExp): number => (s.match(re) ?? []).length
  const kana = count(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)
  const cjk = count(/[\p{Script=Han}\p{Script=Hangul}]/gu)
  const words = count(/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]+/gu)
  return kana * 0.6 + cjk + words
}

/**
 * 只译了开头一截。8B 面对多行长条目常只译第一行（整段生平只译出人名、整封邮件只译出日期），
 * 信息量差得太多就当没译，清掉让补译那一轮重来。
 */
export function looksTruncated(src: string, tr: string): boolean {
  const su = contentUnits(src)
  return su >= 6 && contentUnits(tr) < su * 0.45
}

/**
 * 译文比原文长得离谱：模型把喂给它的附近台词（ctx）当成正文一起译了出来。
 * 实测《正发生》一块只写着「NEKRASSOV」的海报，译文是
 * 「涅克拉索夫\n而且这可能需要时间，因为我们并不都一样。\n而且必须花时间。\n就像这样。」——
 * 后三行是台词，画在海报上就是四行不相干的字压满画面。
 * 给短原文留 8 个字的底，免得「Episode 15 → 第15集」这种被误判。
 */
export function looksBloated(src: string, tr: string): boolean {
  const su = contentUnits(src)
  return contentUnits(tr) > Math.max(8, su * 4)
}

/**
 * 一屏字里被漏判的那一两块，跟着同屏的其余块走。
 *
 * 露营须知卡上四块字，三块判了 sign，只有最大的标题「キャンプを楽しむときは...」因为带省略号、
 * 看着像半句话被判成噪声——观众看到的是一整屏字里独独标题没译文，只会当成软件坏了。
 * 两个条件一起卡：同时出现的块里过半都是 sign（说明这一屏本来就是给观众读的），
 * 而且这一块的**字**比周围的正文大（按行高比，不是按面积：正文几行合成一块之后面积往往
 * 比标题还大，但每一行的字比标题小）——一屏字里字最大的那块是标题，标题不会是噪声。
 * 街景里一块招牌配一堆背景杂字（sign 只有一块）、或者和正文一样大的品牌 logo，都不会触发。
 */
/**
 * 集数标题卡、下集预告的字面标记。提示词里写了「一律是 sign 且 importance 3」，
 * 但块数一变、条目落进不同批次，模型就可能改口——《86》第 15 集的
 * 「Episode 15 / おかえりなさい / Welcome Back」和片尾的「次回予告」都这样丢过。
 * 这两类是观众明确要看的，按字面认出来直接定死，不再交给模型。
 */
const EPISODE_CARD =
  /(第\s*[0-9０-９一二三四五六七八九十百]+\s*[話话回集幕])|(\bEpisode\s*[0-9]+)|(\bEP\.?\s*[0-9]+\b)|(次回(予告)?)|(下集预告)|(\bNext\s+Episode\b)|(最終回)|(最终回)/i

/**
 * 认出集数/预告标记的那一块，连同同一张卡片上的其余块（标题本身、它的外语对照）
 * 一起定成 sign 重要度 3。同一张卡片 = 同时出现。
 */
function promoteEpisodeCards(judged: SignJudgement[], blocks: SignBlock[]): void {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const marked = blocks.filter((b) => EPISODE_CARD.test(b.text))
  for (const m of marked) {
    for (const j of judged) {
      const b = byId.get(j.id)
      if (!b || b.startSec >= m.endSec || m.startSec >= b.endSec) continue
      if (j.category !== 'sign') j.tr = ''
      j.category = 'sign'
      j.importance = 3
    }
  }
}

const lineHeight = (b: SignBlock): number => b.box.h / b.text.split('\n').length

function promoteLoners(judged: SignJudgement[], blocks: SignBlock[]): void {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const isSign = (j: SignJudgement): boolean => j.category === 'sign' && j.importance >= 2
  for (const j of judged) {
    // 判成噪声的、和判成「可有可无」的，都算漏判：一屏字里最大的那块不可能两样都不是
    if (j.category === 'credits' || isSign(j)) continue
    const b = byId.get(j.id)
    if (!b) continue
    let others = 0
    const signLineH: number[] = []
    for (const o of judged) {
      if (o === j) continue
      const ob = byId.get(o.id)
      if (!ob || ob.startSec >= b.endSec || b.startSec >= ob.endSec) continue
      others += 1
      if (isSign(o)) signLineH.push(lineHeight(ob))
    }
    if (signLineH.length < 2 || signLineH.length < others / 2) continue
    const sorted = [...signLineH].sort((x, y) => x - y)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (lineHeight(b) < median * 1.25) continue
    if (j.category !== 'sign') j.tr = ''
    j.category = 'sign'
    j.importance = 2
  }
}

/** 图表上的圆点、箭头被 OCR 当成文字读进来的痕迹 */
const LEAD_GLYPH = /^[\s•·▪●◦‣▶►▸→←⇒–—\-*+=|]+/
/**
 * 收拾译文里的 OCR 残渣：开头凭空多出来的圆点箭头（原文没有的才去，原文本来就是项目符号的留着）、
 * 结尾被截断留下的一个孤零零的西文字母。
 */
export function tidyTranslation(tr: string, src: string): string {
  let out = tr
  if (!LEAD_GLYPH.test(src)) out = out.replace(LEAD_GLYPH, '')
  out = out.replace(/[，,、。；;：:\s]+[A-Za-z]$/, '')
  return out.trim()
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

  const judged: SignJudgement[] = []
  /** 只译了半截被清掉的那份：补译要是也没补上，还是拿它出片，半句好过整条原文 */
  const partial = new Map<number, string>()
  for (let i = 0; i < kept.length; i += BATCH) {
    if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
    const batch = kept.slice(i, i + BATCH)
    // 术语表只注入这一批里真出现的条目：全表塞进去会稀释注意力，也会让模型把没出现的名字带进译文
    const system = systemPrompt(
      opts.sourceLanguageName,
      opts.targetLanguageName,
      applicableGlossary(opts.glossary, batch.map((b) => b.text))
    )
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
      let tr = tidyTranslation(str(j?.tr).trim(), b.text)
      // 没翻、只译了开头一截、译文残留源语言、或把原文整个抄了进来 ⇒ 清掉让补译那一轮重来
      const source = fixed || b.text
      if (
        tr &&
        (leftoverScript(tr, opts.targetLanguageName) ||
          looksTruncated(source, tr) ||
          looksBloated(source, tr) ||
          (norm(b.text).length >= 4 && norm(tr).includes(norm(b.text))))
      ) {
        // 只译了半截的那份还能用作兜底（半句译文好过整条原文）；
        // 残留源语言、或把原文抄进来的那份不能留——留下来等于绕过判据，
        // 观众看到的是「TARSIAN → タルシアン」这种一个字都没译的东西
        // 掺了台词的那份也不能留作兜底
        if (!leftoverScript(tr, opts.targetLanguageName) && !looksBloated(source, tr) && !norm(tr).includes(norm(b.text))) partial.set(b.id, tr)
        tr = ''
      }
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

  // 集数标题与下集预告：不指望模型守规矩，按字面认出来直接定成重要度 3
  promoteEpisodeCards(judged, kept)
  // 整屏文字里被漏判的那一两块，跟着同屏的其余块一起出
  promoteLoners(judged, kept)

  // 补译：判为 sign 却没给译文的（含念读兜底的、被判没译好清掉的、整屏里提上来的）。
  // 和判别一样分批：整片几十条塞进一次请求，输出会被 max_tokens 截断，
  // 解析失败就整批一条都补不上，那些条最后会因为「译文和原文一样」被丢掉。
  const missing = judged.filter((j) => j.category === 'sign' && !j.tr.trim())
  const byId = new Map(kept.map((b) => [b.id, b]))
  for (let i = 0; i < missing.length; i += BATCH) {
    if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
    const part = missing.slice(i, i + BATCH)
    const items = part.map((j) => ({ id: j.id, text: j.fixed || byId.get(j.id)!.text, dialogue_nearby: ctxOf(byId.get(j.id)!) }))
    try {
      const out = parseJsonArray(
        await opts.chat(
          `${glossaryLine(applicableGlossary(opts.glossary, items.map((x) => x.text))).trim()}你是影视字幕翻译。把 JSON 里每一条的 text 从 ${opts.sourceLanguageName} 翻译成 ${opts.targetLanguageName}：忠实、简洁，多行保留换行，颜文字原样保留。**text 有几行就译几行，整条都要译完**，不许只译第一行、只译开头的人名或日期。dialogue_nearby 只是附近台词、供理解语境，不要翻译也不要输出它。只输出 JSON 数组，每项 {"id":1,"tr":"译文"}，tr 里只放译文，不要夹带原文。`,
          JSON.stringify(items)
        )
      )
      for (const o of out) {
        const j = judged.find((x) => x.id === Number(o.id))
        if (!j || j.tr.trim()) continue
        const src = j.fixed || byId.get(j.id)!.text
        const tr = tidyTranslation(str(o.tr).trim(), src)
        // 还是没翻（残留假名、或把原文/台词抄了进来）就宁可空着出原文，也不出垃圾
        if (!tr || leftoverScript(tr, opts.targetLanguageName) || looksBloated(src, tr) || (norm(src).length >= 4 && norm(tr).includes(norm(src)))) continue
        j.tr = tr
      }
    } catch {
      // 这一批补译失败不影响别的批，也不中断任务
    }
  }
  // 补译没补上的，把之前那份被清掉的译文还回去
  for (const j of judged) {
    if (!j.tr.trim() && partial.has(j.id)) j.tr = partial.get(j.id)!
  }
  opts.onProgress?.(100)
  return judged
}
