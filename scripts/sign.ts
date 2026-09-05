/**
 * 给打好的 .app 做签名。
 *
 * 为什么必须有这一步：electron-builder 在 identity: null 时会跳过签名，
 * 留下的是 Electron 原始的 linker 签名（标识还叫 "Electron"）。而它改过
 * Info.plist、换过图标、重命名过可执行文件，那份签名已经不覆盖新内容了。
 * Apple Silicon 上签名不完整的程序会被内核直接拒绝加载。
 *
 * 为什么要挑签名身份，而不是一律 ad-hoc：ad-hoc 签名（-）的「指定要求」
 * 就是可执行文件的 cdhash，每重新打一次包就变一次。macOS 钥匙串条目的访问
 * 控制记的正是这个要求，于是每次重打包之后，safeStorage 第一次读 API Key
 * 都会弹「Wave Subs 想要使用你储存在钥匙串的 "Wave Subs Safe Storage" 中的机密
 * 信息」。换成一张固定的证书，这个要求才稳定，授权一次之后不再打扰。
 *
 * 身份来源按优先级：
 *   1. 环境变量 WAVESUBS_SIGN_IDENTITY（也认 electron-builder 的 CSC_NAME）
 *   2. 钥匙串里的 Developer ID Application —— 对外分发用
 *   3. 钥匙串里名字含 Wave Subs 的自签名证书 —— 本机开发用，创建方法见下面的提示
 *   4. 都没有才退回 ad-hoc，并提醒钥匙串会反复弹窗
 *
 * 顺序必须从内到外：framework → helper → 外壳。`--deep` 已被 Apple 弃用，
 * 它对嵌套 bundle 的处理顺序不保证，实测会漏签。
 */
import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

// 这个脚本整套依赖 codesign / security，只有 macOS 有。
// 在 Windows 上开发时 `npm run dist` 会走到这里，静默跳过而不是报错退出。
if (process.platform !== 'darwin') {
  console.log('非 macOS，跳过签名（Windows 的签名走 electron-builder 的 Authenticode）')
  process.exit(0)
}
/**
 * 必须走 fileURLToPath 而不是 `new URL(...).pathname`——产品名带空格，
 * pathname 会把它编码成 `Wave%20Subs.app`，existsSync 直接找不到。
 */
const APP = fileURLToPath(new URL('../release/mac-arm64/Wave Subs.app', import.meta.url))

if (!existsSync(APP)) {
  console.error(`找不到 ${APP}，先跑 electron-builder`)
  process.exit(1)
}

/** find-identity 每行形如 `1) ABCD… "Developer ID Application: Foo (TEAM)"`，只要引号里那截 */
async function installedIdentities(): Promise<string[]> {
  const out = await run('security', ['find-identity', '-v', '-p', 'codesigning'])
    .then((r) => r.stdout)
    .catch(() => '')
  return [...out.matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

async function pickIdentity(): Promise<string> {
  const explicit = (process.env.WAVESUBS_SIGN_IDENTITY ?? process.env.CSC_NAME ?? '').trim()
  if (explicit) return explicit
  const found = await installedIdentities()
  return (
    found.find((n) => n.startsWith('Developer ID Application')) ??
    found.find((n) => n.includes('Wave Subs')) ??
    '-'
  )
}

const identity = await pickIdentity()
const adhoc = identity === '-'
// Developer ID 的包要能过公证，时间戳不能省；自签名和 ad-hoc 只在本机跑，
// 连 Apple 的时间戳服务器纯属白等，网络不通时还会直接把签名卡死
const timestamp = identity.startsWith('Developer ID Application') ? '--timestamp' : '--timestamp=none'

const sign = async (target: string): Promise<void> => {
  await run('codesign', ['--force', '--sign', identity, timestamp, target])
}

const frameworks = join(APP, 'Contents/Frameworks')
const entries = existsSync(frameworks) ? await readdir(frameworks) : []
for (const name of entries.filter((n) => n.endsWith('.framework'))) {
  await sign(join(frameworks, name))
}
for (const name of entries.filter((n) => n.endsWith('.app'))) {
  await sign(join(frameworks, name))
}
await sign(APP)

// codesign -dv 把信息写到 stderr 而不是 stdout，成功时也一样
const info = await run('codesign', ['-dv', APP])
  .then((r) => String(r.stderr))
  .catch((e: { stderr?: string }) => String(e.stderr ?? ''))
const id = /Identifier=(.+)/.exec(info)?.[1] ?? '未知'
await run('codesign', ['--verify', '--strict', APP])
console.log(`已签名并校验通过：${id}（身份：${adhoc ? 'ad-hoc' : identity}）`)

if (adhoc) {
  console.warn(
    [
      '',
      '注意：这次是 ad-hoc 签名，指纹每次打包都会变。',
      '后果是每重打一次包，第一次用云端翻译时 macOS 都会弹一次',
      '「Wave Subs 想要使用你储存在钥匙串的 "Wave Subs Safe Storage" 中的机密信息」。',
      '',
      '想不再被打扰，做一张固定的自签名证书（一次就够）：',
      '  钥匙串访问 → 菜单「证书助理」→「创建证书…」',
      '  名称：Wave Subs Self-Signed　身份类型：自签名根证书　证书类型：代码签名',
      '建好之后本脚本会自动挑到它。对外分发则用 Developer ID Application 证书。'
    ].join('\n')
  )
}
