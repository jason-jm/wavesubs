/**
 * 生成 macOS 应用图标（.icns）。
 *
 * 设计意图：一句话讲清「声音变成字幕」——上方是语音波形，下方是两条字幕。
 * 底板用 macOS 的连续圆角（超椭圆）而不是普通圆角矩形，否则放在程序坞里
 * 和系统自带图标一眼就能看出形状不一样。
 *
 * 小尺寸单独出图：16/32 像素下 50 的笔画只剩一两个物理像素会糊，
 * 所以那两档整体加粗、加大波幅。这是 Apple 自己图标的做法，不是偷懒。
 *
 * 配色跟应用的默认主题（海雾）同一段色相行程，明暗关系见下面 PLATE 的注释。
 */
import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const OUT = new URL('../build/', import.meta.url).pathname
const ICONSET = join(OUT, 'icon.iconset')

/**
 * macOS 图标底板的形状是超椭圆 |x/a|^n + |y/b|^n = 1（n≈5），
 * 不是圆角矩形——圆角矩形在直线段和圆弧的接缝处曲率突变，肉眼能看出「鼓」。
 */
function squircle(cx: number, cy: number, half: number, n = 5, steps = 180): string {
  const pts: string[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2
    const ct = Math.cos(t)
    const st = Math.sin(t)
    const x = cx + half * Math.sign(ct) * Math.abs(ct) ** (2 / n)
    const y = cy + half * Math.sign(st) * Math.abs(st) ** (2 / n)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `${pts.join('')}Z`
}

/**
 * 一条正弦折线，用圆头描边画出来。
 *
 * 之前用九根高低不同的竖条画频谱，信息量太大——在程序坞里只有 128px，
 * 九根线糊成一团，抽象度也不够（那是「频谱图」，不是「声音」）。
 * 换成一整笔波浪之后，整个图标只剩三笔：一条波浪 + 两条直线，
 * 「波浪变成直线」这个转化关系一眼就懂，而且三笔可以同粗。
 */
function wavePath(cy: number, width: number, amp: number, cycles: number): string {
  const pts: string[] = []
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120
    const x = 1024 / 2 - width / 2 + width * t
    const y = cy - Math.sin(t * Math.PI * 2 * cycles) * amp
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

/**
 * 底板渐变与笔画颜色。
 *
 * 深底白线 vs 淡底深线，这里选后者，两个原因：
 *
 * 1. 跟界面对得上。界面的默认渐变（#CCE6EB→#9AA2D6）非常淡，图标要是按
 *    「前景得够浓」的常规做法加饱和压暗，摆在一起就是两个色系。底板改成
 *    界面同一段色相、只压深一档，才是同一套东西。
 * 2. 笔画反而更清楚。白线压在深底上时，波纹最细的地方正落在渐变最浅的一段，
 *    实测只有 3.4:1，而下面的横杠有 6.9——上细下粗的观感一半来自这个落差。
 *    翻过来之后三笔是 4.9~6.9，均匀多了。
 *
 * 所以别再把底板往深里调「让它更显眼」，那会把这两点一起丢掉。
 */
const PLATE = ['#A9DCE8', '#84B2D8', '#7480CA'] as const
/** 笔画：232° 一带压到 26% 明度，是渐变末端那个雾蓝的深色版 */
const INK = '#19236B'

function svg(detail: 'full' | 'simple'): string {
  const S = 1024
  const plate = squircle(S / 2, S / 2, 412)

  /**
   * 三笔同粗。小尺寸那档整体加粗、加大波幅、缩短横条——
   * 32px 下 50 的笔画只剩 1.6 个物理像素，会糊；加到 74 才立得住。
   * 纵向位置是量出来的：把笔画的包围盒和底板上下边一起测，让上下留白基本相等
   * （量到上 42 下 53 时整体偏高，所以下移了 34）。这里不做「视觉重心上移」的
   * 常规修正——那条规则针对的是底部厚重的形状，而这个图标上面是细波浪、
   * 下面是两条实心横杠，本来就下沉，再上移只会更显得吊在上面。
   */
  const g = detail === 'full'
    ? { sw: 50, wy: 402, ww: 470, amp: 78, cyc: 1.5, y1: 602, w1: 470, y2: 702, w2: 300 }
    // 小尺寸只用一个周期：1.5 个周期在 16px 下会挤出两个圆鼓的峰，
    // 配上下面两条横线整体像张脸。单个平缓的 S 曲线没有这个问题。
    : { sw: 78, wy: 392, ww: 500, amp: 104, cyc: 1, y1: 590, w1: 480, y2: 720, w2: 296 }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="${PLATE[0]}"/>
      <stop offset="0.48" stop-color="${PLATE[1]}"/>
      <stop offset="1" stop-color="${PLATE[2]}"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.2"/>
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="${plate}" fill="url(#plate)"/>
  <path d="${plate}" fill="url(#gloss)"/>
  <polyline points="${wavePath(g.wy, g.ww, g.amp, g.cyc)}" fill="none" stroke="${INK}"
    stroke-width="${g.sw}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${(S - g.w1) / 2}" y="${g.y1}" width="${g.w1}" height="${g.sw}" rx="${g.sw / 2}" fill="${INK}"/>
  <rect x="${(S - g.w2) / 2}" y="${g.y2}" width="${g.w2}" height="${g.sw}" rx="${g.sw / 2}" fill="${INK}" opacity="0.86"/>
</svg>`
}

/** iconset 需要的十档；16/32 两档用简化版 */
const SIZES: Array<{ px: number; name: string; detail: 'full' | 'simple' }> = [
  { px: 16, name: 'icon_16x16.png', detail: 'simple' },
  { px: 32, name: 'icon_16x16@2x.png', detail: 'simple' },
  { px: 32, name: 'icon_32x32.png', detail: 'simple' },
  { px: 64, name: 'icon_32x32@2x.png', detail: 'full' },
  { px: 128, name: 'icon_128x128.png', detail: 'full' },
  { px: 256, name: 'icon_128x128@2x.png', detail: 'full' },
  { px: 256, name: 'icon_256x256.png', detail: 'full' },
  { px: 512, name: 'icon_256x256@2x.png', detail: 'full' },
  { px: 512, name: 'icon_512x512.png', detail: 'full' },
  { px: 1024, name: 'icon_512x512@2x.png', detail: 'full' }
]

await rm(ICONSET, { recursive: true, force: true })
await mkdir(ICONSET, { recursive: true })
for (const kind of ['full', 'simple'] as const) {
  await writeFile(join(OUT, `icon-${kind}.svg`), svg(kind))
}
/**
 * 用 Chrome 渲染而不是 ImageMagick：magick 自带的 SVG 渲染器不支持
 * linearGradient，底板会渲染成纯黑（实测过）。Chrome 的 SVG 支持是完整的，
 * 而且本来就装着，不必为了这一步再装 librsvg。
 */
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
async function render(detail: 'full' | 'simple', px: number, out: string): Promise<void> {
  const svgText = svg(detail)
  const html = join(OUT, `_r${px}${detail}.html`)
  await writeFile(html, `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}
svg{display:block;width:${px}px;height:${px}px}</style>${svgText}`)
  await run(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', `--window-size=${px},${px}`,
    `--screenshot=${out}`, `file://${html}`])
  await rm(html, { force: true })
}

for (const s of SIZES) await render(s.detail, s.px, join(ICONSET, s.name))
await run('iconutil', ['-c', 'icns', ICONSET, '-o', join(OUT, 'icon.icns')])
// electron-builder 在部分场景要 512 的 png 兜底
await render('full', 512, join(OUT, 'icon.png'))
console.log('已生成 build/icon.icns 与 build/icon.png')
