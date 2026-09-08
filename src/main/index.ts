import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, protocol, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { translatorFor } from '../shared/i18n'
import { APP_STORE_REVIEW_URL, DISCUSSIONS_URL, SITE_URL, feedbackUrl, isAllowedExternalUrl } from '../shared/feedback'
import type { IpcMainInvokeEvent } from 'electron'
import { rmSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type {
  AppInfo,
  CloudProviderInput,
  ExportContent,
  ExportFormat,
  JobRequest,
  MediaProbeInfo,
  ModelInfo,
  ModelKind,
  ModelsOverview,
  RecordView,
  SettingsUpdate,
  SubtitleSource,
  TranslationTestResult
} from '../shared/types'
import { JobStore } from './core/jobstore'
import {
  allowMediaFile,
  allowMediaRoot,
  handleMediaRequest,
  MEDIA_SCHEME,
  mediaUrlFor
} from './media-protocol'
import { buildSegmentPreview, prunePreviewCache } from './core/preview'
import { tmpdir } from 'node:os'
import { computeQc } from './core/subtitle/qc'
import { resolveOutputPath, serializeCues } from './core/pipeline'
import { writeOutput } from './core/output'
import {
  findModelSpec,
  modelDownloadUrl,
  pickBestInstalled,
  VAD_MODEL_FILE,
  VAD_MODEL_URL,
  WHISPER_MODELS
} from './core/asr/catalog'
import { assessModelFitness, detectHardware } from './core/hardware'
import { probeMedia } from './core/media'
import { ModelDownloader } from './core/modelManager'
import { runSubtitleJob } from './core/pipeline'
import {
  isSubtitleFile,
  loadSubtitleFile,
  SUBTITLE_EXTENSIONS
} from './core/subtitle/import'
import {
  ffmpegPath,
  ffprobePath,
  listLocalLlmModels,
  listWhisperModels,
  setBundledBinDirs
} from './core/tools'
import { LlamaServerManager, LocalLlamaProvider } from './core/translate/llamaServer'
import { findLocalLlmSpec, LOCAL_LLM_MODELS, pickBestInstalledLlm } from './core/translate/localCatalog'
import { createCloudProvider } from './core/translate/createProvider'
import type { TranslationProvider } from './core/translate/types'
import { localizeError } from '../shared/i18n'
import { migrateLegacyUserData } from './migrate'
import { SettingsStore, describeSystemLanguages } from './settings'

/**
 * 侧边栏轨道宽度，必须与 App.css 里 .app 的第一列保持一致。
 * 交通灯要在这条窄轨道里居中，所以位置得由它算出来，不能写死。
 */
const RAIL_WIDTH = 88
/**
 * 交通灯的实际尺寸——是从截图上量出来的，不是按文档推的。
 * 之前按「12pt 圆点 + 8pt 间隔 = 52pt」算，结果偏了 4pt：
 * Electron 里实测圆点直径 14.3pt、中心间距 23pt，整组 60pt。
 */
const TRAFFIC_LIGHTS = { width: 60, height: 14 }
/** 顶部窗口栏高度，与 App.css 里 .app 的 --titlebar-h 一致；交通灯与 Windows 窗口按钮都居中在这一行 */
const TITLEBAR_HEIGHT = 38

/**
 * 必须在 app ready 之前注册：ready 后再注册特权 scheme 会被 Electron 忽略，
 * <video> 拿不到 stream/Range 能力，症状是能加载但完全没法 seek。
 */
protocol.registerSchemesAsPrivileged([
  { scheme: MEDIA_SCHEME, privileges: { stream: true, supportFetchAPI: true, bypassCSP: true } }
])

const PREVIEW_CACHE = join(tmpdir(), 'wavesubs-preview')

/** 成品写不回视频旁边时的去处：~/Movies/Wave Subs（沙盒版靠 assets.movies 权限写这里） */
const fallbackOutputDir = (): string => join(app.getPath('videos'), 'Wave Subs')

const VIDEO_EXTENSIONS = ['mkv', 'mp4', 'mov', 'avi', 'ts', 'm2ts', 'webm', 'flv', 'wmv', 'm4v']

function modelsDir(): string {
  // 开发期用项目内 models/，打包后用用户数据目录
  return app.isPackaged ? join(app.getPath('userData'), 'models') : join(process.cwd(), 'models')
}

function llmDir(): string {
  return join(modelsDir(), 'llm')
}

let settings: SettingsStore
let asrDownloader: ModelDownloader
let llmDownloader: ModelDownloader
const llamaManager = new LlamaServerManager()
let jobRunning = false

async function isFile(path: string): Promise<boolean> {
  return stat(path)
    .then((s) => s.isFile())
    .catch(() => false)
}

/** VAD 模型不到 1MB，缺失时静默补下；失败则本次不做时间校正，不阻塞任务 */
async function ensureVadModel(): Promise<string | undefined> {
  const path = join(modelsDir(), VAD_MODEL_FILE)
  if (await isFile(path)) return path
  try {
    await asrDownloader.download(VAD_MODEL_FILE, VAD_MODEL_URL)
    return path
  } catch {
    return undefined
  }
}

async function buildModelsOverview(): Promise<ModelsOverview> {
  const dir = modelsDir()
  const ldir = llmDir()
  const hardware = await detectHardware()
  const asrDownloading = new Set(asrDownloader.activeFiles())
  const llmDownloading = new Set(llmDownloader.activeFiles())

  // 目录里存的是翻译键，这里按当前界面语言解析成文案
  const t = settings.t

  const models: ModelInfo[] = await Promise.all(
    WHISPER_MODELS.map(async (spec) => ({
      ...spec,
      requirement: t(spec.requirement),
      detail: t(spec.detail),
      installed: await isFile(join(dir, spec.file)),
      downloading: asrDownloading.has(spec.file),
      fitness: assessModelFitness(spec, hardware)
    }))
  )
  const llmModels: ModelInfo[] = await Promise.all(
    LOCAL_LLM_MODELS.map(async ({ url: _url, ...spec }) => ({
      ...spec,
      requirement: t(spec.requirement),
      detail: t(spec.detail),
      installed: await isFile(join(ldir, spec.file)),
      downloading: llmDownloading.has(spec.file),
      fitness: assessModelFitness(spec, hardware)
    }))
  )

  const installedAsr = models.filter((m) => m.installed).map((m) => m.file)
  let selected = settings.selectedModel
  if (!selected || !installedAsr.includes(selected)) selected = pickBestInstalled(installedAsr)

  const installedLlm = llmModels.filter((m) => m.installed).map((m) => m.file)
  let llmSelected = settings.localLlmModel
  if (!llmSelected || !installedLlm.includes(llmSelected)) {
    llmSelected = pickBestInstalledLlm(installedLlm)
  }

  return { dir, llmDir: ldir, hardware, selected, llmSelected, models, llmModels }
}

function resolveDownload(
  kind: ModelKind,
  file: string
): { downloader: ModelDownloader; url: string } {
  if (kind === 'asr') {
    const spec = findModelSpec(file)
    if (!spec) throw new Error(settings.t('error.unknownModel', { file }))
    return { downloader: asrDownloader, url: modelDownloadUrl(file) }
  }
  const spec = findLocalLlmSpec(file)
  if (!spec) throw new Error(settings.t('error.unknownModel', { file }))
  return { downloader: llmDownloader, url: spec.url }
}

/**
 * 包一层 ipcMain.handle：core 深处抛出的 LocalizedError 只带翻译键，
 * 到这个边界才知道当前界面语言，统一翻成文案再回给渲染层。
 * 包在这里而不是逐个 handler 改，是为了以后新增的抛出点自动覆盖到。
 */
function handle(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: never[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(event, ...(args as never[]))
    } catch (err) {
      throw localizeError(err, settings.t)
    }
  })
}

function registerIpc(): void {
  handle('dialog:pickVideo', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: settings.t('dialog.videoAndSubtitle'),
          extensions: [...VIDEO_EXTENSIONS, ...SUBTITLE_EXTENSIONS]
        },
        { name: settings.t('dialog.video'), extensions: VIDEO_EXTENSIONS },
        { name: settings.t('dialog.subtitle'), extensions: [...SUBTITLE_EXTENSIONS] }
      ]
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  // 批量页要一次挑多个；单选那个保持原样不动
  handle('dialog:pickVideosMulti', async (): Promise<string[]> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: settings.t('dialog.videoAndSubtitle'),
          extensions: [...VIDEO_EXTENSIONS, ...SUBTITLE_EXTENSIONS]
        },
        { name: settings.t('dialog.video'), extensions: VIDEO_EXTENSIONS },
        { name: settings.t('dialog.subtitle'), extensions: [...SUBTITLE_EXTENSIONS] }
      ]
    })
    return canceled ? [] : filePaths
  })

  handle('media:probe', async (_event, path: string): Promise<MediaProbeInfo> => {
    if (isSubtitleFile(path)) {
      const loaded = await loadSubtitleFile(ffmpegPath(), path)
      return {
        kind: 'subtitle',
        format: extname(path).slice(1).toLowerCase() || 'subtitle',
        durationSec: (loaded.cues[loaded.cues.length - 1]?.endMs ?? 0) / 1000,
        audioStreams: [],
        subtitleStreams: [],
        cueCount: loaded.cues.length,
        encoding: loaded.encoding
      }
    }
    const info = await probeMedia(ffprobePath(), path)
    return {
      kind: 'video',
      format: info.format,
      durationSec: info.durationSec,
      audioStreams: info.audioStreams,
      subtitleStreams: info.subtitleStreams
    }
  })

  handle('models:overview', () => buildModelsOverview())

  handle('models:download', async (event, kind: ModelKind, file: string) => {
    const { downloader, url } = resolveDownload(kind, file)
    await downloader.download(file, url, (p) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('models:downloadProgress', { ...p, kind })
      }
    })
  })

  handle('models:cancelDownload', (_event, kind: ModelKind, file: string) => {
    ;(kind === 'asr' ? asrDownloader : llmDownloader).cancel(file)
  })

  handle('models:delete', async (_event, kind: ModelKind, file: string) => {
    if (kind === 'llm') llamaManager.stop()
    await (kind === 'asr' ? asrDownloader : llmDownloader).delete(file)
  })

  handle('models:select', (_event, kind: ModelKind, file: string) => {
    if (kind === 'asr') settings.setSelectedModel(file)
    else settings.update({ translation: { localModel: file } })
  })

  handle('settings:get', () => settings.view())

  handle('settings:update', (_event, patch: SettingsUpdate) => {
    const next = settings.update(patch)
    // 交给系统级的主题开关，prefers-color-scheme 会跟着变
    if (patch.appearance !== undefined) {
      nativeTheme.themeSource = patch.appearance
      refreshTitleBarOverlay()
    }
    // 菜单文案跟着界面语言走
    if (patch.language !== undefined) buildAppMenu()
    return next
  })

  handle('shell:openPath', (_event, path: string) => shell.openPath(path))
  handle('shell:openExternal', (_event, url: string) => {
    if (!isAllowedExternalUrl(url)) throw new Error(`refused to open ${url}`)
    return shell.openExternal(url)
  })
  handle('app:info', () => appInfo())

  handle('cloud:save', (_event, input: CloudProviderInput) => {
    settings.saveProvider(input)
    return settings.view()
  })

  handle('cloud:remove', (_event, id: string) => {
    settings.removeProvider(id)
    return settings.view()
  })

  handle('cloud:test', async (_event, id: string): Promise<TranslationTestResult> => {
    let config: ReturnType<SettingsStore['providerConfig']>
    try {
      config = settings.providerConfig(id)
    } catch (err) {
      // 钥匙串拒绝访问等：providerConfig 会抛已本地化的错误，原样展示
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
    if (!config) return { ok: false, message: settings.t('cloudTest.noKey') }
    try {
      const provider = createCloudProvider({
        ...config,
        targetLanguage: settings.targetLanguage
      })
      const result = await provider.translateBatch([{ index: 1, text: 'Good morning.' }], {
        sourceLanguage: 'en',
        targetLanguage: settings.targetLanguage
      })
      const sample = result.get(1)
      if (!sample) return { ok: false, message: settings.t('cloudTest.noTranslation') }
      return { ok: true, message: settings.t('cloudTest.ok', { sample }) }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  handle('job:run', async (event, input: string, request: JobRequest) => {
    if (jobRunning) throw new Error(settings.t('error.jobRunning'))
    const source: SubtitleSource = request.source ?? { kind: 'asr' }
    const dir = modelsDir()
    let modelPath: string | undefined
    if (source.kind === 'asr') {
      const installed = await listWhisperModels(dir)
      const modelFile =
        request.model && installed.includes(request.model)
          ? request.model
          : settings.selectedModel && installed.includes(settings.selectedModel)
            ? settings.selectedModel
            : pickBestInstalled(installed)
      if (!modelFile) {
        throw new Error(settings.t('error.noAsrModel', { dir }))
      }
      modelPath = join(dir, modelFile)
    }

    const translateWanted = request.translate ?? settings.translateEnabled
    let translate:
      | { provider: TranslationProvider; targetLanguage: string; engineId: string }
      | undefined
    if (translateWanted) {
      const engine = request.engine ?? settings.translationEngine
      const targetLanguage = request.targetLanguage ?? settings.targetLanguage
      if (engine === 'local') {
        const ldir = llmDir()
        const installedLlm = await listLocalLlmModels(ldir)
        const llmFile =
          settings.localLlmModel && installedLlm.includes(settings.localLlmModel)
            ? settings.localLlmModel
            : pickBestInstalledLlm(installedLlm)
        if (!llmFile) {
          throw new Error(settings.t('error.noLlmModel'))
        }
        translate = {
          provider: new LocalLlamaProvider(llamaManager, join(ldir, llmFile), targetLanguage),
          targetLanguage,
          engineId: `local|${llmFile}`
        }
      } else {
        const cloud = settings.providerConfig(request.providerId)
        if (!cloud) {
          throw new Error(settings.t('error.noApiKey'))
        }
        translate = {
          provider: createCloudProvider({ ...cloud, targetLanguage }),
          targetLanguage,
          engineId: `api|${cloud.id}|${cloud.model}`
        }
      }
    }
    const exportOptions = settings.exportOptions
    const format = request.format ?? exportOptions.format
    const content = request.content ?? exportOptions.content
    const output = translate ? { format, content } : { format, content: 'original' as const }

    jobRunning = true
    try {
      const result = await runSubtitleJob({
        input,
        modelPath,
        language: request.language === 'auto' ? undefined : request.language,
        vadModelPath: source.kind === 'asr' ? await ensureVadModel() : undefined,
        source,
        audioIndex: request.audioIndex,
        translate,
        output,
        cacheDir: join(app.getPath('userData'), 'jobcache'),
        fallbackOutputDir: fallbackOutputDir(),
        refreshCache: request.refreshCache,
        glossary: settings.glossary,
        onProgress: (p) => {
          if (!event.sender.isDestroyed()) event.sender.send('job:progress', p)
        }
      })
      return {
        outputPath: result.outputPath,
        language: result.language,
        targetLanguage: result.targetLanguage,
        cueCount: result.cueCount,
        translated: Boolean(translate),
        translatedCount: result.translatedCount,
        sourceFromCache: result.sourceFromCache,
        translationReuse: result.translationReuse,
        translationReusedCount: result.translationReusedCount,
        translationFreshCount: result.translationFreshCount,
        qc: result.qc
      }
    } finally {
      jobRunning = false
    }
  })

  handle('shell:reveal', (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  const jobStore = (): JobStore => new JobStore(join(app.getPath('userData'), 'jobcache'))

  handle('record:load', async (_event, inputPath: string): Promise<RecordView | null> => {
    const rec = await jobStore().load(inputPath)
    if (!rec) return null
    return {
      inputPath: rec.inputPath,
      language: rec.language,
      durationSec: rec.durationSec,
      // 顺手把输入文件授权给媒体协议：编辑器的直接播放模式要用
      mediaUrl: allowMediaFile(rec.inputPath),
      cues: rec.cues.map((c) => ({
        index: c.index,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
        translation: c.translation,
        srcEdited: c.srcEdited
      })),
      hasTranslation: Boolean(rec.translation),
      targetLanguage: rec.translation?.targetLanguage,
      edited: rec.edited,
      qc: rec.qc
    }
  })

  handle(
    'record:save',
    async (_event, inputPath: string, cues: RecordView['cues']): Promise<boolean> => {
      const store = jobStore()
      const rec = await store.load(inputPath)
      if (!rec) return false
      /**
       * 只更新最终字幕与编辑标记：rawCues / regions / energy 是识别产物，
       * 编辑器碰不到它们。edited=true 之后这条记录不再被时间轴算法升级自动重精修
       * ——人改过的时间轴比算法新版更该保住。
       */
      rec.cues = cues.map((c): (typeof rec.cues)[number] => ({
        index: c.index,
        startMs: Math.max(0, Math.round(c.startMs)),
        endMs: Math.max(1, Math.round(c.endMs)),
        text: c.text,
        ...(c.translation ? { translation: c.translation } : {}),
        ...(c.srcEdited ? { srcEdited: true } : {})
      }))
      rec.edited = true
      // 编辑之后质检结论会过期（改了时长/文本），就地重算保持诚实
      rec.qc = computeQc(rec.cues, rec.regions, {
        translated: Boolean(rec.translation),
        targetLanguage: rec.translation?.targetLanguage
      })
      await store.save(rec)
      return true
    }
  )

  handle(
    'preview:segment',
    async (
      _event,
      inputPath: string,
      spec: { startMs: number; endMs: number; audioIndex?: number }
    ) => {
      const built = await buildSegmentPreview(
        ffmpegPath(),
        { input: inputPath, startMs: spec.startMs, endMs: spec.endMs, audioIndex: spec.audioIndex },
        PREVIEW_CACHE
      )
      void prunePreviewCache(PREVIEW_CACHE)
      return {
        frames: built.frames.map(mediaUrlFor),
        audio: built.audio ? mediaUrlFor(built.audio) : null,
        fps: built.fps,
        offsetMs: built.offsetMs,
        durationMs: built.durationMs
      }
    }
  )

  handle(
    'record:export',
    async (
      _event,
      inputPath: string,
      output: { format: ExportFormat; content: ExportContent }
    ): Promise<string> => {
      const rec = await jobStore().load(inputPath)
      if (!rec) throw new Error(settings.t('editor.error.noRecord'))
      const outputPath = resolveOutputPath({
        input: inputPath,
        isSubtitleInput: rec.sourceKey === 'file',
        language: rec.language,
        targetLanguage: output.content === 'original' ? undefined : rec.translation?.targetLanguage,
        format: output.format,
        content: output.content
      })
      return writeOutput(
        outputPath,
        serializeCues(rec.cues, output.format, output.content),
        fallbackOutputDir()
      )
    }
  )
}

/**
 * Windows 的窗口按钮叠加层配置。
 *
 * 背景必须全透明，主题渐变才能透上去；按钮符号的颜色则要跟着深浅色走——
 * 写死一个深色，切到深色主题后按钮会糊在深色背景上几乎看不见。
 * macOS 用不到这个（交通灯由系统按主题自己画）。
 */
function titleBarOverlay(): { color: string; symbolColor: string; height: number } {
  return {
    color: '#00000000',
    symbolColor: nativeTheme.shouldUseDarkColors ? '#e8e9f0' : '#3a3f52',
    height: TITLEBAR_HEIGHT
  }
}

/** 主题变化后重画窗口按钮；只有 Windows 需要，macOS 的交通灯是系统自己管的 */
function refreshTitleBarOverlay(): void {
  if (process.platform === 'darwin') return
  for (const win of BrowserWindow.getAllWindows()) {
    win.setTitleBarOverlay?.(titleBarOverlay())
  }
}

function appInfo(): AppInfo {
  return { version: app.getVersion(), platform: process.platform, mas: Boolean(process.mas), locale: settings.resolvedLanguage }
}

/**
 * 自建应用菜单：不建的话 Electron 默认的「帮助」菜单指向 Electron 自己的文档，
 * 这里换成我们的反馈入口。标准项用 role，Electron 会按系统语言自动本地化。
 */
function buildAppMenu(): void {
  const t = translatorFor(settings.resolvedLanguage)
  const info = appInfo()
  const open = (url: string) => (): void => {
    void shell.openExternal(url)
  }
  const help: MenuItemConstructorOptions[] = [
    { label: t('help.feedback'), click: open(feedbackUrl(info.version, info.platform, info.locale)) },
    { label: t('help.discussions'), click: open(DISCUSSIONS_URL) },
    { label: t('help.website'), click: open(SITE_URL) }
  ]
  if (info.mas) help.push({ type: 'separator' }, { label: t('help.rate'), click: open(APP_STORE_REVIEW_URL) })
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: help }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1060,
    height: 840,
    minWidth: 880,
    minHeight: 620,
    title: 'Wave Subs',
    /**
     * 两个平台都是「无边框 + 顶部一条 38px 的窗口栏」，窗口按钮画在这条栏里，内容从栏下面开始：
     * - macOS：hiddenInset 保留交通灯，垂直居中在栏里、水平居中在轨道列上
     * - Windows：hidden + titleBarOverlay，系统把最小化/最大化/关闭画在栏的右端。
     *   叠加层背景设成全透明，主题渐变才能透上去；高度与栏一致，按钮就不会压到内容卡片的边框。
     */
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: {
            x: Math.round((RAIL_WIDTH - TRAFFIC_LIGHTS.width) / 2),
            y: Math.round((TITLEBAR_HEIGHT - TRAFFIC_LIGHTS.height) / 2)
          }
        }
      : { titleBarStyle: 'hidden' as const, titleBarOverlay: titleBarOverlay() }),
    // 不再用系统毛玻璃：整扇窗铺的是主题渐变，材质会被完全盖住，留着只是白耗 GPU。
    // 背景色取默认配色（海雾）渐变的中间色，避免加载瞬间闪一下白底。
    // 改默认配色时这里要一起改——它不走主题变量。
    backgroundColor: '#AEC7E0',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  protocol.handle(MEDIA_SCHEME, handleMediaRequest)
  allowMediaRoot(PREVIEW_CACHE)
  // 必须在 SettingsStore 之前：它一构造就会往新目录写 settings.json，
  // 那之后迁移逻辑会认为"新目录已有数据"而整个跳过，旧设置就永远搬不过来了
  // 打包版一律优先用随包的 ffmpeg / whisper / llama，而不是用户机器上可能存在的其它版本
  if (app.isPackaged) {
    const vendor = join(process.resourcesPath, 'vendor')
    /**
     * macOS 的 whisper/llama 是自编静态版，后端已链进二进制，一个目录装下所有东西。
     * Windows 用官方预编译包，whisper 和 llama 各自带同名不同版本的 ggml DLL，
     * 必须分目录放，否则 Windows 按 exe 同目录找 DLL 时会串版本。
     */
    setBundledBinDirs(
      process.platform === 'win32'
        ? [join(vendor, 'ffmpeg'), join(vendor, 'whisper'), join(vendor, 'llama')]
        : [join(vendor, 'bin')]
    )
  } else {
    setBundledBinDirs([])
  }

  const moved = migrateLegacyUserData()
  if (moved.migrated) {
    console.log(
      `[migrate] 已从旧目录 subflow 迁移设置` +
        (moved.movedModels ? '，模型目录一并搬过来了' : '') +
        (moved.droppedKeys > 0
          ? `；${moved.droppedKeys} 个云端服务的 API Key 因为改名后钥匙串条目重建而失效，需要重填`
          : '')
    )
  }
  settings = new SettingsStore()
  nativeTheme.themeSource = settings.appearance
  // 「跟随系统」时用户在系统里切深浅色，这里也要跟着重画窗口按钮
  nativeTheme.on('updated', refreshTitleBarOverlay)
  console.log(`[i18n] 系统语言 ${describeSystemLanguages()} → 界面 ${settings.resolvedLanguage}`)
  // 用 Chromium 网络栈下载：认系统代理（Node 自带的 fetch 不认，开了系统代理也连不上被墙的 huggingface.co）
  const fetchViaChromium = (input: string, init: RequestInit): Promise<Response> => net.fetch(input, init)
  asrDownloader = new ModelDownloader(modelsDir(), { fetch: fetchViaChromium })
  llmDownloader = new ModelDownloader(llmDir(), { fetch: fetchViaChromium })
  registerIpc()
  buildAppMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  llamaManager.stop()
  // 预览帧是纯派生物，退出全删；下次要看重新生成即可
  rmSync(PREVIEW_CACHE, { recursive: true, force: true })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
