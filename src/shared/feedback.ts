/** 反馈入口的链接：主进程菜单与设置页共用，改地址只改这里 */
export const SITE_URL = 'https://wavesubs.com/'
export const REPO_URL = 'https://github.com/jason-jm/wavesubs'
export const DISCUSSIONS_URL = `${REPO_URL}/discussions`
/** Mac App Store「写评价」直达链接（App Store Connect 的 App ID） */
export const APP_STORE_REVIEW_URL = 'macappstore://apps.apple.com/app/id6809120569?action=write-review'

/** 官网有独立语言页的目录；界面语言不在其中的用英文页 */
const SITE_LANG_DIRS = new Set(['en', 'ja', 'ko', 'fr', 'de', 'ru', 'id', 'ms', 'vi', 'th'])

/** 官网反馈表单地址，带上版本/系统/界面语言（表单里是隐藏字段） */
export function feedbackUrl(version: string, platform: string, locale: string): string {
  const base = locale.split(/[-_]/)[0].toLowerCase()
  const dir = locale.startsWith('zh') ? '' : SITE_LANG_DIRS.has(base) ? `${base}/` : 'en/'
  const q = new URLSearchParams({ v: version, os: platform, locale })
  return `${SITE_URL}${dir}feedback.html?${q.toString()}`
}

/** 只允许打开我们自己的站点、仓库与 App Store 评价链接，防止渲染进程被诱导打开任意地址 */
export function isAllowedExternalUrl(url: string): boolean {
  return url.startsWith(SITE_URL) || url.startsWith(REPO_URL) || url === APP_STORE_REVIEW_URL
}
