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

const OUT = path.resolve(process.argv[2] || 'docs/assets/shots')
const LOCALE = process.argv[3] || 'zh-Hans'
const THEME = process.argv[4] || 'dark'
const BASE = 'http://localhost:5173'
const STILL = `${BASE}/@fs${path.resolve('docs/assets/demo-still.jpg')}`

const SHOW = 'Harbor.Lights.S01E03.1080p.BluRay.mkv'
const DIR = '/Volumes/Media/Anime/Harbor Lights'
const INPUT = `${DIR}/${SHOW}`

/** 12 句虚构对白：日文原文 + 各语言译文；日文界面则用英文做原文、日文做译文 */
const TIMES = [[1200,3400],[3900,5800],[6100,8900],[9300,12200],[13000,14600],[15200,18400],[18900,21300],[22000,25100],[25600,28300],[29000,31800],[32400,34000],[35000,38200]]
const JA = ['雨、まだ止まないね。','傘、持ってきてないの？','忘れた。走れば五分だから。','風邪ひくよ。半分入って。','……ありがとう。','駅まで、遠回りしてもいい？','いいよ。どうせ急いでない。','この街、雨の日のほうが好きなんだ。','ネオンが濡れて、少し優しく見える。','君も、そう思う？','……今は、思う。','じゃあ、もう少しだけ遠回りしよう。']
const TR = {
  zh: ['雨还没停呢。','你没带伞吗？','忘了。跑的话五分钟就到。','会感冒的。进来一半吧。','……谢谢。','去车站，绕远一点也行吗？','好啊。反正也不赶时间。','这座城市，我更喜欢下雨的日子。','霓虹被淋湿了，看起来温柔了一点。','你也这么觉得吗？','……现在，是这么觉得。','那就再多绕一点路吧。'],
  en: ["The rain still hasn't stopped.","You didn't bring an umbrella?","Forgot it. It's five minutes if I run.","You'll catch a cold. Get under, we'll share.",'...Thanks.','Mind if we take the long way to the station?',"Sure. I'm in no hurry anyway.",'I like this city better on rainy days.','The neon gets wet and looks a little softer.','You think so too?','...Right now, I do.',"Then let's take the long way a little longer."],
  ko: ['비가 아직 안 그치네.','우산 안 가져왔어?','깜빡했어. 뛰면 5분이니까.','감기 걸려. 반쪽이라도 들어와.','…고마워.','역까지 좀 돌아가도 돼?','좋아. 어차피 안 급해.','이 동네는 비 오는 날이 더 좋아.','네온이 젖어서 조금 부드러워 보여.','너도 그렇게 생각해?','…지금은, 그래.','그럼 조금만 더 돌아가자.'],
  fr: ["La pluie ne s'arrête toujours pas.","Tu n'as pas pris de parapluie ?","Oublié. En courant, c'est cinq minutes.",'Tu vas attraper froid. Viens, on partage.','… Merci.',"On peut faire un détour jusqu'à la gare ?","D'accord. Je ne suis pas pressé de toute façon.","J'aime plus cette ville les jours de pluie.",'Les néons mouillés paraissent un peu plus doux.','Tu trouves aussi ?','… Là, maintenant, oui.','Alors, faisons encore un petit détour.'],
  de: ['Der Regen hört immer noch nicht auf.','Hast du keinen Schirm dabei?','Vergessen. Wenn ich renne, sind es fünf Minuten.','Du erkältest dich noch. Komm mit drunter.','… Danke.','Dürfen wir einen Umweg zum Bahnhof machen?',"Klar. Ich hab's eh nicht eilig.",'Ich mag diese Stadt an Regentagen lieber.','Die nassen Neonlichter wirken etwas sanfter.','Findest du auch?','… Jetzt gerade schon.','Dann machen wir noch einen kleinen Umweg.'],
  ru: ['Дождь всё никак не кончится.','Ты без зонта?','Забыл. Бегом всего пять минут.','Простудишься. Давай под зонт.','…Спасибо.','Можно пойти к станции в обход?','Давай. Я всё равно не спешу.','Этот город мне больше нравится в дождь.','Мокрый неон кажется чуть мягче.','Ты тоже так думаешь?','…Сейчас — да.','Тогда пройдём ещё немного в обход.'],
  id: ['Hujannya masih belum berhenti, ya.','Kamu nggak bawa payung?','Lupa. Kalau lari cuma lima menit.','Nanti masuk angin. Sini, bagi dua.','…Makasih.','Boleh muter dulu ke stasiun?','Boleh. Toh aku nggak buru-buru.','Aku lebih suka kota ini saat hujan.','Neonnya basah, jadi kelihatan lebih lembut.','Kamu juga mikir gitu?','…Sekarang, iya.','Kalau gitu, kita muter sedikit lagi.'],
  ms: ['Hujan masih belum berhenti, ya.','Awak tak bawa payung?','Terlupa. Kalau lari, lima minit saja.','Nanti demam. Masuk sini, kongsi.','…Terima kasih.','Boleh kita ikut jalan jauh ke stesen?','Boleh. Lagipun saya tak tergesa-gesa.','Saya lebih suka bandar ini pada hari hujan.','Lampu neon yang basah nampak lebih lembut.','Awak pun rasa begitu?','…Sekarang, ya.','Kalau begitu, jom ikut jalan jauh lagi sedikit.'],
  vi: ['Mưa vẫn chưa tạnh nhỉ.','Cậu không mang ô à?','Quên rồi. Chạy thì năm phút là tới.','Cảm lạnh đấy. Vào đây che chung đi.','…Cảm ơn.','Đi đường vòng ra ga được không?','Được. Đằng nào tớ cũng không vội.','Tớ thích thành phố này hơn vào những ngày mưa.','Đèn neon ướt mưa trông dịu hơn một chút.','Cậu cũng nghĩ vậy à?','…Bây giờ thì có.','Vậy thì đi vòng thêm một chút nữa nhé.'],
  th: ['ฝนยังไม่หยุดเลยนะ','ไม่ได้เอาร่มมาเหรอ','ลืมน่ะ วิ่งไปก็แค่ห้านาที','เดี๋ยวก็เป็นหวัดหรอก เข้ามาแบ่งร่มกันสิ','…ขอบคุณนะ','ไปสถานีทางอ้อมได้ไหม','ได้สิ ยังไงก็ไม่รีบอยู่แล้ว','ฉันชอบเมืองนี้ตอนฝนตกมากกว่า','แสงนีออนเปียกฝนดูอ่อนโยนขึ้นนิดหน่อย','เธอก็คิดแบบนั้นเหรอ','…ตอนนี้ก็คิดนะ','งั้นอ้อมไปอีกหน่อยแล้วกัน']
}
const GLOSS = {
  zh: [['ハルカ','遥'],['ミナト','凑'],['港の灯','港湾之光'],['駅前商店街','站前商店街']],
  en: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Harbor Lights'],['駅前商店街','the arcade by the station']],
  ja: [['Haruka','ハルカ'],['Minato','ミナト'],['Harbor Lights','港の灯'],['the arcade by the station','駅前商店街']],
  ko: [['ハルカ','하루카'],['ミナト','미나토'],['港の灯','항구의 불빛'],['駅前商店街','역 앞 상점가']],
  fr: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Les lumières du port'],['駅前商店街','la galerie marchande de la gare']],
  de: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Hafenlichter'],['駅前商店街','die Ladenpassage am Bahnhof']],
  ru: [['ハルカ','Харука'],['ミナト','Минато'],['港の灯','Огни гавани'],['駅前商店街','торговая улица у станции']],
  id: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Lampu Pelabuhan'],['駅前商店街','pertokoan depan stasiun']],
  ms: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Lampu Pelabuhan'],['駅前商店街','deretan kedai depan stesen']],
  vi: [['ハルカ','Haruka'],['ミナト','Minato'],['港の灯','Ánh đèn bến cảng'],['駅前商店街','khu phố mua sắm trước ga']],
  th: [['ハルカ','ฮารุกะ'],['ミナト','มินาโตะ'],['港の灯','แสงไฟท่าเรือ'],['駅前商店街','ย่านร้านค้าหน้าสถานี']]
}
const KEY = LOCALE.startsWith('zh') ? 'zh' : LOCALE
if (!TR[KEY] && KEY !== 'ja') throw new Error(`没有 ${LOCALE} 的演示译文`)
const IS_JA = KEY === 'ja'
const TARGET = IS_JA ? 'ja' : KEY
const SRC_LANG = IS_JA ? 'en' : 'ja'
const SRC_LINES = IS_JA ? TR.en : JA
const TR_LINES = IS_JA ? JA : TR[KEY]
const cues = TIMES.map(([s, e], i) => ({ index: i + 1, startMs: s, endMs: e, text: SRC_LINES[i], translation: TR_LINES[i] }))

const settings = {
  appearance: THEME, theme: { paletteId: 'seafog', grain: 0.1, intensity: 1 },
  language: LOCALE, resolvedLanguage: LOCALE, systemLanguage: LOCALE, systemLanguageTags: [LOCALE + '-XX', LOCALE],
  translateEnabled: true,
  translation: {
    engine: 'local', targetLanguage: TARGET, localModel: 'Qwen3-8B-Q4_K_M.gguf',
    providers: [{ id: 'p1', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hasApiKey: true }],
    activeProviderId: 'p1',
    glossary: GLOSS[KEY].map(([from, to]) => ({ from, to }))
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
  audioStreams: [{ audioIndex: 0, codec: 'flac', channels: 2, language: SRC_LANG === 'ja' ? 'jpn' : 'eng' }],
  subtitleStreams: [
    { subtitleIndex: 0, codec: 'ass', language: 'jpn', title: 'Full', textBased: true, forced: false, hearingImpaired: false },
    { subtitleIndex: 1, codec: 'ass', language: 'jpn', title: 'Signs', textBased: true, forced: true, hearingImpaired: false }
  ]
})
const summary = (name, n, qc, extra = {}) => ({
  outputPath: `${DIR}/${name.replace(/\.mkv$/, '')}.${TARGET}.srt`, language: SRC_LANG, cueCount: n,
  translated: true, translatedCount: n, durationSec: 1423, qc, ...extra
})
const good = { level: 'good', findings: [] }
const warn = { level: 'warn', findings: [{ kind: 'gap', severity: 'warn', n: 1, atSec: 754 }] }

const record = {
  inputPath: INPUT, language: SRC_LANG, durationSec: 1423, cues,
  hasTranslation: true, targetLanguage: TARGET, edited: false,
  qc: { level: 'warn', findings: [{ kind: 'fastRate', severity: 'warn', n: 3, atSec: 22 }] }
}

/** 桩数据写成 JSON，由 shoot-preload.cjs 经 contextBridge 暴露——与真 App 注入 IPC 的方式一致 */
const STUB_FILE = path.join(OUT, '.stub.json')
const stubData = {
  input: INPUT, probe: probe(1423), overview, settings, record,
  exportPath: INPUT.replace(/\.mkv$/, `.${TARGET}.srt`),
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
  { name: 'translate-models', run: `__demo.setView('models'); __demo.setModelTab('llm')` },
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
