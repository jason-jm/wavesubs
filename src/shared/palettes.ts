/**
 * 渐变主题。
 *
 * 视觉参照 Arc：整扇窗铺一层柔和渐变，内容区是浮在上面的圆角卡片，
 * 渐变从四周露出来形成"画框"。渐变本身要够淡——它是底，不是主角，
 * 上面还要压正文、图标和控件。
 *
 * 每套配色手写明暗两组色标，而不是拿浅色算深色：机械压暗会发灰发浑，
 * 深色下要把色相往冷里偏一点、饱和度反而提一点才显得透。
 */
export interface Palette {
  id: string
  /** 从左上到右下的三个色标 */
  light: [string, string, string]
  dark: [string, string, string]
}

/**
 * 十套配色。色相刻意避开 0/60/120/180/240/300 这些"正色"位置——
 * 落在色相之间才不像色板取样，而且每套的三个色标是"走一段"色相，
 * 不是同色不同深浅。
 *
 * 深色那组由浅色推导：色相往这套配色的终点（最深那个色标）偏 45%。
 * 直接压暗的话黄绿系在低明度下必然变成橄榄褐——「柚」会从柚子黄糊成一摊泥。
 * 偏向终点后它落到暖棕红，配色的性格保住了。
 */
export const PALETTES: Palette[] = [
  {
    // 雾玫
    id: 'mistrose',
    light: ['#F2C4D5', '#DFA4D3', '#B089D1'],
    dark: ['#7E2671', '#64296A', '#44285D']
  },
  {
    // 陶土
    id: 'terracotta',
    light: ['#F2D3BA', '#E3A196', '#CD8497'],
    dark: ['#7E3026', '#6D2225', '#5C2836']
  },
  {
    // 柚
    id: 'pomelo',
    light: ['#F2ECB0', '#F0C089', '#E59480'],
    dark: ['#7A5624', '#6E3E21', '#6A2F20']
  },
  {
    // 苔金
    id: 'mossgold',
    light: ['#ECE5B6', '#C2D39C', '#95C28E'],
    dark: ['#5E7925', '#45602E', '#355530']
  },
  {
    // 铜绿
    id: 'verdigris',
    light: ['#BADECD', '#8ECCC8', '#6EADC4'],
    dark: ['#33665F', '#2B565A', '#254855']
  },
  {
    // 海雾
    id: 'seafog',
    light: ['#CCE6EB', '#AEC7E0', '#9AA2D6'],
    dark: ['#315372', '#2E426B', '#2C3363']
  },
  {
    // 暮色
    id: 'dusk',
    light: ['#CFBBDD', '#A49ACB', '#7D91BF'],
    dark: ['#3E3564', '#313259', '#2A3650']
  },
  {
    // 子夜
    id: 'midnight',
    light: ['#ABAFE3', '#9988D3', '#9A67C1'],
    dark: ['#392970', '#3C265E', '#3E2452']
  },
  {
    // 余烬
    id: 'ember',
    light: ['#E5C6BD', '#D09FA7', '#B983A2'],
    dark: ['#6F2F37', '#5E3141', '#4D2D3F']
  },
  {
    // 石墨
    id: 'graphite',
    light: ['#E2E5E9', '#D1D5DB', '#BEC2CA'],
    dark: ['#4B5362', '#494E5B', '#434751']
  }
]

/** 旧版配色 id → 最接近的新配色。不映射的话用户存的选择会静默跳回第一套 */
const LEGACY_PALETTE: Record<string, string> = {
  rose: 'mistrose',
  sunset: 'terracotta',
  lavender: 'dusk',
  mint: 'verdigris',
  ocean: 'seafog',
  peach: 'ember',
  citrus: 'pomelo',
  moss: 'mossgold'
}

/**
 * 默认配色：海雾（淡青 190° → 雾蓝 232°）。
 *
 * 它的强调色落在 232°，离语义红 128°、离语义绿 102°，不会和「失败」「已下载」
 * 这些状态色混淆——这是选默认色的第一条硬约束，陶土(344°)、柚(12°)、
 * 余烬(326°) 离红太近，苔金(112°) 离绿太近，那四套都当不了默认。
 *
 * 改默认色时记得一起对齐这几处写死的颜色，它们不走主题变量：
 *   - App.css 里 --grad-* 和 --accent* 的兜底值（JS 未执行时的首帧）
 *   - src/main/index.ts 的窗口 backgroundColor（避免启动闪白）
 *   - scripts/make-icon.ts 的图标渐变
 */
export const DEFAULT_PALETTE = 'seafog'

/** 用户自定义：两端颜色 + 角度，中间色由两端插值 */
export interface CustomTheme {
  from: string
  to: string
  angle: number
}

export interface ThemeSetting {
  paletteId: string
  /** paletteId === 'custom' 时生效 */
  custom?: CustomTheme
  /** 颗粒噪点强度 0~1。Arc 的渐变上都盖着一层很细的噪点，
      少了它大面积渐变会出现色带（banding） */
  grain: number
  /** 渐变整体浓度 0~1，调低就接近纯净的浅灰背景 */
  intensity: number
}

export const DEFAULT_THEME: ThemeSetting = {
  paletteId: DEFAULT_PALETTE,
  grain: 0.5,
  intensity: 1
}

const HEX = /^#?([\da-f]{6})$/i

function toRgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex.trim())
  if (!m) return [128, 128, 128]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (c: [number, number, number]): string =>
  `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

const mix = (a: string, b: string, t: number): string => {
  const x = toRgb(a)
  const y = toRgb(b)
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

/** 自定义主题的深色版：直接把两端压暗，够用且可预期 */
const darken = (hex: string, amount: number): string => mix(hex, '#15161a', amount)

/**
 * 算出实际要用的三个色标。
 * `intensity` 低时整体往中性底色靠，而不是简单降透明度——
 * 降透明度会让卡片阴影透出来发脏。
 */
export function resolveStops(
  theme: ThemeSetting,
  dark: boolean
): { stops: [string, string, string]; angle: number } {
  const neutral = dark ? '#1D1E22' : '#F1F1F4'
  let stops: [string, string, string]
  let angle = 155

  if (theme.paletteId === 'custom' && theme.custom) {
    const { from, to } = theme.custom
    angle = theme.custom.angle
    stops = dark
      ? [darken(from, 0.62), darken(mix(from, to, 0.5), 0.66), darken(to, 0.7)]
      : [from, mix(from, to, 0.5), to]
  } else {
    const id = LEGACY_PALETTE[theme.paletteId] ?? theme.paletteId
    const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0]
    stops = dark ? [...p.dark] : [...p.light]
  }

  const k = Math.max(0, Math.min(1, theme.intensity))
  if (k < 1) stops = stops.map((s) => mix(neutral, s, k)) as [string, string, string]
  return { stops, angle }
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * 从主题渐变推出强调色。
 *
 * 强调色写死成系统蓝的话，导航选中图标、标签里的数字、文字链、设置里的选中环
 * 全都跟不上主题——换成薰衣草配色后界面里还散着几处蓝，很突兀。
 *
 * 色相和饱和度一律取**浅色那组**的最深色标，明暗两种模式只调明度：
 * 深色那组本身已经压暗压灰，拿它推会得到一个发闷的强调色，两个模式下
 * 还会变成两种颜色。明度按模式定，保证在白纸和深纸上都读得清。
 *
 * 不强行拉高饱和度：石墨那套本来就是中性灰，推出来的灰强调色是它应有的样子，
 * 硬凑出一个蓝灰反而破坏了这套配色的意图。
 */
export function accentFor(theme: ThemeSetting, dark: boolean): {
  accent: string
  hover: string
  quiet: string
} {
  const { stops } = resolveStops({ ...theme, intensity: 1 }, false)
  const [h, s] = toHsl(stops[2])
  const sat = clamp(s * 100, 8, 88)
  const light = dark ? 68 : 44
  const hover = dark ? 76 : 37
  return {
    accent: `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${light}%)`,
    hover: `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${hover}%)`,
    quiet: `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${light}% / ${dark ? 0.22 : 0.13})`
  }
}

/** 侧边栏文字/图标该用深色还是浅色，取决于渐变的实际亮度 */
export function isLightGradient(stops: [string, string, string]): boolean {
  const lum = stops.reduce((sum, s) => {
    const [r, g, b] = toRgb(s)
    return sum + (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }, 0) / stops.length
  return lum > 0.55
}
