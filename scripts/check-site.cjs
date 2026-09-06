// 官网自检：npx electron scripts/check-site.cjs
// 1) 每种语言的页面都生成了、hreflang 全、截图文件都在；2) 根页的语言跳转在各种浏览器语言下落点正确
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const DOCS = path.resolve(__dirname, '..', 'docs')
const LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'ru', 'id', 'ms', 'vi', 'th']
let bad = 0
const ok = (name, cond, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : '  ' + extra}`); if (!cond) bad++ }

console.log('页面与资源：')
for (const l of LANGS) {
  const file = path.join(DOCS, l === 'zh' ? 'index.html' : `${l}/index.html`)
  if (!fs.existsSync(file)) { ok(`${l} 页面存在`, false, file); continue }
  const html = fs.readFileSync(file, 'utf8')
  const hreflangs = (html.match(/hreflang="/g) || []).length
  ok(`${l}: hreflang ${LANGS.length + 1} 条`, hreflangs === LANGS.length + 1, `实际 ${hreflangs}`)
  const imgs = [...html.matchAll(/(?:src|url\()=?"?\(?([^"()\s]+\.(?:jpg|png))/g)].map((m) => m[1])
  const missing = imgs.filter((src) => !fs.existsSync(path.resolve(path.dirname(file), src)))
  ok(`${l}: 引用的 ${imgs.length} 张图片都在`, missing.length === 0, missing.join(', '))
  ok(`${l}: 有两行标题`, /<h1>[^<]+<\/h1>\s*<p class="h2sub">/.test(html))
  ok(`${l}: 有配置要求表`, (html.match(/<table>/g) || []).length === 3)
  ok(`${l}: 语言切换器带 ${LANGS.length} 个选项`, (html.match(/<option /g) || []).length === LANGS.length)
}
ok('sitemap 覆盖全部语言', LANGS.every((l) => fs.readFileSync(path.join(DOCS, 'sitemap.xml'), 'utf8').includes(l === 'zh' ? 'wavesubs/</loc>' : `wavesubs/${l}/</loc>`)))

// 抠出根页的跳转脚本，把 location.replace 换成记录目标
const root = fs.readFileSync(path.join(DOCS, 'index.html'), 'utf8')
const m = root.match(/<script>\s*\/\/ 根页[\s\S]*?<\/script>/)
ok('根页有语言跳转脚本', !!m)
const js = m ? m[0].replace(/^<script>/, '').replace(/<\/script>$/, '').replace("location.replace(t+'/')", "window.__to=t+'/'") : ''

const server = http.createServer((req, res) => {
  let p = path.join(DOCS, decodeURIComponent(req.url.split('?')[0]))
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
setTimeout(() => { console.log('超时'); app.exit(2) }, 40000)
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}/en/`
  console.log('\n根页语言跳转：')
  const cases = [['ja-JP', 'ja/'], ['en-US', 'en/'], ['zh-CN', ''], ['zh-TW', ''], ['pt-BR', 'en/'], ['id-ID', 'id/'], ['ms-MY', 'ms/'], ['th', 'th/'], ['ru-RU', 'ru/'], ['de-AT', 'de/']]
  for (const [lang, want] of cases) {
    const win = new BrowserWindow({ show: false, webPreferences: { partition: 'mem-' + lang } })
    await win.loadURL(base)
    const to = await win.webContents.executeJavaScript(
      `Object.defineProperty(navigator,'languages',{get:()=>['${lang}']});Object.defineProperty(navigator,'language',{get:()=>'${lang}'});window.__to='';${js};window.__to`)
    ok(`${lang} → ${JSON.stringify(to)}`, to === want, `期望 ${JSON.stringify(want)}`)
    win.destroy()
  }
  const win = new BrowserWindow({ show: false, webPreferences: { partition: 'mem-x' } })
  await win.loadURL(base)
  const r1 = await win.webContents.executeJavaScript(`localStorage.setItem('ws-lang','ko');Object.defineProperty(navigator,'language',{get:()=>'en-US'});window.__to='';${js};window.__to`)
  ok('记住的 ko 优先于浏览器的 en', r1 === 'ko/', r1)
  const r2 = await win.webContents.executeJavaScript(`history.replaceState(null,'','/en/?lang=fr');window.__to='';${js};window.__to+'|'+localStorage.getItem('ws-lang')`)
  ok('?lang=fr 覆盖并记住', r2 === 'fr/|fr', r2)
  const r3 = await win.webContents.executeJavaScript(`Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (compatible; Googlebot/2.1)'});localStorage.clear();history.replaceState(null,'','/en/');window.__to='';${js};window.__to`)
  ok('爬虫不跳转', r3 === '', JSON.stringify(r3))
  win.destroy()
  server.close()
  console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
  app.exit(bad ? 1 : 0)
})
