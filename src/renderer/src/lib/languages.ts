import type { TranslationKey } from '../../../shared/i18n'

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

export const TARGET_LANGUAGES: Array<{ value: string; key: TranslationKey }> = [
  { value: 'zh', key: 'lang.zhHans' },
  { value: 'zh-Hant', key: 'lang.zhHant' },
  { value: 'en', key: 'lang.en' },
  { value: 'ja', key: 'lang.ja' },
  { value: 'ko', key: 'lang.ko' },
  { value: 'none', key: 'target.none' }
]

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
