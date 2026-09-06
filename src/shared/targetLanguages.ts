/**
 * 翻译目标语言：主进程（首次启动的默认值）与渲染进程（下拉列表）共用同一份，
 * 免得两边各写一份走偏。顺序就是下拉里的顺序：先常用的东亚语，再欧洲语，再其它。
 * 每一个都得是 translate/types.ts 里 languageName 认识的码，否则提示词里会出现裸码。
 */
export const TARGET_LANGUAGE_CODES = [
  'zh', 'zh-Hant', 'en', 'ja', 'ko',
  'fr', 'de', 'es', 'pt', 'it', 'nl', 'ru', 'uk', 'pl', 'cs', 'hu',
  'sv', 'da', 'no', 'fi', 'el', 'tr', 'he', 'ar', 'hi', 'th', 'vi', 'id', 'ms'
] as const

/** 界面语言 → 默认翻译目标。首次启动"翻译到你的语言"就靠它；对不上的落到英语 */
export function targetForUiLocale(locale: string): string {
  const map: Record<string, string> = { 'zh-Hans': 'zh', 'zh-Hant': 'zh-Hant', nb: 'no' }
  if (map[locale]) return map[locale]
  const base = locale.split(/[-_]/)[0].toLowerCase()
  return (TARGET_LANGUAGE_CODES as readonly string[]).includes(base) ? base : 'en'
}
