import type { Dict } from './core'
import { LOCALES, createTranslate, resolveLocale } from './core'
import { ar } from './locales/ar'
import { bn } from './locales/bn'
import { cs } from './locales/cs'
import { da } from './locales/da'
import { de } from './locales/de'
import { el } from './locales/el'
import { en } from './locales/en'
import { es } from './locales/es'
import { fa } from './locales/fa'
import { fi } from './locales/fi'
import { fr } from './locales/fr'
import { he } from './locales/he'
import { hi } from './locales/hi'
import { hu } from './locales/hu'
import { id } from './locales/id'
import { it } from './locales/it'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { ms } from './locales/ms'
import { nb } from './locales/nb'
import { nl } from './locales/nl'
import { pl } from './locales/pl'
import { pt } from './locales/pt'
import { ro } from './locales/ro'
import { ru } from './locales/ru'
import { sv } from './locales/sv'
import { th } from './locales/th'
import { tr } from './locales/tr'
import { uk } from './locales/uk'
import { vi } from './locales/vi'
import { zhHans } from './locales/zh-Hans'
import { zhHant } from './locales/zh-Hant'

export type { Dict, LocaleMeta, TranslationKey, Translate } from './core'
export { LOCALES, DEFAULT_LOCALE, localeMeta, resolveLocale, LocalizedError, localizeError } from './core'

/** 语言码 → 字典。加语言时在这里登记，选择器会自动多出一项 */
export const DICTS: Record<string, Dict> = {
  ar,
  bn,
  cs,
  da,
  de,
  el,
  en,
  es,
  fa,
  fi,
  fr,
  he,
  hi,
  hu,
  id,
  it,
  ja,
  ko,
  ms,
  nb,
  nl,
  pl,
  pt,
  ro,
  ru,
  sv,
  th,
  tr,
  uk,
  vi,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

/**
 * 真正能用的语言 = 既在清单里、又确实有字典的。
 * 这样清单里先声明、字典还没补的语言不会被选中后显示成英文。
 */
export const AVAILABLE_LOCALES = LOCALES.filter((l) => DICTS[l.code] !== undefined)

export function isAvailable(code: string): boolean {
  return DICTS[code] !== undefined
}

/** 解析出实际使用的语言，只在已有字典的范围内挑 */
export function pickLocale(preferred: string, systemLanguages: string[]): string {
  return resolveLocale(preferred, systemLanguages, isAvailable)
}

export function translatorFor(locale: string): ReturnType<typeof createTranslate> {
  return createTranslate(locale, DICTS)
}
