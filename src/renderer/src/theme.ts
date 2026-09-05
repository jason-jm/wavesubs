/**
 * 把主题设置写成 CSS 变量。
 *
 * 渐变色标不走 CSS 类名而是直接写变量，是因为用户可以自定义配色——
 * 类名穷举不了。同时按渐变实际亮度在 <html> 上打 data-grad 标记，
 * 让侧边栏文字在浅底渐变上用深色、深底渐变上用浅色。
 */
import { accentFor, isLightGradient, resolveStops, type ThemeSetting } from '../../shared/palettes'

export function applyTheme(theme: ThemeSetting, dark: boolean): void {
  const { stops, angle } = resolveStops(theme, dark)
  const root = document.documentElement
  root.style.setProperty('--grad-1', stops[0])
  root.style.setProperty('--grad-2', stops[1])
  root.style.setProperty('--grad-3', stops[2])
  root.style.setProperty('--grad-angle', `${angle}deg`)
  root.style.setProperty('--grain', String(theme.grain))
  // 强调色跟着主题走，否则导航选中、标签数字、文字链、选中环还是系统蓝
  const a = accentFor(theme, dark)
  root.style.setProperty('--accent', a.accent)
  root.style.setProperty('--accent-hover', a.hover)
  root.style.setProperty('--accent-quiet', a.quiet)
  root.dataset.grad = isLightGradient(stops) ? 'light' : 'dark'
}

/** 给色板预览用：不落到 document 上，只算出一段 CSS 渐变值 */
export function gradientCss(theme: ThemeSetting, dark: boolean): string {
  const { stops, angle } = resolveStops(theme, dark)
  return `linear-gradient(${angle}deg, ${stops[0]}, ${stops[1]} 52%, ${stops[2]})`
}
