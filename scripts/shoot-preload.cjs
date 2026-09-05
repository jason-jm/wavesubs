// 截图专用 preload：用与真 App 相同的 contextBridge 通道暴露假的 IPC，数据来自 SHOOT_STUB 指向的 JSON
const { contextBridge } = require('electron')
const data = JSON.parse(require('node:fs').readFileSync(process.env.SHOOT_STUB, 'utf8'))
const noop = async () => {}
const settings = async () => data.settings
contextBridge.exposeInMainWorld('waveSubs', {
  pickVideo: async () => data.input,
  pickVideos: async () => [],
  probeMedia: async () => data.probe,
  runJob: () => new Promise(() => {}),
  onJobProgress: () => () => {},
  modelsOverview: async () => data.overview,
  downloadModel: noop, cancelDownload: noop, deleteModel: noop, selectModel: noop,
  onModelDownloadProgress: () => () => {},
  getSettings: settings, updateSettings: settings, saveCloudProvider: settings, removeCloudProvider: settings,
  testCloudProvider: async () => ({ ok: true, message: 'ok' }),
  revealInFinder: () => {}, openPath: () => {}, pathForFile: (f) => f.name,
  loadRecord: async () => data.record,
  saveRecordCues: async () => true,
  exportRecord: async () => data.exportPath,
  previewSegment: async () => data.preview
})
