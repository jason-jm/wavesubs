import type { BatchItem, TranslateContext } from './types'
import { languageName, TranslationParseError } from './types'

/** 每批注入的术语上限：全表塞进提示词会稀释注意力，也白烧 token */
const GLOSSARY_PER_BATCH = 40

/**
 * 从全量术语表里挑出「这批文本里真出现的」条目。
 *
 * 为什么过滤而不是全量注入：一部剧的术语表可能有上百条，而一批只有 20 条字幕，
 * 命中的往往就三五条。全塞进去除了浪费，还会让模型把没出现的人名往译文里带。
 * 拉丁词按不区分大小写匹配（对白开头会大写），CJK 直接子串匹配。
 */
export function applicableGlossary(
  entries: Array<{ from: string; to: string }> | undefined,
  texts: string[]
): Array<{ from: string; to: string }> {
  if (!entries || entries.length === 0 || texts.length === 0) return []
  const haystack = texts.join('\n').toLowerCase()
  const hit = entries.filter((e) => haystack.includes(e.from.toLowerCase()))
  return hit.slice(0, GLOSSARY_PER_BATCH)
}

/**
 * 提示词版本号。措辞实质变化时 +1：翻译缓存按它判断「同一引擎同一目标语言的旧译文
 * 还能不能复用」——提示词变了产出就不同，不 +1 会让旧译文永远盖住新效果。
 */
export const PROMPT_REV = 2

/** 提示词与结果解析在各协议之间是共用的，只有传输层不同 */
export function buildSystemPrompt(ctx: TranslateContext): string {
  const target = languageName(ctx.targetLanguage)
  const source = ctx.sourceLanguage ? languageName(ctx.sourceLanguage) : '原文语言'
  return (
    `你是资深的影视字幕翻译，把${source}电影对白翻译成${target}。\n` +
    `翻译要求：\n` +
    `1. 意译优先——传达说话人的真实意思，不要逐字直译。惯用语、成语、双关要换成${target}里对应的说法，` +
    `直译会闹笑话的地方一律按实际语义处理。\n` +
    `2. 这是连贯剧情中的对白，要结合上下文判断言外之意：` +
    `同一个词在不同场景意思可能完全不同，选贴合当前情境的那个。\n` +
    `3. 口语自然、简洁易读，符合${target}母语者的说话方式，不要翻译腔。\n` +
    `4. 人名、地名、职衔等专有名词用通用译法，全篇保持一致。\n` +
    `5. 每条独立成句，不要合并、拆分、增删内容或添加任何解释；` +
    `如果某条原文只是半句（在句中被切开），译文也只译这半句，不要把它补全成完整的句子。\n` +
    `6. 译文必须完全是${target}，不能残留原文字符。\n` +
    glossarySection(ctx) +
    `输入是 JSON 数组 [{"i":编号,"t":"原文"}]，只输出对应的 JSON 数组 ` +
    `[{"i":编号,"k":"该条原文开头的前 ${ANCHOR_CHARS} 个字符（原样照抄）","t":"译文"}]。` +
    `每个 i 的 t 只能是这一条原文的译文，绝不能把内容挪到相邻编号上。不要输出任何其它内容。`
  )
}

/**
 * 对齐锚：要求模型在每条译文前先照抄该条原文的开头几个字。
 *
 * 评测（9 部双语片、Qwen3-8B）里译文「意思弄反」的一大来源不是翻错，是**错位**：
 * 模型把第 57 条的译文写到了 58 条上，后面整批跟着错一位；按 i 回填时没人发现。
 * 让它先抄原文开头再翻，既把注意力钉在本条上，也给了解析端一个可核对的锚：
 * 锚对不上的行丢掉，走既有的小批重试。
 */
export const ANCHOR_CHARS = 4

/** 核对锚时的归一：全角/半角、空白都不算差异 */
const anchorKey = (text: string): string => text.normalize('NFKC').replace(/\s+/g, '').toLowerCase()

/**
 * 术语表注入段。表为空时返回空串——**没有术语表的用户提示词与旧版逐字节相同**，
 * 这是不给 PROMPT_REV +1 的前提；表非空与否本身已进了译文缓存哈希。
 */
function glossarySection(ctx: TranslateContext): string {
  if (!ctx.glossary || ctx.glossary.length === 0) return ''
  const lines = ctx.glossary.map((g) => `「${g.from}」必须译为「${g.to}」`).join('；')
  return `7. 术语对照（用户指定，优先级高于你的习惯译法，逐条严格遵守）：${lines}。\n`
}

export function buildUserContent(items: BatchItem[], ctx: TranslateContext): string {
  const preceding = ctx.precedingText?.length
    ? `【前文，仅供理解剧情，不要翻译】\n${ctx.precedingText.join('\n')}\n\n【需要翻译的内容】\n`
    : ''
  return preceding + JSON.stringify(items.map((it) => ({ i: it.index, t: it.text })))
}

/**
 * @param sources 本批各编号的原文；给了就核对每行的锚 k，对不上的行当作没译（由调用方重试）。
 *   模型没输出 k 的行照常接受——云端模型偶尔不理会格式要求，宁可少一道检查也不能全批作废。
 */
export function parseBatchResponse(content: string, sources?: Map<number, string>): Map<number, string> {
  const cleaned = content
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start < 0 || end <= start) throw new TranslationParseError('翻译结果不是合法的 JSON 数组')
  let rows: unknown
  try {
    rows = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new TranslationParseError('翻译结果 JSON 解析失败')
  }
  const map = new Map<number, string>()
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const item = row as { i?: unknown; k?: unknown; t?: unknown }
      if (typeof item?.i === 'number' && typeof item?.t === 'string' && item.t.trim()) {
        // 单条批次不可能错位，锚对不上也照收：这是漏译兜底轮的最后一道，宁可要一条可疑译文也不留原文
        if (sources && sources.size > 1 && typeof item.k === 'string' && item.k.trim()) {
          const src = sources.get(item.i)
          const k = anchorKey(item.k)
          if (src !== undefined && k.length >= 2 && !anchorKey(src).startsWith(k.slice(0, ANCHOR_CHARS))) continue
        }
        map.set(item.i, item.t.trim())
      }
    }
  }
  return map
}
