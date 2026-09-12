import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  Appearance,
  CloudProtocol,
  CloudProviderInput,
  ExportContent,
  ExportFormat,
  GlossaryEntry,
  SettingsUpdate,
  SettingsView,
  TranslationEngine
} from '../shared/types'
import type { Translate } from '../shared/i18n'
import { DEFAULT_THEME, LEGACY_DEFAULT_GRAIN, type ThemeSetting } from '../shared/palettes'
import { execFileSync } from 'node:child_process'
import { pickLocale, translatorFor } from '../shared/i18n'
import { targetForUiLocale } from '../shared/targetLanguages'
import { normalizeBaseUrl } from './core/translate/openaiCompatible'
import { normalizeAnthropicBaseUrl } from './core/translate/anthropic'

/**
 * 系统语言优先级列表。macOS 会给出 ['zh-Hans-CN', 'en-US'] 这样的有序数组，
 * 老版本 Electron 没这个 API 时退回单个 locale。
 */
/**
 * Windows 的「显示语言」。Electron 的 getPreferredSystemLanguages 在部分机器上只给出
 * 安装时的语言（如 en-US），而用户在设置里改的显示语言写在这个注册表项里，
 * 这才是用户眼里的「系统语言」。REG_MULTI_SZ 由 reg.exe 打印成 "zh-CN\\0en-US"。
 */
let windowsDisplayLanguagesCache: string[] | null = null
function windowsDisplayLanguages(): string[] {
  if (process.platform !== 'win32') return []
  if (windowsDisplayLanguagesCache) return windowsDisplayLanguagesCache
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'PreferredUILanguages'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 3000
    })
    const line = out.split(/\r?\n/).find((l) => /PreferredUILanguages/i.test(l)) ?? ''
    const value = line.split(/\s+REG_MULTI_SZ\s+/)[1] ?? ''
    windowsDisplayLanguagesCache = value
      .split('\\0')
      .map((t) => t.trim())
      .filter(Boolean)
  } catch {
    windowsDisplayLanguagesCache = []
  }
  return windowsDisplayLanguagesCache
}

function systemLanguages(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (tag: string | null | undefined): void => {
    if (tag && !seen.has(tag)) {
      seen.add(tag)
      out.push(tag)
    }
  }
  for (const tag of windowsDisplayLanguages()) push(tag)
  for (const tag of app.getPreferredSystemLanguages?.() ?? []) push(tag)
  // 再补上系统区域与 Chromium 的 locale；Node 的 ICU 默认区域反映的是「区域格式」设置
  push(app.getSystemLocale?.())
  push(app.getLocale())
  try {
    push(Intl.DateTimeFormat().resolvedOptions().locale)
  } catch {
    /* 没有 ICU 数据时跳过 */
  }
  return out
}

/** 启动时打一行，用户反馈「没跟随系统语言」时能直接对照 */
export function describeSystemLanguages(): string {
  return systemLanguages().join(', ')
}

interface StoredProvider {
  id: string
  name: string
  /** 老配置里没这个字段，读出来按 openai 处理 */
  protocol?: CloudProtocol
  baseUrl: string
  model: string
  /** safeStorage 加密后的 base64；无加密能力时带 plain: 前缀 */
  apiKeyEnc?: string
}

/** 各协议的地址写法不同，Azure 的部署名和 api-version 要原样留着，请求时再拼 */
function normalizeUrlFor(protocol: CloudProtocol, raw: string): string {
  if (protocol === 'anthropic') return normalizeAnthropicBaseUrl(raw)
  if (protocol === 'azure') return raw.trim().replace(/\/+$/, '')
  return normalizeBaseUrl(raw)
}

interface StoredSettings {
  appearance: Appearance
  theme: ThemeSetting
  /** 颗粒默认值的版本：1 = 0.5（1.0.0），2 = 0.1（1.0.1 起）。用来只迁移一次 */
  grainDefaultRev?: number
  /** 'system' 表示跟随系统语言 */
  language: string
  selectedModel?: string
  translateEnabled: boolean
  signsEnabled?: boolean
  translation: {
    engine: TranslationEngine
    targetLanguage: string
    localModel?: string
    providers: StoredProvider[]
    activeProviderId?: string
    glossary?: GlossaryEntry[]
  }
  export: { format: ExportFormat; content: ExportContent }
  /** 旧版单一云端配置，仅用于迁移 */
  legacy?: { baseUrl?: string; model?: string; apiKeyEnc?: string }
}

const GRAIN_DEFAULT_REV = 2

const DEFAULTS: StoredSettings = {
  appearance: 'system',
  theme: { ...DEFAULT_THEME },
  grainDefaultRev: GRAIN_DEFAULT_REV,
  language: 'system',
  translateEnabled: false,
  translation: {
    engine: 'local',
    targetLanguage: 'zh',
    providers: []
  },
  export: { format: 'srt', content: 'translated' }
}

export class SettingsStore {
  private data: StoredSettings
  private readonly path: string
  private migrated = false

  constructor() {
    this.path = join(app.getPath('userData'), 'settings.json')
    this.data = this.load()
    const migrated = migrateGrain({ ...DEFAULT_THEME, ...this.data.theme }, this.data.grainDefaultRev)
    if (migrated.grain !== this.data.theme?.grain || this.data.grainDefaultRev !== GRAIN_DEFAULT_REV) {
      this.data.theme = migrated
      this.data.grainDefaultRev = GRAIN_DEFAULT_REV
      this.save()
    }
    // 迁移过就立刻落盘，免得旧字段一直残留、下次启动重复迁移
    if (this.migrated) this.save()
  }

  private load(): StoredSettings {
    let raw: Record<string, unknown> = {}
    try {
      raw = JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, unknown>
    } catch {
      // 全新安装：翻译目标跟随系统语言，而不是一律中文
      const fresh = structuredClone(DEFAULTS)
      fresh.translation.targetLanguage = targetForUiLocale(pickLocale('system', systemLanguages()))
      return fresh
    }
    const t = (raw.translation ?? {}) as Record<string, unknown>
    const data: StoredSettings = {
      ...DEFAULTS,
      ...(raw as Partial<StoredSettings>),
      translation: {
        engine: (t.engine as TranslationEngine) ?? DEFAULTS.translation.engine,
        targetLanguage: (t.targetLanguage as string) ?? DEFAULTS.translation.targetLanguage,
        localModel: t.localModel as string | undefined,
        providers: Array.isArray(t.providers) ? (t.providers as StoredProvider[]) : [],
        activeProviderId: t.activeProviderId as string | undefined,
        glossary: sanitizeGlossary(t.glossary)
      },
      export: { ...DEFAULTS.export, ...(raw.export as object) }
    }
    // 旧版只能配一个云端服务，迁移成列表里的第一项
    if (data.translation.providers.length === 0 && typeof t.baseUrl === 'string') {
      const migrated: StoredProvider = {
        id: randomUUID(),
        name: guessProviderName(t.baseUrl),
        baseUrl: t.baseUrl,
        model: (t.model as string) ?? '',
        apiKeyEnc: t.apiKeyEnc as string | undefined
      }
      data.translation.providers = [migrated]
      data.translation.activeProviderId = migrated.id
      this.migrated = true
    }
    delete data.legacy
    return data
  }

  private save(): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf8')
  }

  view(): SettingsView {
    const { providers, activeProviderId } = this.data.translation
    return {
      appearance: this.data.appearance,
      // 旧版设置文件里没有 theme 字段，读出来是 undefined，补上默认值
      theme: { ...DEFAULT_THEME, ...this.data.theme },
      language: this.data.language,
      resolvedLanguage: this.resolvedLanguage,
      systemLanguage: pickLocale('system', systemLanguages()),
      systemLanguageTags: systemLanguages(),
      translateEnabled: this.data.translateEnabled,
      signsEnabled: Boolean(this.data.signsEnabled),
      translation: {
        engine: this.data.translation.engine,
        targetLanguage: this.data.translation.targetLanguage,
        localModel: this.data.translation.localModel ?? null,
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          protocol: p.protocol ?? 'openai',
          baseUrl: p.baseUrl,
          model: p.model,
          hasApiKey: Boolean(p.apiKeyEnc)
        })),
        activeProviderId:
          activeProviderId && providers.some((p) => p.id === activeProviderId)
            ? activeProviderId
            : (providers[0]?.id ?? null),
        glossary: (this.data.translation.glossary ?? []).map((g) => ({ ...g }))
      },
      export: { ...this.data.export }
    }
  }

  update(patch: SettingsUpdate): SettingsView {
    if (patch.appearance !== undefined) this.data.appearance = patch.appearance
    if (patch.theme) {
      this.data.theme = { ...DEFAULT_THEME, ...this.data.theme, ...patch.theme }
    }
    if (patch.language !== undefined) this.data.language = patch.language
    if (patch.translateEnabled !== undefined) this.data.translateEnabled = patch.translateEnabled
    if (patch.signsEnabled !== undefined) this.data.signsEnabled = patch.signsEnabled
    if (patch.translation) {
      const t = patch.translation
      if (t.engine !== undefined) this.data.translation.engine = t.engine
      if (t.localModel !== undefined) this.data.translation.localModel = t.localModel
      if (t.targetLanguage !== undefined) this.data.translation.targetLanguage = t.targetLanguage
      if (t.activeProviderId !== undefined) {
        this.data.translation.activeProviderId = t.activeProviderId
      }
      if (t.glossary !== undefined) {
        this.data.translation.glossary = sanitizeGlossary(t.glossary)
      }
    }
    if (patch.export) {
      if (patch.export.format) this.data.export.format = patch.export.format
      if (patch.export.content) this.data.export.content = patch.export.content
    }
    this.save()
    return this.view()
  }

  /** 新增或修改一个云端服务，返回它的 id */
  saveProvider(input: CloudProviderInput): string {
    const list = this.data.translation.providers
    const existing = input.id ? list.find((p) => p.id === input.id) : undefined
    const target: StoredProvider = existing ?? {
      id: randomUUID(),
      name: '',
      baseUrl: '',
      model: ''
    }
    target.protocol = input.protocol
    target.name = input.name.trim() || guessProviderName(input.baseUrl)
    target.baseUrl = normalizeUrlFor(input.protocol, input.baseUrl)
    target.model = input.model.trim()
    if (input.apiKey === null) delete target.apiKeyEnc
    else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      target.apiKeyEnc = encryptKey(input.apiKey.trim())
    }
    if (!existing) {
      list.push(target)
      this.data.translation.activeProviderId ??= target.id
    }
    this.save()
    return target.id
  }

  removeProvider(id: string): void {
    const list = this.data.translation.providers
    const at = list.findIndex((p) => p.id === id)
    if (at >= 0) list.splice(at, 1)
    if (this.data.translation.activeProviderId === id) {
      this.data.translation.activeProviderId = list[0]?.id
    }
    this.save()
  }

  /**
   * 取出可直接用于调用的完整配置（含解密后的 Key）。
   *
   * 「没配 Key」和「配了但解不开」必须分开报：后者发生在用户对钥匙串弹窗点了
   * 「拒绝」、或应用改名/重签后旧条目对不上时。早先两种都返回 null，界面一边显示
   * 「已配置」一边报「还没配置 API Key」，自相矛盾。
   */
  providerConfig(id?: string): {
    id: string
    name: string
    protocol: CloudProtocol
    baseUrl: string
    model: string
    apiKey: string
  } | null {
    const { providers, activeProviderId } = this.data.translation
    const p = providers.find((x) => x.id === (id ?? activeProviderId)) ?? providers[0]
    if (!p) return null
    if (!p.apiKeyEnc) return null
    const apiKey = decryptKey(p.apiKeyEnc)
    if (!apiKey) throw new Error(this.t('error.keychainLocked', { name: p.name }))
    return {
      id: p.id,
      name: p.name,
      protocol: p.protocol ?? 'openai',
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey
    }
  }

  hasProvider(id?: string): boolean {
    const { providers, activeProviderId } = this.data.translation
    return Boolean(providers.find((x) => x.id === (id ?? activeProviderId)) ?? providers[0])
  }

  get appearance(): Appearance {
    return this.data.appearance
  }

  /** 实际生效的界面语言：显式选了就用它，选了跟随系统就按系统语言匹配 */
  get resolvedLanguage(): string {
    return pickLocale(this.data.language, systemLanguages())
  }

  /** 主进程侧的 t()，用于错误提示等由主进程产出的文案 */
  get t(): Translate {
    return translatorFor(this.resolvedLanguage)
  }

  get targetLanguage(): string {
    return this.data.translation.targetLanguage
  }

  get translationEngine(): TranslationEngine {
    return this.data.translation.engine
  }

  get localLlmModel(): string | null {
    return this.data.translation.localModel ?? null
  }

  get translateEnabled(): boolean {
    return this.data.translateEnabled
  }

  get signsEnabled(): boolean {
    return Boolean(this.data.signsEnabled)
  }

  /** 翻译管线要用的术语表（已清洗）。空表返回 []，调用方不用判空 */
  get glossary(): GlossaryEntry[] {
    return (this.data.translation.glossary ?? []).map((g) => ({ ...g }))
  }

  get exportOptions(): { format: ExportFormat; content: ExportContent } {
    return { ...this.data.export }
  }

  get selectedModel(): string | null {
    return this.data.selectedModel ?? null
  }

  setSelectedModel(file: string): void {
    this.data.selectedModel = file
    this.save()
  }
}

/** 没填名字时按域名猜一个，省得用户还要想叫什么 */
function guessProviderName(baseUrl: string): string {
  const host = /https?:\/\/([^/]+)/.exec(baseUrl)?.[1] ?? ''
  if (host.includes('volces')) return '火山方舟'
  if (host.includes('openai')) return 'OpenAI'
  if (host.includes('deepseek')) return 'DeepSeek'
  if (host.includes('dashscope')) return '通义千问'
  if (host.includes('moonshot')) return 'Moonshot'
  if (host.includes('anthropic')) return 'Anthropic Claude'
  if (host.includes('azure')) return 'Azure OpenAI'
  if (host.includes('bigmodel')) return '智谱 GLM'
  if (host.includes('siliconflow')) return '硅基流动'
  if (host.includes('openrouter')) return 'OpenRouter'
  if (host.includes('qingcloud')) return '青云'
  if (host.includes('localhost') || host.includes('127.0.0.1')) return '本机服务'
  return host || '未命名服务'
}

/**
 * 1.0.0 把颗粒默认成 0.5，用户装上就会把 0.5 写进设置文件。1.0.1 想把默认降到 0.1，
 * 但设置里已经有值了，普通的「缺省补齐」碰不到它。只在文件仍是旧版本号、且值恰好
 * 等于旧默认时改——手动调过的（不等于 0.5）一律不动。
 */
function migrateGrain(theme: ThemeSetting, rev: number | undefined): ThemeSetting {
  if ((rev ?? 1) < GRAIN_DEFAULT_REV && theme.grain === LEGACY_DEFAULT_GRAIN) {
    return { ...theme, grain: DEFAULT_THEME.grain }
  }
  return theme
}

const GLOSSARY_MAX_ENTRIES = 200
const GLOSSARY_MAX_LEN = 80

/**
 * 术语表清洗：去空白、去掉残缺条目、按原文去重（不区分大小写，后写的赢）、
 * 限制长度与条数。上限不是拍的：提示词按命中过滤后每批最多注入 40 条，
 * 全表 200 条已远超一部剧集的人名量，再大多半是误操作粘贴。
 */
function sanitizeGlossary(raw: unknown): GlossaryEntry[] {
  if (!Array.isArray(raw)) return []
  const byFrom = new Map<string, GlossaryEntry>()
  for (const item of raw) {
    const from = String((item as GlossaryEntry)?.from ?? '').trim().slice(0, GLOSSARY_MAX_LEN)
    const to = String((item as GlossaryEntry)?.to ?? '').trim().slice(0, GLOSSARY_MAX_LEN)
    if (!from || !to) continue
    byFrom.set(from.toLowerCase(), { from, to })
  }
  return [...byFrom.values()].slice(0, GLOSSARY_MAX_ENTRIES)
}

function encryptKey(key: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(key).toString('base64')
  }
  return `plain:${Buffer.from(key, 'utf8').toString('base64')}`
}

function decryptKey(enc: string): string | null {
  if (enc.startsWith('plain:')) return Buffer.from(enc.slice(6), 'base64').toString('utf8')
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}
