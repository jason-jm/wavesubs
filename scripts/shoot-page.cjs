// 给任意网页在指定视口、指定滚动位置截图：npx electron scripts/shoot-page.cjs <url> <out-prefix> <width> <height> [scrollYs...]
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const [url, prefix, w = '1280', h = '800', ...ys] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
setTimeout(() => app.exit(2), 40000)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: +w, height: +h, useContentSize: true, show: true, frame: false })
  await win.loadURL(url)
  await sleep(900)
  const positions = ys.length ? ys : ['0']
  for (const y of positions) {
    // 位置可以是像素，也可以是 #id（滚到该元素顶部再往上留 16px）
    // 也支持 #id-300 / #id+120 这种带偏移的写法
    const m = y.match(/^(#[\w-]+?)([+-]\d+)?$/)
    const expr = m
      ? `window.scrollTo({ top: Math.max(0, document.querySelector(${JSON.stringify(m[1])}).getBoundingClientRect().top + window.scrollY - 16 + ${+(m[2] || 0)}), behavior: 'instant' }); true`
      : `window.scrollTo({ top: ${+y}, behavior: 'instant' }); true`
    await win.webContents.executeJavaScript(expr)
    await sleep(800)
    const img = await win.webContents.capturePage()
    fs.writeFileSync(`${prefix}-${y.replace(/[#+]/g, '')}.png`, img.toPNG())
  }
  app.exit(0)
})
