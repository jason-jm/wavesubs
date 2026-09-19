/**
 * 检查更新的纯逻辑自检：版本号比较、latest.json 解析、更新要点按语言回退。
 */
import { compareVersions, parseLatest, pickNotes } from '../src/shared/updates'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  console.log(`  ${g === w ? '✓' : '✗'} ${name}${g === w ? '' : `\n      得到 ${g}\n      期望 ${w}`}`)
  if (g !== w) bad += 1
}
const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0)

console.log('版本号比较：')
eq('1.0.8 新于 1.0.7', sign(compareVersions('1.0.8', '1.0.7')), 1)
eq('1.0.10 新于 1.0.9（按数字不按字符串）', sign(compareVersions('1.0.10', '1.0.9')), 1)
eq('1.1.0 新于 1.0.99', sign(compareVersions('1.1.0', '1.0.99')), 1)
eq('2.0 等于 2.0.0', sign(compareVersions('2.0', '2.0.0')), 0)
eq('带 v 前缀照样比', sign(compareVersions('v1.0.8', '1.0.7')), 1)
eq('预发布版旧于同号正式版', sign(compareVersions('1.1.0-beta.1', '1.1.0')), -1)
eq('正式版新于预发布版', sign(compareVersions('1.1.0', '1.1.0-beta.1')), 1)
eq('当前更新时返回负数', sign(compareVersions('1.0.7', '1.0.8')), -1)

console.log('latest.json 解析：')
const manifest = {
  version: '1.0.8',
  publishedAt: '2026-09-20',
  notesUrl: 'https://github.com/jason-jm/wavesubs/releases/tag/v1.0.8',
  notes: { 'zh-Hans': '- 修了翻译', en: '- Fixed translation' },
  assets: {
    'darwin-arm64': { url: 'https://github.com/jason-jm/wavesubs/releases/download/v1.0.8/Wave.Subs-1.0.8-arm64.dmg', sizeMB: 236 },
    'win32-x64': { url: 'https://github.com/jason-jm/wavesubs/releases/download/v1.0.8/Wave.Subs.Setup.1.0.8.exe', sizeMB: 158 }
  }
}
const mac = parseLatest(manifest, 'darwin', 'arm64')
eq('mac 取到 dmg 与体积', [mac.version, mac.downloadUrl?.endsWith('.dmg'), mac.sizeMB], ['1.0.8', true, 236])
const win = parseLatest(manifest, 'win32', 'x64')
eq('Windows 取到 exe', win.downloadUrl?.endsWith('.exe'), true)
const other = parseLatest(manifest, 'linux', 'x64')
eq('没有该平台的包时只留说明链接', [other.downloadUrl, other.notesUrl], [undefined, manifest.notesUrl])
let threw = ''
try { parseLatest({ notesUrl: manifest.notesUrl }, 'darwin', 'arm64') } catch (e) { threw = (e as Error).message }
eq('缺版本号就报错', threw.includes('版本号'), true)
threw = ''
try { parseLatest({ ...manifest, notesUrl: 'https://evil.example.com/x' }, 'darwin', 'arm64') } catch (e) { threw = (e as Error).message }
eq('说明链接不在我们仓库下就报错', threw.includes('不可信'), true)
const hijacked = parseLatest({ ...manifest, assets: { 'darwin-arm64': { url: 'https://evil.example.com/a.dmg' } } }, 'darwin', 'arm64')
eq('下载地址不在我们仓库下就当没有', hijacked.downloadUrl, undefined)
eq('要点里的空串不算', parseLatest({ ...manifest, notes: { en: '  ' } }, 'darwin', 'arm64').notes, undefined)

console.log('更新要点按语言回退：')
eq('有这门语言就用它', pickNotes(manifest.notes, 'en'), '- Fixed translation')
eq('繁体界面退到简体', pickNotes(manifest.notes, 'zh-Hant'), '- 修了翻译')
eq('其它语言退到英文', pickNotes(manifest.notes, 'ja'), '- Fixed translation')
eq('只有中文时任何语言都拿中文', pickNotes({ 'zh-Hans': '要点' }, 'de'), '要点')
eq('没有要点返回 undefined', pickNotes(undefined, 'en'), undefined)

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
