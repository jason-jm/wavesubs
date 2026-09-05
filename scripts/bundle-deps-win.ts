/**
 * 准备 Windows 版随包分发的外部依赖。
 *
 * 与 macOS 版（bundle-deps.ts）的关键差异：
 *
 * 1. **不自己编译**。macOS 上必须自编，因为 Homebrew 的 ggml 把后端搜索路径写死成
 *    `/opt/homebrew/Cellar/...`，用户机器上找不到。Windows 官方预编译包没有这个问题——
 *    ggml 的后端是与 exe 同目录的 DLL，而 Windows 的 DLL 搜索本来就以 exe 所在目录优先。
 *
 * 2. **必须分目录**。whisper 和 llama 各自带同名不同版本的 `ggml.dll` / `ggml-base.dll`，
 *    平铺到一个目录里必然互相覆盖、谁后拷谁赢，运行时症状是其中一个功能莫名其妙崩掉。
 *    所以三套各占一个子目录，各带各的 DLL。
 *
 * 3. **ffmpeg 用 BtbN 的 LGPL *共享库* 构建**。不用 GPL 版的理由和 macOS 一样：
 *    Wave Subs 只解码不编码，用不到 GPL 编码器，捆绑 GPL 会传染整个分发包。
 *    不用静态版则是因为 ffmpeg.exe 和 ffprobe.exe 会各自内嵌一整套编解码器，
 *    两个加起来 220MB；共享库版两者共用同一批 DLL，省一半还多。
 *    动态链接同时也让 LGPL 的「可替换库」要求天然满足。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const OUT = join(ROOT, 'vendor-win')
const SRC = join(process.env.HOME ?? '', 'Documents/wavesubs-vendor/win')

const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

interface Part {
  /** 子目录名，同时也是 tools.ts 里注册的查找目录 */
  dir: string
  zip: string
  /** 只挑这些可执行文件，其余（bench / test / stream 等几十个）不打包 */
  exes: string[]
  /** zip 里可执行文件所在的目录前缀，空串表示在根 */
  prefix: string
}

const PARTS: Part[] = [
  { dir: 'ffmpeg', zip: 'ffmpeg-win.zip', exes: ['ffmpeg.exe', 'ffprobe.exe'],
    prefix: 'ffmpeg-master-latest-win64-lgpl-shared/bin/' },
  { dir: 'whisper', zip: 'whisper-win.zip',
    exes: ['whisper-cli.exe', 'whisper-vad-speech-segments.exe'], prefix: 'Release/' },
  { dir: 'llama', zip: 'llama-win.zip', exes: ['llama-server.exe'], prefix: '' }
]

if (!existsSync(SRC)) {
  console.error(`找不到 ${SRC}，先下载 Windows 依赖包（见 RELEASE.md）`)
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

console.log('准备 Windows 随包依赖：')
for (const part of PARTS) {
  const zip = join(SRC, part.zip)
  if (!existsSync(zip)) {
    console.error(`  ✗ 缺少 ${part.zip}`)
    process.exit(1)
  }
  const dest = join(OUT, part.dir)
  const tmp = join(OUT, `.tmp-${part.dir}`)
  mkdirSync(dest, { recursive: true })
  mkdirSync(tmp, { recursive: true })

  // 只解出需要的 exe 和全部 DLL；bench/test/stream 那几十个 exe 一并跳过
  sh('unzip', ['-qo', zip, ...part.exes.map((e) => `${part.prefix}${e}`), '-d', tmp])
  try {
    sh('unzip', ['-qo', zip, `${part.prefix}*.dll`, '-d', tmp])
  } catch {
    // 某些包是静态构建、一个 DLL 都没有，unzip 匹配不到通配符会返回非零。这不是错误。
  }

  const from = part.prefix ? join(tmp, part.prefix) : tmp
  for (const f of readdirSync(from)) {
    if (statSync(join(from, f)).isDirectory()) continue
    renameSync(join(from, f), join(dest, f))
  }
  rmSync(tmp, { recursive: true, force: true })

  const files = readdirSync(dest)
  const missing = part.exes.filter((e) => !files.includes(e))
  if (missing.length > 0) {
    console.error(`  ✗ ${part.dir}: 缺少 ${missing.join(', ')}`)
    process.exit(1)
  }
  const dlls = files.filter((f) => f.endsWith('.dll')).length
  console.log(`  ${part.dir.padEnd(10)} ${part.exes.length} 个 exe + ${dlls} 个 DLL`)
}

/**
 * 自检：ffmpeg 必须是 LGPL 构建。BtbN 同时发 gpl 和 lgpl 两种包，
 * 下错一个会让整个分发包被 GPL 传染，而这从文件名之外看不出来。
 */
const ffmpegBuildInfo = sh('strings', [join(OUT, 'ffmpeg', 'ffmpeg.exe')])
  .split('\n')
  .find((l) => l.includes('--enable-') && l.includes('--prefix')) ?? ''
if (/--enable-gpl|--enable-nonfree/.test(ffmpegBuildInfo)) {
  console.error('\n✗ 随包的 Windows ffmpeg 含 GPL 组件，不能用于闭源分发。请下载 lgpl 版本。')
  process.exit(1)
}

console.log(`\nvendor-win/ 合计 ${sh('du', ['-sh', OUT]).split('\t')[0].trim()}  ·  ffmpeg LGPL 校验通过 ✅`)
