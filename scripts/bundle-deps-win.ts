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
 *
 * 用法：
 *   tsx scripts/bundle-deps-win.ts            用 ~/Documents/Wave Subs/vendor/win/ 里手动下载的包（本机发版）
 *   tsx scripts/bundle-deps-win.ts --fetch    按下面钉死的官方地址下载并校验 sha256（GitHub Actions 用）
 *   环境变量 WAVESUBS_VENDOR_WIN 可指定源目录。
 *
 * 跨平台：解压用 tar（macOS / Windows 10+ 自带的 bsdtar 都能读 zip；GNU tar 不行，Linux 上需装 bsdtar），
 * LGPL 检查直接读二进制，不依赖 unzip / strings / du，因此在 windows-latest 的 runner 上也能跑。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'vendor-win')
const FETCH = process.argv.includes('--fetch')
const SRC =
  process.env.WAVESUBS_VENDOR_WIN ??
  (FETCH ? join(ROOT, 'vendor-win-src') : join(homedir(), 'Documents/Wave Subs/vendor/win'))

interface Part {
  /** 子目录名，同时也是 tools.ts 里注册的查找目录 */
  dir: string
  /** 源目录里的文件名 */
  zip: string
  /** 只挑这些可执行文件，其余（bench / test / stream 等几十个）不打包 */
  exes: string[]
  /** 钉死的官方预编译包；--fetch 时按它下载并校验，本机模式下只在不一致时提醒 */
  url: string
  sha256: string
}

const PARTS: Part[] = [
  {
    dir: 'ffmpeg',
    zip: 'ffmpeg-win.zip',
    exes: ['ffmpeg.exe', 'ffprobe.exe'],
    // BtbN 每日构建；钉 9.0.x 发布分支的 LGPL 共享库版
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-08-13-11/ffmpeg-n9.0.1-27-g9b0578816c-win64-lgpl-shared-9.0.zip',
    sha256: '688b013baa4c4a88508f6987460e81466c30426c07bae6e210731db400308eeb'
  },
  {
    dir: 'whisper',
    zip: 'whisper-win.zip',
    exes: ['whisper-cli.exe', 'whisper-vad-speech-segments.exe'],
    url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-blas-bin-x64.zip',
    sha256: '3c319eab3e87f85883e1ff3d14426c0a1986c661c5eb5985e8af431ed9c4f71f'
  },
  {
    dir: 'llama',
    zip: 'llama-win.zip',
    exes: ['llama-server.exe'],
    // Vulkan 版：包里同时带着全部 CPU 后端 DLL（ggml-cpu-*.dll），ggml 启动时按机器挑——有 Vulkan 设备
    // （NVIDIA / AMD / Intel 核显都行）就用 GPU 翻译，没有或驱动不支持就静默回落 CPU，不需要 CUDA 运行库
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/b10865/llama-b10865-bin-win-vulkan-x64.zip',
    sha256: '246346a8aadeb9db7fad4269081a8e5cabf8734f5fea8bfe2257dc139d499000'
  }
]

const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const sha256Of = (file: string): string => createHash('sha256').update(readFileSync(file)).digest('hex')

async function ensureZip(part: Part): Promise<string> {
  const zip = join(SRC, part.zip)
  if (existsSync(zip)) {
    const have = sha256Of(zip)
    if (have === part.sha256) return zip
    if (!FETCH) {
      console.warn(`  ⚠ ${part.zip} 与钉死的版本不同（本机 ${have.slice(0, 12)}… / 钉死 ${part.sha256.slice(0, 12)}…），照常使用本机版本`)
      return zip
    }
    console.log(`  ${part.zip} 校验值不符，重新下载`)
    rmSync(zip, { force: true })
  } else if (!FETCH) {
    console.error(`  ✗ 缺少 ${zip}，先下载 Windows 依赖包（见 RELEASE.md），或加 --fetch 自动下载`)
    process.exit(1)
  }
  mkdirSync(SRC, { recursive: true })
  console.log(`  下载 ${basename(part.url)} …`)
  const res = await fetch(part.url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status} ${part.url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const have = createHash('sha256').update(buf).digest('hex')
  if (have !== part.sha256) throw new Error(`${part.zip} sha256 不符：得到 ${have}，期望 ${part.sha256}`)
  writeFileSync(zip, buf)
  return zip
}

/** zip 里可执行文件所在的目录前缀（各家的包层级不同：根目录 / Release/ / <包名>/bin/），按内容找 */
function locate(entries: string[], exe: string): string {
  const hit = entries.find((e) => e === exe || e.endsWith(`/${exe}`))
  if (!hit) throw new Error(`包里找不到 ${exe}`)
  return hit.slice(0, hit.length - exe.length)
}

function dirSizeMB(dir: string): number {
  let total = 0
  for (const f of readdirSync(dir, { recursive: true }) as string[]) {
    const p = join(dir, f)
    if (statSync(p).isFile()) total += statSync(p).size
  }
  return Math.round(total / 1048576)
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  console.log(`准备 Windows 随包依赖（来源：${SRC}${FETCH ? '，按钉死版本下载' : ''}）：`)
  for (const part of PARTS) {
    const zip = await ensureZip(part)
    const dest = join(OUT, part.dir)
    const tmp = join(OUT, `.tmp-${part.dir}`)
    mkdirSync(dest, { recursive: true })
    mkdirSync(tmp, { recursive: true })

    const entries = sh('tar', ['-tf', zip]).split(/\r?\n/).filter(Boolean)
    const prefix = locate(entries, part.exes[0])
    // 只解出需要的 exe 和同目录的全部 DLL；bench/test/stream 那几十个 exe 一并跳过
    const members = entries.filter(
      (e) => e.startsWith(prefix) && !e.slice(prefix.length).includes('/') &&
        (part.exes.includes(e.slice(prefix.length)) || e.endsWith('.dll'))
    )
    sh('tar', ['-xf', zip, '-C', tmp, ...members])

    const from = prefix ? join(tmp, prefix) : tmp
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
    console.log(`  ${part.dir.padEnd(10)} ${part.exes.length} 个 exe + ${dlls} 个 DLL  （${basename(prefix || '.')}/）`)
  }

  /**
   * 自检：ffmpeg 必须是 LGPL 构建。BtbN 同时发 gpl 和 lgpl 两种包，
   * 下错一个会让整个分发包被 GPL 传染，而这从文件名之外看不出来。
   * 直接在二进制里找 configure 参数串，不依赖 strings 命令。
   */
  const ffmpegBin = readFileSync(join(OUT, 'ffmpeg', 'ffmpeg.exe'))
  if (!ffmpegBin.includes('--prefix=')) {
    console.error('\n✗ ffmpeg.exe 里找不到 configure 参数，无法确认许可证，拒绝打包')
    process.exit(1)
  }
  if (ffmpegBin.includes('--enable-gpl') || ffmpegBin.includes('--enable-nonfree')) {
    console.error('\n✗ 随包的 Windows ffmpeg 含 GPL 组件，不能用于闭源分发。请下载 lgpl 版本。')
    process.exit(1)
  }

  // Silero VAD 模型随包自带，理由同 bundle-deps.ts
  mkdirSync(join(OUT, 'vad'), { recursive: true })
  copyFileSync(join(ROOT, 'assets', 'ggml-silero-v5.1.2.bin'), join(OUT, 'vad', 'ggml-silero-v5.1.2.bin'))
  console.log(`\nvendor-win/ 合计 ${dirSizeMB(OUT)} MB  ·  ffmpeg LGPL 校验通过 ✅`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
