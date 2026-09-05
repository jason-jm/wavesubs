import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BatchEntry,
  BatchOverride,
  JobProgress,
  JobRequest,
  JobSummary,
  ModelDownloadProgress,
  ModelKind,
  ModelsOverview,
  SettingsUpdate,
  SettingsView
} from '../../shared/types'
import type { TranslationKey } from '../../shared/i18n'
import { DEFAULT_LOCALE, translatorFor } from '../../shared/i18n'
import { I18nProvider } from './i18n'
import { applyTheme } from './theme'
import { DEFAULT_THEME } from '../../shared/palettes'
import { Icon, type IconName } from './components/Icon'
import { fileNameOf } from './lib/paths'
import { runBatchQueue } from './lib/runBatchQueue'
import { BatchView } from './views/BatchView'
import { EditorView } from './views/EditorView'
import { HomeView } from './views/HomeView'
import { ModelsView } from './views/ModelsView'
import { SettingsPage } from './views/SettingsPage'

export type JobState =
  | { kind: 'idle' }
  | { kind: 'running'; progress: JobProgress; input: string }
  | { kind: 'done'; result: JobSummary }
  | { kind: 'error'; message: string }

export type { BatchStatus, BatchEntry } from '../../shared/types'

export function stripIpcErrorPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}

type ViewId = 'home' | 'batch' | 'models' | 'settings' | 'editor'

interface NavItem {
  id: ViewId
  icon: IconName
  labelKey: TranslationKey
  captionKey: TranslationKey
}

const NAV: NavItem[] = [
  { id: 'home', icon: 'convert', labelKey: 'nav.home', captionKey: 'nav.home.caption' },
  { id: 'batch', icon: 'batch', labelKey: 'nav.batch', captionKey: 'nav.batch.caption' },
  { id: 'models', icon: 'models', labelKey: 'nav.models', captionKey: 'nav.models.caption' }
]

/** 设置属于低频入口，钉在侧边栏底部 */
const SETTINGS_NAV: NavItem = {
  id: 'settings',
  icon: 'settings',
  labelKey: 'nav.settings',
  captionKey: 'nav.settings.caption'
}

const ALL_NAV = [...NAV, SETTINGS_NAV]

export type ModelTab = 'asr' | 'llm' | 'cloud' | 'glossary'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('home')
  const [modelTab, setModelTab] = useState<ModelTab>('asr')
  /** 编辑器正在编辑哪个输入文件；同时记住从哪来，返回时回去 */
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const editorFrom = useRef<ViewId>('home')
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [overview, setOverview] = useState<ModelsOverview | null>(null)
  const [downloads, setDownloads] = useState<Record<string, ModelDownloadProgress>>({})
  const [modelError, setModelError] = useState<string | null>(null)
  const [jobState, setJobState] = useState<JobState>({ kind: 'idle' })
  /** 单文件页最近一次任务的输入路径——完成卡片的「编辑字幕」要用它定位记录 */
  const [lastInput, setLastInput] = useState<string | null>(null)
  const [batch, setBatch] = useState<BatchEntry[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchStopping, setBatchStopping] = useState(false)
  /**
   * 队列的单一真相。异步循环里直接读 React state 会拿到渲染那一刻的旧值，
   * 所以写入时同步更新 ref，循环只认 ref。
   */
  const batchRef = useRef<BatchEntry[]>([])
  const stopRef = useRef(false)
  /**
   * 探测串成一条链而不是并发发起：素材多半在网络盘上，同时探十几个文件
   * 只会互相抢带宽，最后每个都慢。
   */
  const probeChain = useRef<Promise<void>>(Promise.resolve())

  const patchBatch = useCallback((fn: (prev: BatchEntry[]) => BatchEntry[]) => {
    batchRef.current = fn(batchRef.current)
    setBatch(batchRef.current)
  }, [])

  const refreshOverview = useCallback(() => {
    void window.waveSubs.modelsOverview().then(setOverview)
  }, [])

  useEffect(() => {
    void window.waveSubs.getSettings().then(setSettings)
    refreshOverview()
    const offJob = window.waveSubs.onJobProgress((progress) => {
      setJobState((prev) => (prev.kind === 'running' ? { ...prev, progress } : prev))
      // 批量是串行跑的，同一时刻至多一项处于 running
      batchRef.current = batchRef.current.map((e) =>
        e.status === 'running' ? { ...e, progress } : e
      )
      setBatch(batchRef.current)
    })
    const offDownload = window.waveSubs.onModelDownloadProgress((p) => {
      setDownloads((prev) => ({ ...prev, [p.file]: p }))
    })
    return () => {
      offJob()
      offDownload()
    }
  }, [refreshOverview])

  const updateSettings = useCallback((patch: SettingsUpdate) => {
    return window.waveSubs.updateSettings(patch).then(setSettings)
  }, [])

  const runJob = useCallback(async (input: string, request: JobRequest) => {
    setJobState({ kind: 'running', input, progress: { stage: 'probe', percent: 0 } })
    try {
      setLastInput(input)
      const result = await window.waveSubs.runJob(input, request)
      setJobState({ kind: 'done', result })
    } catch (err) {
      const message = err instanceof Error ? stripIpcErrorPrefix(err.message) : String(err)
      setJobState({ kind: 'error', message })
    }
  }, [])

  /**
   * 逐个探测新加进来的文件，把轨道信息补回队列项上。
   * 有了它，用户在开跑之前就能看到「这个文件会走语音识别、那个有现成字幕轨」，
   * 也才有的可选——否则单独设置面板里根本列不出轨道。
   */
  const probeEntries = useCallback(
    (targets: Array<{ id: string; path: string }>) => {
      probeChain.current = probeChain.current.then(async () => {
        for (const { id, path } of targets) {
          // 探测期间用户可能已经把它移除了
          if (!batchRef.current.some((e) => e.id === id)) continue
          try {
            const info = await window.waveSubs.probeMedia(path)
            patchBatch((prev) =>
              prev.map((e) => (e.id === id ? { ...e, info, probing: false } : e))
            )
          } catch (err) {
            const message = err instanceof Error ? stripIpcErrorPrefix(err.message) : String(err)
            // 探不出来不算失败：跑的时候还会再探一次，那时的报错才是准的
            patchBatch((prev) =>
              prev.map((e) => (e.id === id ? { ...e, probing: false, probeError: message } : e))
            )
          }
        }
      })
    },
    [patchBatch]
  )

  /** 加入队列，返回被跳过的重复文件数 */
  const addToBatch = useCallback(
    (paths: string[]): number => {
      // 既要和队列里已有的比，也要处理本次传入自带的重复
      const known = new Set(batchRef.current.map((e) => e.path))
      const fresh: string[] = []
      for (const path of paths) {
        if (known.has(path)) continue
        known.add(path)
        fresh.push(path)
      }
      const added = fresh.map((path, i) => ({
        id: `${Date.now()}-${i}-${path}`,
        path,
        name: fileNameOf(path),
        status: 'waiting' as const,
        probing: true
      }))
      patchBatch((prev) => [...prev, ...added])
      probeEntries(added.map((e) => ({ id: e.id, path: e.path })))
      return paths.length - fresh.length
    },
    [patchBatch, probeEntries]
  )

  /**
   * 改某一项的个别设置。传 undefined 表示恢复成跟随全局。
   * 存的是「差异」而不是完整请求，所以之后改全局设置，没被单独指定的字段仍会跟着变。
   */
  const setBatchOverride = useCallback(
    (id: string, override: BatchOverride | undefined) => {
      patchBatch((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e
          const next = { ...e }
          if (override && Object.keys(override).length > 0) next.override = override
          else delete next.override
          return next
        })
      )
    },
    [patchBatch]
  )

  const removeFromBatch = useCallback(
    (id: string) => {
      // 正在跑的那一项不让移除，否则进度事件会落到空处
      patchBatch((prev) => prev.filter((e) => e.id !== id || e.status === 'running'))
    },
    [patchBatch]
  )

  const clearBatch = useCallback(() => {
    patchBatch((prev) => prev.filter((e) => e.status === 'running'))
  }, [patchBatch])

  const stopBatch = useCallback(() => {
    stopRef.current = true
    setBatchStopping(true)
  }, [])

  const startBatch = useCallback(
    async (request: JobRequest) => {
      if (batchRef.current.some((e) => e.status === 'running')) return
      stopRef.current = false
      setBatchStopping(false)
      setBatchRunning(true)
      try {
        await runBatchQueue(request, {
          probe: (path) => window.waveSubs.probeMedia(path),
          run: (path, req) => window.waveSubs.runJob(path, req),
          getEntries: () => batchRef.current,
          patch: patchBatch,
          shouldStop: () => stopRef.current,
          toMessage: (err) =>
            err instanceof Error ? stripIpcErrorPrefix(err.message) : String(err)
        })
      } finally {
        setBatchRunning(false)
        setBatchStopping(false)
        stopRef.current = false
      }
    },
    [patchBatch]
  )

  const openEditor = useCallback((path: string, from: ViewId) => {
    editorFrom.current = from
    setEditorPath(path)
    setView('editor')
  }, [])

  // 仅开发模式的冒烟钩子：让浏览器自动化不用先跑完一个真任务就能进编辑器
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { __openEditor?: typeof openEditor }).__openEditor = openEditor
    }
  }, [openEditor])

  const selectModel = useCallback(
    (kind: ModelKind, file: string) => {
      void window.waveSubs.selectModel(kind, file).then(refreshOverview)
    },
    [refreshOverview]
  )

  const downloadModel = useCallback(
    (kind: ModelKind, file: string) => {
      setModelError(null)
      setDownloads((prev) => ({
        ...prev,
        [file]: { kind, file, percent: 0, receivedMB: 0, totalMB: 0 }
      }))
      refreshOverview()
      window.waveSubs
        .downloadModel(kind, file)
        .catch((err: unknown) => {
          const message = err instanceof Error ? stripIpcErrorPrefix(err.message) : String(err)
          if (!message.includes('download cancelled')) setModelError(message)
        })
        .finally(() => {
          setDownloads((prev) => {
            const next = { ...prev }
            delete next[file]
            return next
          })
          refreshOverview()
        })
    },
    [refreshOverview]
  )

  const cancelDownload = useCallback((kind: ModelKind, file: string) => {
    void window.waveSubs.cancelDownload(kind, file)
  }, [])

  const deleteModel = useCallback(
    (kind: ModelKind, file: string) => {
      void window.waveSubs
        .deleteModel(kind, file)
        .catch((err: unknown) => {
          setModelError(err instanceof Error ? stripIpcErrorPrefix(err.message) : String(err))
        })
        .then(refreshOverview)
    },
    [refreshOverview]
  )

  /**
   * 主题落到 CSS 变量。除了设置变化，还要跟着系统明暗切换重算——
   * 深色渐变是另一组手写色标，不是把浅色压暗。
   */
  const theme = settings?.theme ?? DEFAULT_THEME
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (): void => applyTheme(theme, mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [theme])

  // 语言由主进程解析好（显式选择 or 系统匹配），这里直接用
  const locale = settings?.resolvedLanguage ?? DEFAULT_LOCALE
  const t = useMemo(() => translatorFor(locale), [locale])

  /**
   * 编辑器不在侧边导航里（它是从完成态推进来的叠加视图），查表会落空。
   * 落空时给编辑器自己的标题；as NavItem 的旧写法在这里会直接崩整页。
   */
  const current = ALL_NAV.find((n) => n.id === view)
  const navButton = (item: NavItem): React.JSX.Element => (
    <button
      key={item.id}
      className={view === item.id ? 'nav-item nav-item-active' : 'nav-item'}
      onClick={() => setView(item.id)}
    >
      {/* 窄轨道里图标是主要识别物，放大到 28px；描边同步调细以抵消等比放大 */}
      <Icon name={item.icon} size={28} strokeWidth={1.05} />
      {t(item.labelKey)}
    </button>
  )

  return (
    <I18nProvider locale={locale}>
    <div className="app">
      <aside className="sidebar">
        {/* 给交通灯让位。这里不放应用图标——原生 Mac 应用的侧边栏都不放，
            图标属于程序坞和「关于」，摆进来只会和选中态抢注意力 */}
        <div className="sidebar-top" />
        <nav className="nav">{NAV.map(navButton)}</nav>
        <nav className="nav nav-bottom">{navButton(SETTINGS_NAV)}</nav>
      </aside>

      <main className="content">
        <header className="toolbar">
          <div>
            <h1>{current ? t(current.labelKey) : t('editor.open')}</h1>
            <p>{current ? t(current.captionKey) : t('editor.caption')}</p>
          </div>
        </header>

        {view === 'models' && overview && (
          <nav className="subnav">
            {(
              [
                {
                  id: 'asr',
                  labelKey: 'tab.asr',
                  n: overview.models.filter((m) => m.installed).length
                },
                {
                  id: 'llm',
                  labelKey: 'tab.llm',
                  n: overview.llmModels.filter((m) => m.installed).length
                },
                { id: 'cloud', labelKey: 'tab.cloud' },
                {
                  id: 'glossary',
                  labelKey: 'tab.glossary',
                  n: settings?.translation.glossary.length || undefined
                }
              ] as Array<{ id: ModelTab; labelKey: TranslationKey; n?: number }>
            ).map((tab) => (
              <button
                key={tab.id}
                className={modelTab === tab.id ? 'subnav-tab subnav-on' : 'subnav-tab'}
                onClick={() => setModelTab(tab.id)}
              >
                {t(tab.labelKey)}
                {tab.n !== undefined && <span className="subnav-count">{tab.n}</span>}
              </button>
            ))}
          </nav>
        )}
        <div className="scroll">
          {view === 'home' && (
            <HomeView
              settings={settings}
              overview={overview}
              jobState={jobState}
              lastInput={lastInput}
              onEdit={(p) => openEditor(p, 'home')}
              onRun={runJob}
              updateSettings={updateSettings}
              onSelectModel={(file) => selectModel('asr', file)}
              onSelectLlm={(file) => selectModel('llm', file)}
              goModels={() => setView('models')}
            />
          )}
          {view === 'editor' && editorPath && (
            <EditorView
              path={editorPath}
              onBack={() => setView(editorFrom.current)}
            />
          )}
          {view === 'batch' && (
            <BatchView
              settings={settings}
              overview={overview}
              entries={batch}
              running={batchRunning}
              stopping={batchStopping}
              onAdd={addToBatch}
              onRemove={removeFromBatch}
              onClear={clearBatch}
              onOverride={setBatchOverride}
              onEdit={(p) => openEditor(p, 'batch')}
              onStart={startBatch}
              onStop={stopBatch}
              updateSettings={updateSettings}
              goModels={() => setView('models')}
            />
          )}
          {view === 'models' && (
            <ModelsView
              tab={modelTab}
              overview={overview}
              settings={settings}
              downloads={downloads}
              error={modelError}
              onDownload={downloadModel}
              onCancel={cancelDownload}
              onDelete={deleteModel}
              onSettingsChanged={setSettings}
            />
          )}
          {view === 'settings' && (
            <SettingsPage settings={settings} updateSettings={updateSettings} />
          )}
        </div>
      </main>
    </div>
    </I18nProvider>
  )
}
