import type { CloudProtocol } from '../../../shared/types'

export interface TranslateConfig {
  protocol: CloudProtocol
  baseUrl: string
  apiKey: string
  model: string
  targetLanguage: string
}

export interface BatchItem {
  index: number
  text: string
}

export interface TranslateContext {
  sourceLanguage?: string
  targetLanguage: string
  /** 紧邻的前文原文，只供模型理解剧情走向，不需要翻译 */
  precedingText?: string[]
  /**
   * 应用到这一批的术语表。调用方（translateCues）已按「原文里真出现的词」过滤过，
   * 这里拿到什么就注入什么——providers 不用再做判断。
   */
  glossary?: Array<{ from: string; to: string }>
  /** 用户点了「取消」：正在等的请求立刻中断，不再重试 */
  signal?: AbortSignal
}

export interface TranslationProvider {
  name: string
  /** 翻译一批字幕，返回 index → 译文 的映射（允许部分缺失，由调用方重试） */
  translateBatch(items: BatchItem[], ctx: TranslateContext): Promise<Map<number, string>>
}

/** 模型返回内容无法解析——可通过重试恢复 */
export class TranslationParseError extends Error {}

/** 配置有问题（Key 无效、模型名不存在、权限不足）——重试无意义，立刻中止整个任务 */
export class TranslationConfigError extends Error {}

/** 容器/字幕轨里的语言标记多是 ISO 639-2，统一成 639-1 两字母码 */
const ISO3_TO_ISO1: Record<string, string> = {
  eng: 'en', jpn: 'ja', kor: 'ko', chi: 'zh', zho: 'zh', fra: 'fr', fre: 'fr',
  deu: 'de', ger: 'de', spa: 'es', rus: 'ru', ita: 'it', por: 'pt', ara: 'ar',
  tha: 'th', vie: 'vi', nld: 'nl', dut: 'nl', swe: 'sv', dan: 'da', nor: 'no',
  fin: 'fi', pol: 'pl', tur: 'tr', ces: 'cs', cze: 'cs', ell: 'el', gre: 'el',
  heb: 'he', hin: 'hi', ind: 'id', msa: 'ms', may: 'ms', ukr: 'uk', hun: 'hu',
  ron: 'ro', rum: 'ro', bul: 'bg', hrv: 'hr', srp: 'sr', slk: 'sk', slo: 'sk',
  slv: 'sl', cat: 'ca', fas: 'fa', per: 'fa'
}

export function normalizeLanguageCode(code: string): string {
  const lower = code.toLowerCase()
  // zh-Hant / pt-BR 这类带地区的标记原样保留
  if (lower.includes('-') || lower.includes('_')) return code
  return ISO3_TO_ISO1[lower] ?? code
}

const LANGUAGE_NAMES: Record<string, string> = {
  zh: '简体中文',
  'zh-hant': '繁体中文',
  'zh-tw': '繁体中文',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  fr: '法语',
  de: '德语',
  es: '西班牙语',
  ru: '俄语',
  pt: '葡萄牙语',
  it: '意大利语',
  ar: '阿拉伯语',
  th: '泰语',
  vi: '越南语',
  nl: '荷兰语',
  sv: '瑞典语',
  da: '丹麦语',
  no: '挪威语',
  fi: '芬兰语',
  pl: '波兰语',
  tr: '土耳其语',
  cs: '捷克语',
  el: '希腊语',
  he: '希伯来语',
  hi: '印地语',
  id: '印尼语',
  ms: '马来语',
  uk: '乌克兰语',
  hu: '匈牙利语',
  ro: '罗马尼亚语',
  bg: '保加利亚语',
  hr: '克罗地亚语',
  sr: '塞尔维亚语',
  sk: '斯洛伐克语',
  sl: '斯洛文尼亚语',
  ca: '加泰罗尼亚语',
  fa: '波斯语'
}

export function languageName(code: string): string {
  const normalized = normalizeLanguageCode(code)
  return LANGUAGE_NAMES[normalized.toLowerCase()] ?? normalized
}
