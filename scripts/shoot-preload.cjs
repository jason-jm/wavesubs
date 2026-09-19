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
  appInfo: async () => ({ version: '1.0.8', platform: 'darwin', mas: false, locale: 'zh-Hans', signsSupported: true }), openExternal: () => {},
  // 检查更新：截图里显示「已是最新版本」；不真的联网
  updateStatus: async () => ({ state: 'latest', current: '1.0.8', installSource: 'manual', checkedAt: Date.now() }),
  checkForUpdates: async () => ({ state: 'latest', current: '1.0.8', installSource: 'manual', checkedAt: Date.now() }),
  skipUpdate: async () => null,
  onUpdateStatus: () => () => {},
  loadRecord: async () => data.record,
  saveRecordCues: async () => true,
  exportRecord: async () => data.exportPath,
  previewSegment: async () => data.preview
})
