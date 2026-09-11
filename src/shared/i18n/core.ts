import type { Dict, TranslationKey } from './locales/zh-Hans'

export type { Dict, TranslationKey }

export interface LocaleMeta {
  /** BCP-47 语言标记 */
  code: string
  /** 该语言的自称，语言选择器里就显示这个 */
  native: string
  /** 英文名，仅用于排序与调试 */
  english: string
  dir: 'ltr' | 'rtl'
  /** 缺键时优先回退到谁（默认回退到英语） */
  fallback?: string
}

/**
 * 支持的界面语言。加一门新语言只需要：
 * 在这里加一条，再在 locales/ 下写一份同名字典（类型会强制补齐所有键）。
 */
export const LOCALES: LocaleMeta[] = [
  { code: 'zh-Hans', native: '简体中文', english: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'zh-Hant', native: '繁體中文', english: 'Chinese (Traditional)', dir: 'ltr', fallback: 'zh-Hans' },
  { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'ja', native: '日本語', english: 'Japanese', dir: 'ltr' },
  { code: 'ko', native: '한국어', english: 'Korean', dir: 'ltr' },
  { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'fr', native: 'Français', english: 'French', dir: 'ltr' },
  { code: 'de', native: 'Deutsch', english: 'German', dir: 'ltr' },
  { code: 'pt', native: 'Português', english: 'Portuguese', dir: 'ltr' },
  { code: 'it', native: 'Italiano', english: 'Italian', dir: 'ltr' },
  { code: 'ru', native: 'Русский', english: 'Russian', dir: 'ltr' },
  { code: 'uk', native: 'Українська', english: 'Ukrainian', dir: 'ltr' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch', dir: 'ltr' },
  { code: 'pl', native: 'Polski', english: 'Polish', dir: 'ltr' },
  { code: 'cs', native: 'Čeština', english: 'Czech', dir: 'ltr' },
  { code: 'sv', native: 'Svenska', english: 'Swedish', dir: 'ltr' },
  { code: 'da', native: 'Dansk', english: 'Danish', dir: 'ltr' },
  { code: 'nb', native: 'Norsk bokmål', english: 'Norwegian', dir: 'ltr' },
  { code: 'fi', native: 'Suomi', english: 'Finnish', dir: 'ltr' },
  { code: 'hu', native: 'Magyar', english: 'Hungarian', dir: 'ltr' },
  { code: 'ro', native: 'Română', english: 'Romanian', dir: 'ltr' },
  { code: 'el', native: 'Ελληνικά', english: 'Greek', dir: 'ltr' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish', dir: 'ltr' },
  { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese', dir: 'ltr' },
  { code: 'th', native: 'ไทย', english: 'Thai', dir: 'ltr' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', dir: 'ltr' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', dir: 'ltr' },
  { code: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
  { code: 'he', native: 'עברית', english: 'Hebrew', dir: 'rtl' },
  { code: 'fa', native: 'فارسی', english: 'Persian', dir: 'rtl' }
]

export const DEFAULT_LOCALE = 'en'

const BY_CODE = new Map(LOCALES.map((l) => [l.code.toLowerCase(), l]))

/**
 * 容忍传入空值：旧版本写下的设置、或主进程与渲染层版本不同步时，
 * 字段可能是 undefined。这里直接退回默认语言，不能让整页崩掉。
 */
export function localeMeta(code: string | null | undefined): LocaleMeta {
  const hit = typeof code === 'string' ? BY_CODE.get(code.toLowerCase()) : undefined
  return hit ?? BY_CODE.get(DEFAULT_LOCALE)!
}

/**
 * 把一个系统语言标记展开成按优先级排列的候选语言。
 * macOS 给出的是 zh-Hans-CN / pt-BR / en-GB 这类，需要逐级降解。
 * 返回列表而不是单个结果，是因为首选可能还没有字典——
 * 那时要继续看下一个候选，而不是就此放弃这条系统语言。
 */
function candidatesFor(tag: string | null | undefined): string[] {
  if (typeof tag !== 'string' || tag === '') return []
  const lower = tag.toLowerCase().replace(/_/g, '-')
  const out: string[] = []
  const push = (code: string | undefined): void => {
    if (code && !out.includes(code)) out.push(code)
  }

  push(BY_CODE.get(lower)?.code)

  const parts = lower.split('-')
  // 逐级砍掉尾部子标记：zh-hans-cn → zh-hans → zh
  for (let i = parts.length - 1; i > 0; i -= 1) {
    push(BY_CODE.get(parts.slice(0, i).join('-'))?.code)
  }

  const base = parts[0]
  if (base === 'zh') {
    // 中文按地区判断字形：港澳台用繁体，其余简体；另一种作为兜底
    const hant = parts.slice(1).some((p) => ['hant', 'tw', 'hk', 'mo'].includes(p))
    push(hant ? 'zh-Hant' : 'zh-Hans')
    push(hant ? 'zh-Hans' : 'zh-Hant')
  } else {
    // 其余按基础语言找同语族的（如 pt-br → pt、en-gb → en）
    push(LOCALES.find((l) => l.code.toLowerCase().split('-')[0] === base)?.code)
  }

  // 候选自己声明的回退（如 zh-Hant → zh-Hans）也算数
  for (const code of [...out]) push(localeMeta(code).fallback)
  return out
}

/**
 * 决定最终使用哪门语言。
 * preferred 为 'system'（或指定了一门还没上线的语言）时，
 * 按系统语言的优先级依次匹配，都没命中就退回英语。
 *
 * isSupported 用来把「已声明」和「真有字典」区分开：
 * 判断必须在遍历过程中做——否则系统首选语言一旦没字典，
 * 就会直接跳到英语，而不会去看用户排在后面的第二语言。
 */
export function resolveLocale(
  preferred: string | null | undefined,
  systemLanguages: readonly (string | null | undefined)[] | null | undefined,
  isSupported: (code: string) => boolean = (code) => BY_CODE.has(code.toLowerCase())
): string {
  const firstSupported = (tag: string | null | undefined): string | undefined =>
    candidatesFor(tag).find(isSupported)

  if (preferred && preferred !== 'system') {
    const explicit = firstSupported(preferred)
    if (explicit) return explicit
  }
  for (const tag of systemLanguages ?? []) {
    const hit = firstSupported(tag)
    if (hit) return hit
  }
  return DEFAULT_LOCALE
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

/**
 * 生成 t()。回退顺序：目标语言 → 声明的 fallback → 英语 → 键名本身。
 * 键名兜底是为了万一出问题时界面上能看出是哪个键，而不是空白。
 */
export function createTranslate(locale: string, dicts: Record<string, Dict>): Translate {
  const meta = localeMeta(locale)
  const chain = [meta.code, meta.fallback, DEFAULT_LOCALE].filter(
    (c): c is string => typeof c === 'string'
  )
  return (key, vars) => {
    let text: string | undefined
    for (const code of chain) {
      const hit = dicts[code]?.[key]
      if (hit !== undefined) {
        text = hit
        break
      }
    }
    if (text === undefined) return key
    if (!vars) return text
    return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole
    )
  }
}

/**
 * 带翻译键的错误：core 里的模块拿不到界面语言设置，
 * 所以只抛键，等冒泡到 IPC 边界再按当前语言翻成文案。
 * message 兜底填键名，万一漏翻也能看出是哪一条。
 */
export class LocalizedError extends Error {
  constructor(
    readonly key: TranslationKey,
    readonly vars?: Record<string, string | number>
  ) {
    super(key)
    this.name = 'LocalizedError'
  }
}

/** 把 LocalizedError 翻成当前语言；其它错误原样返回 */
export function localizeError(err: unknown, t: Translate): Error {
  if (err instanceof LocalizedError) {
    // 底层原因（ENOTFOUND / certificate / timeout…）附在括号里：用户截图报错时，这一行就是诊断依据
    const cause = (err as { cause?: unknown }).cause
    const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
    const detail = raw.split('\n')[0].trim().slice(0, 120)
    return new Error(detail ? `${t(err.key, err.vars)}（${detail}）` : t(err.key, err.vars))
  }
  return err instanceof Error ? err : new Error(String(err))
}
