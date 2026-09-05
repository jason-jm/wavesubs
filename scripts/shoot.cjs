/**
 * 营销截图：用 Electron 自带的渲染器把界面摆到指定状态后 capturePage。
 *
 * 为什么不用浏览器插件截图：那条通道给的是缩过的预览图，做不了 App Store
 * 要求的 2880×1800。这里开一个 1440×900 的窗口，Retina 下 capturePage 天然 2 倍。
 *
 * 前置：`npx electron-vite dev --rendererOnly` 在跑（只起 vite，不起真正的应用）。
 * 用法：npx electron scripts/shoot.cjs <输出目录> <界面语言> <dark|light>
 *
 * 数据全是虚构的（剧名、台词、路径），剧照由即梦生成——营销素材里不能出现真实影片。
 */
const { app, BrowserWindow, nativeTheme } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const OUT = path.resolve(process.argv[2] || 'site/assets/shots')
const LOCALE = process.argv[3] || 'zh-Hans'
const THEME = process.argv[4] || 'dark'
const BASE = 'http://localhost:5173'
const STILL = `${BASE}/@fs${path.resolve('site/assets/demo-still.jpg')}`
const ZH = LOCALE.startsWith('zh')

const SHOW = 'Harbor.Lights.S01E03.1080p.BluRay.mkv'
const DIR = '/Volumes/Media/Anime/Harbor Lights'
const INPUT = `${DIR}/${SHOW}`

const LINES = [
  [1200, 3400, '雨、まだ止まないね。', '雨还没停呢。', "The rain still hasn't stopped."],
  [3900, 5800, '傘、持ってきてないの？', '你没带伞吗？', "You didn't bring an umbrella?"],
  [6100, 8900, '忘れた。走れば五分だから。', '忘了。跑的话五分钟就到。', "Forgot it. It's five minutes if I run."],
  [9300, 12200, '風邪ひくよ。半分入って。', '会感冒的。进来一半吧。', "You'll catch a cold. Get under, we'll share."],
  [13000, 14600, '……ありがとう。', '……谢谢。', '...Thanks.'],
  [15200, 18400, '駅まで、遠回りしてもいい？', '去车站，绕远一点也行吗？', 'Mind if we take the long way to the station?'],
  [18900, 21300, 'いいよ。どうせ急いでない。', '好啊。反正也不赶时间。', "Sure. I'm in no hurry anyway."],
  [22000, 25100, 'この街、雨の日のほうが好きなんだ。', '这座城市，我更喜欢下雨的日子。', 'I like this city better on rainy days.'],
  [25600, 28300, 'ネオンが濡れて、少し優しく見える。', '霓虹被淋湿了，看起来温柔了一点。', 'The neon gets wet and looks a little softer.'],
  [29000, 31800, '君も、そう思う？', '你也这么觉得吗？', 'You think so too?'],
  [32400, 34000, '……今は、思う。', '……现在，是这么觉得。', '...Right now, I do.'],
  [35000, 38200, 'じゃあ、もう少しだけ遠回りしよう。', '那就再多绕一点路吧。', "Then let's take the long way a little longer."]
]
const cues = LINES.map(([s, e, ja, zh, en], i) => ({
  index: i + 1, startMs: s, endMs: e, text: ja, translation: ZH ? zh : en
}))

const settings = {
  appearance: THEME, theme: { paletteId: 'seafog', grain: 1, intensity: 1 },
  language: LOCALE, resolvedLanguage: LOCALE, systemLanguage: LOCALE,
  translateEnabled: true,
  translation: {
    engine: 'local', targetLanguage: ZH ? 'zh' : 'en', localModel: 'Qwen3-8B-Q4_K_M.gguf',
    providers: [{ id: 'p1', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hasApiKey: true }],
    activeProviderId: 'p1',
    glossary: [
      { from: 'ハルカ', to: ZH ? '遥' : 'Haruka' }, { from: 'ミナト', to: ZH ? '凑' : 'Minato' },
      { from: '港の灯', to: ZH ? '港湾之光' : 'Harbor Lights' }, { from: '駅前商店街', to: ZH ? '站前商店街' : 'the arcade by the station' }
    ]
  },
  export: { format: 'srt', content: 'bilingual' }
}
const model = (file, name, sizeMB, ramGB, quality, speed, installed, fitness, extra = {}) =>
  ({ file, name, sizeMB, ramGB, quality, speed, requirement: '', detail: '', installed, downloading: false, fitness, ...extra })
const overview = {
  dir: '/Users/you/Library/Application Support/wavesubs/models', llmDir: '/Users/you/Library/Application Support/wavesubs/models/llm',
  hardware: { chip: 'Apple M4 Pro', memGB: 48, appleSilicon: true },
  selected: 'ggml-large-v3-turbo.bin', llmSelected: 'Qwen3-8B-Q4_K_M.gguf',
  models: [
    model('ggml-large-v3-turbo.bin', 'Large v3 Turbo', 1620, 4, 4, 4, true, 'great', { recommendedDefault: true }),
    model('ggml-large-v3.bin', 'Large v3', 3100, 6, 5, 2, false, 'ok'),
    model('ggml-medium.bin', 'Medium', 1530, 3, 3, 3, true, 'great'),
    model('ggml-small.bin', 'Small', 488, 1, 2, 5, false, 'great')
  ],
  llmModels: [
    model('Qwen3-8B-Q4_K_M.gguf', 'Qwen3 8B', 5030, 8, 4, 3, true, 'great', { recommendedDefault: true }),
    model('Qwen3-32B-Q4_K_M.gguf', 'Qwen3 32B', 19800, 24, 5, 1, false, 'slow'),
    model('Qwen3-1.7B-Q8_0.gguf', 'Qwen3 1.7B', 2050, 3, 2, 5, true, 'great')
  ]
}
const probe = (dur) => ({
  kind: 'video', format: 'matroska,webm', durationSec: dur,
  audioStreams: [{ audioIndex: 0, codec: 'flac', channels: 2, language: 'jpn' }],
  subtitleStreams: [
    { subtitleIndex: 0, codec: 'ass', language: 'jpn', title: 'Full', textBased: true, forced: false, hearingImpaired: false },
    { subtitleIndex: 1, codec: 'ass', language: 'jpn', title: 'Signs', textBased: true, forced: true, hearingImpaired: false }
  ]
})
const summary = (name, n, qc, extra = {}) => ({
  outputPath: `${DIR}/${name.replace(/\.mkv$/, '')}.${ZH ? 'zh' : 'en'}.srt`, language: 'ja', cueCount: n,
  translated: true, translatedCount: n, durationSec: 1423, qc, ...extra
})
const good = { level: 'good', findings: [] }
const warn = { level: 'warn', findings: [{ kind: 'gap', severity: 'warn', n: 1, atSec: 754 }] }

const record = {
  inputPath: INPUT, language: 'ja', durationSec: 1423, cues,
  hasTranslation: true, targetLanguage: ZH ? 'zh' : 'en', edited: false,
  qc: { level: 'warn', findings: [{ kind: 'fastRate', severity: 'warn', n: 3, atSec: 22 }] }
}

/** 桩数据写成 JSON，由 shoot-preload.cjs 经 contextBridge 暴露——与真 App 注入 IPC 的方式一致 */
const STUB_FILE = path.join(OUT, '.stub.json')
const stubData = {
  input: INPUT, probe: probe(1423), overview, settings, record,
  exportPath: INPUT.replace(/\.mkv$/, ZH ? '.zh.srt' : '.en.srt'),
  preview: { frames: [STILL], audio: null, fps: 10, offsetMs: 5700, durationMs: 15000 }
}

const batch = [
  { id: 'b1', path: `${DIR}/Harbor.Lights.S01E01.1080p.BluRay.mkv`, name: 'Harbor.Lights.S01E01.1080p.BluRay.mkv', status: 'done', result: summary('Harbor.Lights.S01E01.1080p.BluRay.mkv', 398, good, { sourceFromCache: true, translationReuse: 'all', translationReusedCount: 398, translationFreshCount: 0 }), info: probe(1410) },
  { id: 'b2', path: `${DIR}/Harbor.Lights.S01E02.1080p.BluRay.mkv`, name: 'Harbor.Lights.S01E02.1080p.BluRay.mkv', status: 'done', result: summary('Harbor.Lights.S01E02.1080p.BluRay.mkv', 421, warn), info: probe(1418) },
  { id: 'b3', path: INPUT, name: SHOW, status: 'running', progress: { stage: 'translate', percent: 47 }, info: probe(1423) },
  { id: 'b4', path: `${DIR}/Harbor.Lights.S01E04.1080p.BluRay.mkv`, name: 'Harbor.Lights.S01E04.1080p.BluRay.mkv', status: 'waiting', info: probe(1419) },
  { id: 'b5', path: `${DIR}/Harbor.Lights.S01E05.1080p.BluRay.mkv`, name: 'Harbor.Lights.S01E05.1080p.BluRay.mkv', status: 'waiting', info: probe(1425) }
]

const SCENES = [
  { name: 'home-running', run: `__demo.setView('home'); __demo.setLastInput(${JSON.stringify(INPUT)}); __demo.setJobState({ kind: 'running', input: ${JSON.stringify(INPUT)}, progress: { stage: 'transcribe', percent: 62 } })` },
  { name: 'home-done', run: `__demo.setView('home'); __demo.setLastInput(${JSON.stringify(INPUT)}); __demo.setJobState({ kind: 'done', result: ${JSON.stringify(summary(SHOW, 412, good, { translationReuse: 'none' }))} })` },
  { name: 'batch', run: `__demo.setView('batch'); __demo.setBatch(${JSON.stringify(batch)})` },
  { name: 'editor', run: `__openEditor(${JSON.stringify(INPUT)}, 'home')`, after: `
      const row = document.querySelectorAll('.editor-row')[2];
      row && row.querySelectorAll('.editor-ops button')[0].click();`, wait: 1800 },
  { name: 'models', run: `__demo.setView('models'); __demo.setModelTab('asr')` },
  { name: 'glossary', run: `__demo.setView('models'); __demo.setModelTab('glossary')` },
  { name: 'settings', run: `__demo.setView('settings')` }
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LOG = path.join(OUT, 'shoot.log')
const log = (m) => { const line = `${new Date().toISOString().slice(11, 19)} ${m}`; console.log(line); fs.appendFileSync(LOG, line + '\n') }
// 任何一步卡住都别让脚本无限挂着：60 秒没跑完就带着日志退出
setTimeout(() => { log('TIMEOUT: 60s 内没跑完，强制退出'); app.exit(2) }, 60000)

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  log('app ready')
  nativeTheme.themeSource = THEME
  fs.writeFileSync(STUB_FILE, JSON.stringify(stubData))
  process.env.SHOOT_STUB = STUB_FILE
  const win = new BrowserWindow({
    width: 1440, height: 900, useContentSize: true, show: true, frame: false,
    backgroundColor: '#0f1117',
    webPreferences: { preload: path.join(__dirname, 'shoot-preload.cjs'), contextIsolation: true, sandbox: false }
  })
  log('window created')
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) log('page: ' + msg.slice(0, 160)) })
  await win.loadURL(BASE)
  log('loaded')
  await sleep(1200)
  for (const scene of SCENES) {
    log('scene ' + scene.name)
    await win.webContents.executeJavaScript(`(() => { ${scene.run}; return true })()`)
    await sleep(500)
    if (scene.after) {
      await win.webContents.executeJavaScript(`(() => { ${scene.after}; return true })()`)
    }
    await sleep(scene.wait ?? 400)
    const img = await win.webContents.capturePage()
    const file = path.join(OUT, `${LOCALE}-${THEME}-${scene.name}.png`)
    fs.writeFileSync(file, img.toPNG())
    const { width, height } = img.getSize()
    log(`${path.basename(file)}  ${width}x${height}`)
  }
  log('done')
  app.exit(0)
}).catch((err) => { log('ERROR ' + (err && err.stack || err)); app.exit(1) })
