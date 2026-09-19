import type { BatchItem, TranslateContext } from './types'
import { languageName, normalizeLanguageCode, TranslationParseError } from './types'

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
export const PROMPT_REV = 4

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
    `k 只是校对用的锚；t 必须是这一条原文从头到尾的完整译文，不能只译 k 那几个字、不能只译前半句。` +
    `每个 i 的 t 只能是这一条原文的译文，绝不能把内容挪到相邻编号上。输出的条数要和输入一样多。不要输出任何其它内容。` +
    copyGuard(ctx) +
    exampleSection(ctx)
  )
}

/**
 * 「别照抄原文」的强调 + 一组两条的示例。
 *
 * 1.7B 这一档的小模型翻日语时最常见的失败不是译错，是把原文原样抄回 t 里；听写有错字的句子更是整批照抄。
 * 拿这部 NHK 纪录片里最难的 5 批（每批 20 条，各跑 3 次）实测第一轮真正译出来的比例：
 *   现状 40%；只加示例 58%；只加强调 40%；示例 + 强调 88%；把温度提到 0.7 没用。
 * 两样都要，缺一样效果就掉一半。示例按源语言、目标语言各取一句，锚 k 按 ANCHOR_CHARS 截，
 * 让小模型顺便看清「k 抄原文开头、t 是完整译文」这个格式，输出走样（一行一个数组）也跟着少了。
 */
function copyGuard(ctx: TranslateContext): string {
  const target = languageName(ctx.targetLanguage)
  const source = ctx.sourceLanguage ? `原文是${languageName(ctx.sourceLanguage)}，` : ''
  return `\n注意：${source}t 必须译成${target}，绝不能把原文照抄进 t；即使原文是语音听写、有错字或不通顺，也按最可能的意思译出来。`
}

/** 示例句「今天真的太感谢你了」「下周见」在各语言里的写法：作为示例的输入（按源语言）与输出（按目标语言） */
const EXAMPLE_LINES: Record<string, [string, string]> = {
  zh: ['今天真的太感谢你了', '下周见'],
  'zh-hant': ['今天真的太感謝你了', '下週見'],
  'zh-tw': ['今天真的太感謝你了', '下週見'],
  en: ['Thank you so much for today.', 'See you next week.'],
  ja: ['今日は本当にありがとうございました', 'また来週'],
  ko: ['오늘 정말 감사했습니다', '다음 주에 봐요'],
  fr: ["Merci beaucoup pour aujourd'hui.", 'À la semaine prochaine.'],
  de: ['Vielen Dank für heute.', 'Bis nächste Woche.'],
  es: ['Muchas gracias por lo de hoy.', 'Hasta la semana que viene.'],
  pt: ['Muito obrigado por hoje.', 'Até a semana que vem.'],
  it: ['Grazie mille per oggi.', 'Alla prossima settimana.'],
  nl: ['Heel erg bedankt voor vandaag.', 'Tot volgende week.'],
  ru: ['Большое спасибо за сегодня.', 'До следующей недели.'],
  uk: ['Щиро дякую за сьогодні.', 'До наступного тижня.'],
  pl: ['Bardzo dziękuję za dzisiaj.', 'Do zobaczenia w przyszłym tygodniu.'],
  cs: ['Moc děkuji za dnešek.', 'Uvidíme se příští týden.'],
  hu: ['Nagyon köszönöm a mai napot.', 'Jövő héten találkozunk.'],
  sv: ['Tack så mycket för idag.', 'Vi ses nästa vecka.'],
  da: ['Mange tak for i dag.', 'Vi ses i næste uge.'],
  no: ['Tusen takk for i dag.', 'Vi ses neste uke.'],
  fi: ['Kiitos paljon tästä päivästä.', 'Nähdään ensi viikolla.'],
  el: ['Σας ευχαριστώ πολύ για σήμερα.', 'Τα λέμε την επόμενη εβδομάδα.'],
  tr: ['Bugün için çok teşekkür ederim.', 'Haftaya görüşürüz.'],
  he: ['תודה רבה על היום.', 'נתראה בשבוע הבא.'],
  ar: ['شكرًا جزيلًا على اليوم.', 'أراك الأسبوع المقبل.'],
  hi: ['आज के लिए बहुत-बहुत धन्यवाद।', 'अगले हफ़्ते मिलते हैं।'],
  th: ['ขอบคุณมากสำหรับวันนี้', 'แล้วเจอกันสัปดาห์หน้า'],
  vi: ['Cảm ơn rất nhiều vì hôm nay.', 'Hẹn gặp lại tuần sau.'],
  id: ['Terima kasih banyak untuk hari ini.', 'Sampai jumpa minggu depan.'],
  ms: ['Terima kasih banyak untuk hari ini.', 'Jumpa minggu depan.']
}

const exampleKey = (code: string): string => normalizeLanguageCode(code).toLowerCase()

/**
 * 示例的输入按源语言取；源语言不认识（自动检测失败）或和目标语言相同时，用日语——除非目标就是日语，那就用英语。
 * 目标语言不在表里（不该发生：下拉列表里的都在）就不给示例，只留强调。
 */
function exampleSection(ctx: TranslateContext): string {
  const targetKey = exampleKey(ctx.targetLanguage)
  const target = EXAMPLE_LINES[targetKey]
  if (!target) return ''
  const sourceKey = ctx.sourceLanguage ? exampleKey(ctx.sourceLanguage) : ''
  const usable = sourceKey && sourceKey !== targetKey && EXAMPLE_LINES[sourceKey] ? sourceKey : targetKey === 'ja' ? 'en' : 'ja'
  const source = EXAMPLE_LINES[usable]
  const input = JSON.stringify([{ i: 7, t: source[0] }, { i: 8, t: source[1] }])
  const output = JSON.stringify([
    { i: 7, k: source[0].slice(0, ANCHOR_CHARS), t: target[0] },
    { i: 8, k: source[1].slice(0, ANCHOR_CHARS), t: target[1] }
  ])
  return `\n示例——输入：${input}\n输出：${output}`
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
 * 把文本里所有顶层 JSON 对象逐个抠出来（不依赖外层数组是否完整）。
 *
 * 1.7B 这一档的小模型经常不按「一个数组」输出，而是一行一个 `[{...}]`、或者干脆 JSONL；
 * 输出被 max_tokens 截断时最后一个对象也是残的。这些情况下整段当 JSON 解析必然失败，
 * 之前是整批 20 条好译文一起作废、退到小批和单条重试——而单条那轮小模型又最爱照抄原文。
 * 逐个对象抠，能救回来的全救回来。字符串里的花括号按 JSON 转义规则跳过。
 */
function extractObjects(text: string): unknown[] {
  const out: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
    } else if (ch === '}' && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)))
        } catch {
          // 这一段不是合法 JSON，跳过它继续找下一个
        }
        start = -1
      }
    }
  }
  return out
}

/** 编号：正常是数字，小模型偶尔给成 "12" 这样的字符串，照认 */
function rowIndex(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim())
  return undefined
}

/**
 * @param sources 本批各编号的原文；给了就核对每行的锚 k，对不上的行当作没译（由调用方重试）。
 *   模型没输出 k 的行照常接受——云端模型偶尔不理会格式要求，宁可少一道检查也不能全批作废。
 */
export function parseBatchResponse(content: string, sources?: Map<number, string>): Map<number, string> {
  const cleaned = content
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    // 关掉思考的 Qwen3 仍会先吐一个孤零零的 </think>
    .replace(/<\/?think(?:ing)?>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  // 先按理想形态（一个完整数组）解析；不行再逐个对象抠
  let whole: unknown
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end > start) {
    try {
      whole = JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      whole = undefined
    }
  }
  const rows: unknown[] = Array.isArray(whole) ? whole : extractObjects(cleaned)
  if (rows.length === 0) throw new TranslationParseError('翻译结果不是合法的 JSON 数组')
  const map = new Map<number, string>()
  for (const row of rows) {
    const item = row as { i?: unknown; k?: unknown; t?: unknown }
    const index = rowIndex(item?.i)
    if (index === undefined || typeof item?.t !== 'string' || !item.t.trim()) continue
    // 单条批次不可能错位，锚对不上也照收：这是漏译兜底轮的最后一道，宁可要一条可疑译文也不留原文
    if (sources && sources.size > 1 && typeof item.k === 'string' && item.k.trim()) {
      const src = sources.get(index)
      const k = anchorKey(item.k)
      if (src !== undefined && k.length >= 2 && !anchorKey(src).startsWith(k.slice(0, ANCHOR_CHARS))) continue
    }
    map.set(index, item.t.trim())
  }
  if (map.size === 0 && sources?.size === 1) {
    // 单条兜底轮：小模型常把格式整个丢掉，只回 ["译文"]。批里只有这一条，不可能对错号，照收
    const [only] = sources.keys()
    const strings = rows.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    if (strings.length === 1) map.set(only, strings[0].trim())
  }
  return map
}
