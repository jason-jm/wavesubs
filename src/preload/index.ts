import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  CloudProviderInput,
  ExportContent,
  ExportFormat,
  JobProgress,
  JobRequest,
  JobSummary,
  MediaProbeInfo,
  ModelDownloadProgress,
  ModelKind,
  ModelsOverview,
  PreviewSegment,
  RecordView,
  SettingsUpdate,
  SettingsView,
  TranslationTestResult
} from '../shared/types'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  pickVideo: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickVideo'),
  pickVideos: (): Promise<string[]> => ipcRenderer.invoke('dialog:pickVideosMulti'),
  probeMedia: (path: string): Promise<MediaProbeInfo> => ipcRenderer.invoke('media:probe', path),
  runJob: (input: string, request: JobRequest): Promise<JobSummary> =>
    ipcRenderer.invoke('job:run', input, request),
  onJobProgress: (callback: (progress: JobProgress) => void): (() => void) =>
    subscribe('job:progress', callback),

  modelsOverview: (): Promise<ModelsOverview> => ipcRenderer.invoke('models:overview'),
  downloadModel: (kind: ModelKind, file: string): Promise<void> =>
    ipcRenderer.invoke('models:download', kind, file),
  cancelDownload: (kind: ModelKind, file: string): Promise<void> =>
    ipcRenderer.invoke('models:cancelDownload', kind, file),
  deleteModel: (kind: ModelKind, file: string): Promise<void> =>
    ipcRenderer.invoke('models:delete', kind, file),
  selectModel: (kind: ModelKind, file: string): Promise<void> =>
    ipcRenderer.invoke('models:select', kind, file),
  onModelDownloadProgress: (callback: (p: ModelDownloadProgress) => void): (() => void) =>
    subscribe('models:downloadProgress', callback),

  getSettings: (): Promise<SettingsView> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: SettingsUpdate): Promise<SettingsView> =>
    ipcRenderer.invoke('settings:update', patch),
  saveCloudProvider: (input: CloudProviderInput): Promise<SettingsView> =>
    ipcRenderer.invoke('cloud:save', input),
  removeCloudProvider: (id: string): Promise<SettingsView> =>
    ipcRenderer.invoke('cloud:remove', id),
  testCloudProvider: (id: string): Promise<TranslationTestResult> =>
    ipcRenderer.invoke('cloud:test', id),

  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  /** 只放行官网 / 仓库 / App Store 评价链接，主进程再校验一次 */
  openExternal: (url: string): void => {
    void ipcRenderer.invoke('shell:openExternal', url)
  },
  revealInFinder: (path: string): void => {
    void ipcRenderer.invoke('shell:reveal', path)
  },
  openPath: (path: string): void => {
    void ipcRenderer.invoke('shell:openPath', path)
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),

  loadRecord: (inputPath: string): Promise<RecordView | null> =>
    ipcRenderer.invoke('record:load', inputPath),
  saveRecordCues: (inputPath: string, cues: RecordView['cues']): Promise<boolean> =>
    ipcRenderer.invoke('record:save', inputPath, cues),
  exportRecord: (
    inputPath: string,
    output: { format: ExportFormat; content: ExportContent }
  ): Promise<string> => ipcRenderer.invoke('record:export', inputPath, output),
  previewSegment: (
    inputPath: string,
    spec: { startMs: number; endMs: number; audioIndex?: number }
  ): Promise<PreviewSegment> => ipcRenderer.invoke('preview:segment', inputPath, spec)
}

contextBridge.exposeInMainWorld('waveSubs', api)

export type WaveSubsApi = typeof api
