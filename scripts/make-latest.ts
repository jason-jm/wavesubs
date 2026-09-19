/**
 * 生成并上传 latest.json——应用「检查更新」读的那个静态文件。
 *
 *   npx tsx scripts/make-latest.ts            # 生成 release/latest.json（要求 Release 与安装包已传上去）
 *   npx tsx scripts/make-latest.ts --upload   # 生成并作为附件传到该版本的 Release（已存在就覆盖）
 *   npx tsx scripts/make-latest.ts --verify   # 从永久链接拉回来解析一遍，确认线上那份就是这个版本
 *
 * 版本号取 package.json；更新要点取仓库外的 ../store/release-notes-<版本>.md（中文在前、`---` 之后是英文；目录可用 WAVESUBS_STORE_DIR 覆盖）；
 * 各平台安装包地址从 Release 的附件列表里找（GitHub 会把文件名里的空格换成点，所以不能自己拼）。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersions, LATEST_JSON_URL, parseLatest } from '../src/shared/updates'
import type { LatestManifest } from '../src/shared/updates'

const ROOT = join(import.meta.dirname, '..')
/** 发布说明与 Homebrew cask 源文件放在仓库外（默认是仓库旁边的 store/），不进 GitHub */
const STORE = process.env.WAVESUBS_STORE_DIR ?? join(ROOT, '..', 'store')
const version = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version
const tag = `v${version}`
const REPO = 'jason-jm/wavesubs'
const args = new Set(process.argv.slice(2))

/** Markdown 里留给界面的只有文字：去掉加粗、标题、代码围栏，每种语言最多留 1400 个字符 */
function tidyNotes(md: string): string {
  const lines = md
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').trimEnd())
    .filter((l, i, arr) => !(l.trim() === '' && (arr[i - 1] ?? '').trim() === ''))
  let out = ''
  for (const l of lines) {
    if (out.length + l.length + 1 > 1400) break
    out += (out ? '\n' : '') + l
  }
  return out.trim()
}

function releaseNotes(): Record<string, string> | undefined {
  let md: string
  try {
    md = readFileSync(join(STORE, `release-notes-${version}.md`), 'utf8')
  } catch {
    console.warn(`  (没有 ${join(STORE, `release-notes-${version}.md`)}，latest.json 里不带更新要点)`)
    return undefined
  }
  const [zh, en] = md.split(/\n---\n/)
  const strip = (s: string | undefined): string => tidyNotes((s ?? '').replace(/^## .*\n/, ''))
  const notes: Record<string, string> = {}
  if (strip(zh)) notes['zh-Hans'] = strip(zh)
  if (strip(en)) notes.en = strip(en)
  return Object.keys(notes).length > 0 ? notes : undefined
}

function releaseAssets(): Array<{ name: string; url: string; size: number }> {
  const out = execFileSync('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'assets'], { encoding: 'utf8' })
  return (JSON.parse(out) as { assets: Array<{ name: string; url: string; size: number }> }).assets
}

if (args.has('--verify')) {
  const res = await fetch(LATEST_JSON_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`拉 latest.json 失败：HTTP ${res.status}`)
  const info = parseLatest(await res.json(), 'darwin', 'arm64')
  const same = compareVersions(info.version, version) === 0
  console.log(`线上 latest.json：版本 ${info.version}，mac 包 ${info.downloadUrl ?? '（无）'}`)
  if (!same) {
    console.error(`✗ 线上是 ${info.version}，本地 package.json 是 ${version}`)
    process.exit(1)
  }
  console.log('✓ 与本地版本一致')
  process.exit(0)
}

const assets = releaseAssets()
const find = (test: (name: string) => boolean): { url: string; sizeMB: number } | undefined => {
  const a = assets.find((x) => test(x.name))
  return a ? { url: a.url, sizeMB: Math.round(a.size / 1048576) } : undefined
}
const mac = find((n) => n.endsWith('.dmg'))
const win = find((n) => n.endsWith('.exe'))
if (!mac) throw new Error(`Release ${tag} 里没有 .dmg，先把安装包传上去`)
if (!win) console.warn(`  (Release ${tag} 里没有 Windows 安装包，latest.json 只带 mac)`)

const manifest: LatestManifest = {
  version,
  publishedAt: new Date().toISOString().slice(0, 10),
  notesUrl: `https://github.com/${REPO}/releases/tag/${tag}`,
  notes: releaseNotes(),
  assets: { 'darwin-arm64': mac, ...(win ? { 'win32-x64': win } : {}) }
}
// 自己生成的也要过一遍解析器：形状不对宁可在这里炸，别传上去让所有用户的检查都失败
parseLatest(manifest, 'darwin', 'arm64')
mkdirSync(join(ROOT, 'release'), { recursive: true })
const out = join(ROOT, 'release', 'latest.json')
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n')
console.log(`写入 ${out}：版本 ${version}，mac ${mac.sizeMB} MB${win ? `，win ${win.sizeMB} MB` : ''}`)

if (args.has('--upload')) {
  execFileSync('gh', ['release', 'upload', tag, out, '--repo', REPO, '--clobber'], { stdio: 'inherit' })
  console.log(`已传到 Release ${tag}；应用会从 ${LATEST_JSON_URL} 读到它`)
}
