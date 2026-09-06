import type { Translate, TranslationKey } from '../../../shared/i18n'
import { TARGET_LANGUAGE_CODES } from '../../../shared/targetLanguages'

/** 单文件页与批量页共用，避免两处选项列表走偏 */
export const SOURCE_LANGUAGES: Array<{ value: string; key: TranslationKey }> = [
  { value: 'auto', key: 'srclang.auto' },
  { value: 'en', key: 'lang.en' },
  { value: 'ja', key: 'lang.ja' },
  { value: 'ko', key: 'lang.ko' },
  { value: 'zh', key: 'lang.zh' },
  { value: 'fr', key: 'lang.fr' },
  { value: 'de', key: 'lang.de' },
  { value: 'es', key: 'lang.es' },
  { value: 'ru', key: 'lang.ru' }
]

export const TARGET_LANGUAGES: Array<{ value: string }> = [
  ...TARGET_LANGUAGE_CODES.map((value) => ({ value })),
  { value: 'none' }
]

/**
 * 目标语言的显示名。29 种语言 × 32 种界面语言靠人写要 900 多条，系统的 Intl.DisplayNames
 * 直接给出本地化名称；中文简繁与「不翻译」保留人工文案（Intl 对 zh/zh-Hant 的叫法各平台不一）。
 */
export function targetLanguageLabel(value: string, locale: string, t: Translate): string {
  if (value === 'none') return t('target.none')
  if (value === 'zh') return t('lang.zhHans')
  if (value === 'zh-Hant') return t('lang.zhHant')
  try {
    const name = new Intl.DisplayNames([locale, 'en'], { type: 'language' }).of(value)
    if (name && name.toLowerCase() !== value.toLowerCase()) return name
  } catch {
    /* 不认识的 locale 或运行时缺 ICU 数据：落到下面的兜底 */
  }
  return value
}

/** 常见 ISO 639-2 → 639-1。容器里的轨道语言标记多是三字码（jpn/chi），界面语言表用两字码 */
export const ISO3_TO_ISO1: Record<string, string> = {
  eng: 'en', jpn: 'ja', kor: 'ko', chi: 'zh', zho: 'zh', fra: 'fr', fre: 'fr',
  deu: 'de', ger: 'de', spa: 'es', rus: 'ru', ita: 'it', por: 'pt'
}

export function normalizeLanguageTag(tag?: string): string {
  if (!tag) return 'auto'
  const lower = tag.toLowerCase().split(/[-_]/)[0]
  const code = ISO3_TO_ISO1[lower] ?? lower
  return SOURCE_LANGUAGES.some((l) => l.value === code) ? code : 'auto'
}

/** 两个轨道语言标记是否指同一门语言。任一侧缺失或无法识别都算不同——宁可不匹配也别乱配 */
export function sameLanguage(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const norm = (t: string): string => {
    const lower = t.toLowerCase().split(/[-_]/)[0]
    return ISO3_TO_ISO1[lower] ?? lower
  }
  const na = norm(a)
  const nb = norm(b)
  return na === nb && na.length >= 2
}
