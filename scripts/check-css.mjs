/**
 * 布局不变量检查。
 *
 * 起因：一次正则批量改 CSS 时把 `.stage-now` / `.stage-done` 的选择器残片
 * 和下一条规则粘成了 `.stage-now .stage-done .result {…}`——语法完全合法，
 * 浏览器不报错也不丢弃，只是永远匹配不到，结果「完成」那张卡片从横排变成了竖排。
 *
 * 这种错误 typecheck、构建、lint 都发现不了，只能靠断言关键元素的**计算样式**。
 * 下面每一条都是"错了会立刻看出来"的结构性属性，不是外观微调。
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

const css = readFileSync(new URL('../src/renderer/src/App.css', import.meta.url), 'utf8')

/** [选择器, 属性, 期望值（子串匹配）, 说明] */
const RULES = [
  ['.app', 'display', 'grid', '外壳是两栏网格'],
  ['.app', 'background-image', 'linear-gradient', '整窗渐变'],
  ['.content', 'display', 'flex', '内容区纵向排列'],
  ['.content', 'border-radius', '13px', '内容卡片圆角'],
  ['.nav-item', 'flex-direction', 'column', '导航是图标在上文字在下'],
  ['.result', 'display', 'flex', '结果条横排：徽标 / 文字 / 按钮'],
  ['.result', 'flex-direction', 'row', '结果条不能竖排'],
  ['.stages', 'display', 'flex', '阶段步骤条横排'],
  ['.stage', 'flex-grow', '1', '各阶段等宽'],
  ['.track-fill', 'background-image', 'linear-gradient', '进度条用主题渐变'],
  ['.meter i', 'height', '9px', '量表是有高度的分段而不是细横线'],
  ['.subnav', 'border-radius', '11px', '子标签是药丸组'],
  ['.card', 'border-radius', '15px', '分组卡片圆角'],
  ['.btn-primary', 'background-image', 'linear-gradient', '主按钮用主题渐变'],
  ['.service-mark', 'display', 'grid', '服务标识居中'],
  ['.theme-swatch', 'border-radius', '11px', '色板圆角'],
  // 禁用态曾经用固定色覆盖渐变，导致主题是薰衣草时禁用按钮却是系统蓝
  ['.btn-primary:disabled', 'background-image', 'linear-gradient', '禁用的主按钮不能丢掉主题渐变'],
  // 白字配渐变底；渐变没了就成了白字白底，整个按钮看着是空的。
  // 注意这条只盖住常态——hover 态（`.btn:hover` 优先级更高）这里模拟不了，
  // 靠 App.css 里那段注释提醒
  ['.btn.btn-on', 'background-image', 'linear-gradient', '展开态按钮要有渐变底，白字才看得见'],
  // 丢了它，展开「单独设置」撑出滚动条的那一刻整页会向左跳 10px
  ['.scroll', 'scrollbar-gutter', 'stable', '滚动槽位必须常驻，否则滚动条一出现就挤窄内容'],
  ['.subnav-on .subnav-count', 'color', 'rgb(', '标签数字用强调色（随主题）'],
  ['.nav-item-active svg', 'color', 'rgb(', '导航选中图标用强调色（随主题）'],
  // overlay 会原样保留纯白，叠在 #fff 的纸面上是彻底的空操作——这里必须是 multiply
  ['.content::after', 'mix-blend-mode', 'multiply', '纸面纹理在浅色下必须用 multiply'],
  ['.app::before', 'mix-blend-mode', 'overlay', '渐变上的颗粒用 overlay']
]

const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
<div class="app"><aside class="sidebar"><div class="sidebar-top"></div>
<nav class="nav"><button class="nav-item nav-item-active">
<svg width="10" height="10"><rect width="10" height="10"/></svg>x</button></nav></aside>
<main class="content"><header class="toolbar"><h1>t</h1></header>
<div class="scroll">
  <div class="card result result-ok"><span class="result-glyph">✓</span>
    <div class="result-body"><h3>a</h3></div><button class="btn">b</button></div>
  <div class="track"><div class="track-fill"></div></div>
  <div class="stages"><div class="stage stage-done">a</div><div class="stage stage-now">b</div></div>
  <span class="meter"><i class="on"></i><i></i></span>
  <nav class="subnav"><button class="subnav-tab subnav-on">t<span class="subnav-count">3</span></button></nav>
  <button class="btn btn-primary">p</button>
  <button class="btn btn-primary" disabled>d</button>
  <button class="btn btn-on">o</button>
  <span class="service-mark">S</span>
  <div class="theme-grid"><button class="theme-swatch"><i></i></button></div>
</div></main></div>
<script>
const out = []
/**
 * 颗粒噪点的实测强度。
 * 这条单独用画布量，因为它坏掉的方式是"静默什么都不做"——
 * 曾经因为 data URI 编码方式不对，Chrome 直接拒绝加载，
 * 页面不报错、样式也都在，只是一点噪点都没有。计算样式检查不出来。
 */
function grainLevels(cb) {
  // 注意：这段代码是嵌在模板字符串里发给浏览器的，所有反斜杠都会被外层先解一次
  // 转义，所以这里一律不写正则字面量和转义序列——两者都踩过坑，而且报错位置
  // 指向生成后的 HTML，很难对回源码。
  const all = [...document.styleSheets[0].cssRules].map((r) => r.cssText).join(' ')
  const key = 'data:image/svg+xml,'
  const i = all.indexOf(key)
  if (i < 0) { cb(-1); return }
  // 只在双引号处停：SVG 内部用单引号做属性引号、还有 url(%23n) 里的右括号，
  // 拿它们当定界符会把 URI 截断
  let j = i
  while (j < all.length && all[j] !== '"') j += 1
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = c.height = 120
    const x = c.getContext('2d')
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, 120, 120).data
    let sum = 0, sq = 0, n = 0
    for (let k = 0; k < d.length; k += 4) { const v = d[k]; sum += v; sq += v * v; n += 1 }
    cb(Math.sqrt(sq / n - (sum / n) ** 2))
  }
  img.onerror = () => cb(-1)
  img.src = all.slice(i, j)
}

// 图片是异步加载的，超时也要出结果，否则整个检查静默失败
let settled = false
const finish = () => { if (!settled) { settled = true; document.title = 'RESULT:' + JSON.stringify(out) } }
grainLevels((sd) => {
  // 标定过的：不做对比度提升是 15，当前的 slope=3 是 55。阈值 40 两边都留足余量。
  // 15 那档铺到界面上只有 0.4 个灰阶，肉眼完全看不见——这正是本条要拦的情况。
  if (sd < 0) out.push(['噪点没加载', '.app::before', 'background-image', 'data URI 被浏览器拒绝', '颗粒'])
  else if (sd < 40) out.push(['对比不足', '.app::before', 'background-image', '噪点自身标准差 ' + sd.toFixed(0) + '，需 40 以上', '颗粒'])
  finish()
})
setTimeout(() => { if (!settled) out.push(['超时', '.app::before', 'background-image', '噪点在 2 秒内没加载出来', '颗粒']); finish() }, 2000)
</script>`

const server = createServer((_q, s) => {
  s.setHeader('content-type', 'text/html; charset=utf-8')
  s.end(html)
}).listen(0)
const port = (server.address()).port

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const dom = await new Promise((res, rej) => {
  const p = spawn(CHROME, ['--headless', '--disable-gpu', '--virtual-time-budget=6000',
    '--dump-dom', `http://127.0.0.1:${port}/`])
  let o = ''
  p.stdout.on('data', (d) => { o += d })
  p.on('error', rej)
  p.on('close', () => res(o))
})
server.close()

const m = /<title>RESULT:(.*?)<\/title>/s.exec(dom)
if (!m) {
  console.error('没拿到检查结果（Chrome 未渲染或页内脚本报错）')
  process.exit(1)
}
const bad = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
if (bad.length === 0) {
  console.log(`布局不变量检查通过（${RULES.length} 条）`)
  process.exit(0)
}
console.error(`布局不变量失败 ${bad.length} 条：`)
for (const [kind, sel, prop, detail, note] of bad) {
  console.error(`  [${kind}] ${sel} 的 ${prop} —— ${note}${detail ? `\n         ${detail}` : ''}`)
}
process.exit(1)
