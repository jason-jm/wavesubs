import type { TranslationKey } from './i18n/core'

export type PipelineStage = 'probe' | 'extract' | 'transcribe' | 'translate' | 'write'

export interface JobProgress {
  stage: PipelineStage
  /** 整个任务的总体进度 0-100 */
  percent: number
  /** 传键而不是成品文案，由渲染层按当前界面语言翻译 */
  messageKey?: TranslationKey
}

/** 字幕从哪来：语音识别 / 视频内嵌字幕轨 / 拖入的字幕文件 */
export type SubtitleSource =
  | { kind: 'asr' }
  | { kind: 'embedded'; subtitleIndex: number }
  | { kind: 'file' }

export interface JobRequest {
  /** 源语言 ISO 码，缺省自动检测 */
  language?: string
  /** 指定模型文件名，缺省用设置中选定的模型 */
  model?: string
  /** 缺省为语音识别 */
  source?: SubtitleSource
  /** 选用的音轨序号（0:a:N），缺省第一条 */
  audioIndex?: number
  /** 缺省沿用设置中的开关 */
  translate?: boolean
  targetLanguage?: string
  engine?: TranslationEngine
  /** engine 为 api 时指定用哪个云端服务 */
  providerId?: string
  format?: ExportFormat
  content?: ExportContent
  /** 忽略已有任务缓存，强制重新识别与翻译（结果仍会写入缓存） */
  refreshCache?: boolean
}

/**
 * 队列里单个文件的个别设置。只写想改的字段，没写的沿用批量页的全局设置。
 *
 * 为什么不直接存一份完整的 JobRequest：那样全局设置改了之后，已经加进队列的文件
 * 不会跟着变，用户改一次全局要挨个再改一遍。只存「差异」才能做到
 * 「默认全部跟随，个别文件另说」。
 */
export type BatchOverride = Partial<
  Pick<
    JobRequest,
    | 'language'
    | 'source'
    | 'audioIndex'
    | 'translate'
    | 'targetLanguage'
    | 'engine'
    | 'providerId'
    | 'format'
    | 'content'
  >
>

/** 批量队列里单个文件的状态 */
export type BatchStatus = 'waiting' | 'running' | 'done' | 'failed'

/**
 * 队列里的一项。
 *
 * 放在 shared 而不是 App.tsx：批量的合并逻辑（runBatchQueue）要用它，而那份逻辑
 * 有独立的自检脚本（scripts/check-batch.ts）。类型留在 .tsx 里，自检脚本一 import
 * 就会把整个 React 应用拖进主 tsconfig，报 "--jsx is not set"。
 */
export interface BatchEntry {
  id: string
  path: string
  name: string
  status: BatchStatus
  progress?: JobProgress
  result?: JobSummary
  error?: string
  /** 加入队列时就探测好，个别设置面板要靠它列出可选的音轨与字幕轨 */
  info?: MediaProbeInfo
  probing?: boolean
  probeError?: string
  /** 只存与全局设置的差异；为空表示完全跟随全局 */
  override?: BatchOverride
}

export interface SubtitleStreamView {
  subtitleIndex: number
  codec: string
  language?: string
  title?: string
  /** 图形字幕（PGS/VobSub 等）为 false，无法直接转文本 */
  textBased: boolean
  forced: boolean
  hearingImpaired: boolean
}

export interface MediaProbeInfo {
  /** 拖进来的是视频还是字幕文件 */
  kind: 'video' | 'subtitle'
  format: string
  durationSec: number
  audioStreams: Array<{
    audioIndex: number
    codec: string
    channels: number
    language?: string
    title?: string
  }>
  subtitleStreams: SubtitleStreamView[]
  /** 字幕文件专有：条目数与识别出的编码 */
  cueCount?: number
  encoding?: string
}

/**
 * 质检发现。kind 是稳定标识，文案由渲染层按界面语言生成；
 * atSec 给「第一处」的时间点，方便直接跳过去看。
 */
export interface QcFinding {
  kind: 'coverage' | 'gap' | 'overlong' | 'fastRate' | 'untranslated' | 'residual' | 'invalid'
  severity: 'warn' | 'bad'
  /** 数量类指标（条数、处数） */
  n?: number
  /** 百分比类指标（覆盖率） */
  pct?: number
  /** 第一处出现的时间点（秒） */
  atSec?: number
}

export interface QcReport {
  level: 'good' | 'warn' | 'bad'
  findings: QcFinding[]
}

/** 编辑器打开一条任务记录时拿到的视图（不含 rawCues/energy 等内部数据） */
export interface RecordView {
  inputPath: string
  /** 原始媒体的 wsmedia:// 地址；编辑器先试 <video> 直接播，播不动再退回片段预览 */
  mediaUrl?: string
  language: string
  durationSec: number
  cues: Array<{
    index: number
    startMs: number
    endMs: number
    text: string
    translation?: string
    srcEdited?: boolean
  }>
  /** 有译文元数据 = 这条记录跑过翻译，编辑器据此决定显不显示译文列 */
  hasTranslation: boolean
  targetLanguage?: string
  edited: boolean
  qc?: QcReport
}

/** 片段预览的产物：一串帧 + 一段音频（任一路可能缺失，取决于源文件有什么） */
export interface PreviewSegment {
  frames: string[]
  audio: string | null
  fps: number
  offsetMs: number
  durationMs: number
}

export interface JobSummary {
  outputPath: string
  language: string
  targetLanguage?: string
  cueCount: number
  translated: boolean
  translatedCount?: number
  /** 识别/抽取结果来自任务缓存（源文件与参数都没变，跳过了昂贵阶段） */
  sourceFromCache?: boolean
  /**
   * 译文复用情况。'all' = 引擎/目标语言/提示词/术语表全都没变，全部复用；
   * 'partial' = 只补翻了缺失或原文被改过的条目；'none' = 全部新翻。
   * 界面必须把这个如实亮出来——静默复用会让「换了模型怎么译文没变」变成灵异事件。
   */
  translationReuse?: 'none' | 'partial' | 'all'
  /** translationReuse 为 partial 时：复用了多少条、新翻了多少条 */
  translationReusedCount?: number
  translationFreshCount?: number
  /** 成品质检结论；给两端界面直接展示 */
  qc?: QcReport
}

export type ExportFormat = 'srt' | 'ass'
export type ExportContent = 'translated' | 'bilingual' | 'original'

export interface HardwareInfo {
  chip: string
  memGB: number
  appleSilicon: boolean
}

/** 模型在当前这台 Mac 上的适配程度 */
export type ModelFitness = 'great' | 'ok' | 'slow' | 'unfit'

/** asr = Whisper 语音识别模型；llm = 本地翻译大模型 */
export type ModelKind = 'asr' | 'llm'

export type TranslationEngine = 'local' | 'api'

/**
 * 术语表条目：把 from（人名、地名、术语）固定翻成 to。
 * 全局生效于所有翻译（单文件与批量走同一条管线），跨集数保持人名一致就靠它。
 */
export interface GlossaryEntry {
  from: string
  to: string
}

export interface ModelInfo {
  file: string
  name: string
  sizeMB: number
  /** 运行时大致需要的空闲内存 */
  ramGB: number
  /** 1-5 */
  quality: number
  /** 1-5 */
  speed: number
  /** 静态的 Mac 机型要求说明 */
  requirement: string
  detail: string
  recommendedDefault?: boolean
  installed: boolean
  downloading: boolean
  fitness: ModelFitness
}

export interface ModelsOverview {
  dir: string
  llmDir: string
  hardware: HardwareInfo
  /** 当前选定用于识别的模型文件名 */
  selected: string | null
  /** 当前选定用于本地翻译的模型文件名 */
  llmSelected: string | null
  models: ModelInfo[]
  llmModels: ModelInfo[]
}

export interface ModelDownloadProgress {
  kind: ModelKind
  file: string
  /** 总大小未知时为 -1 */
  percent: number
  receivedMB: number
  totalMB: number
}

/**
 * 云端服务说哪种协议。绝大多数厂商（OpenAI、DeepSeek、火山方舟、通义千问、
 * Moonshot、智谱、硅基流动、OpenRouter、Ollama 等）都是 openai；
 * Claude 原生接口和 Azure OpenAI 的地址与认证方式不一样，得单独走。
 */
export type CloudProtocol = 'openai' | 'anthropic' | 'azure'

/** 一个云端翻译服务的配置，可以配任意多个 */
export interface CloudProviderView {
  id: string
  name: string
  protocol: CloudProtocol
  baseUrl: string
  model: string
  hasApiKey: boolean
}

/** 新增或修改云端服务时传入；id 为空表示新增 */
export interface CloudProviderInput {
  id?: string
  name: string
  protocol: CloudProtocol
  baseUrl: string
  model: string
  /** 传字符串则更新，传 null 则清除，不传则保持不变 */
  apiKey?: string | null
}

export interface TranslationSettingsView {
  engine: TranslationEngine
  targetLanguage: string
  localModel: string | null
  providers: CloudProviderView[]
  /** 上次用的云端服务 */
  activeProviderId: string | null
  glossary: GlossaryEntry[]
}

export interface TranslationTestResult {
  ok: boolean
  message: string
}

/** 界面外观：跟随系统 / 强制浅色 / 强制深色 */
import type { ThemeSetting } from './palettes'
export type { ThemeSetting } from './palettes'

export type Appearance = 'system' | 'light' | 'dark'

export interface SettingsView {
  appearance: Appearance
  /** 渐变主题 */
  theme: ThemeSetting
  /** 用户的选择：'system' 或具体语言码 */
  language: string
  /** 实际生效的语言码（language 为 'system' 时是系统匹配的结果） */
  resolvedLanguage: string
  /** 系统语言匹配到的结果，用于「跟随系统（当前 X）」的提示 */
  systemLanguage: string
  translateEnabled: boolean
  translation: TranslationSettingsView
  export: { format: ExportFormat; content: ExportContent }
}

export interface SettingsUpdate {
  appearance?: Appearance
  theme?: Partial<ThemeSetting>
  language?: string
  translateEnabled?: boolean
  translation?: {
    engine?: TranslationEngine
    targetLanguage?: string
    localModel?: string
    activeProviderId?: string
    /** 整表替换。条目会被清洗（去空白、去重、截断），以清洗后的为准 */
    glossary?: GlossaryEntry[]
  }
  export?: { format?: ExportFormat; content?: ExportContent }
}

/** 主进程告诉界面的运行信息：版本号、平台、是否 App Store 版、生效的界面语言 */
export interface AppInfo {
  version: string
  platform: string
  mas: boolean
  locale: string
}
