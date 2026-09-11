/**
 * 把 Wave Subs 依赖的外部可执行文件及其 dylib 收进 `vendor/`，随 .app 一起分发。
 *
 * 为什么必须做：这些工具原来靠 `brew install` 提供，从官网下载应用的普通用户
 * 没有 Homebrew，一导入视频就报「找不到 ffmpeg」。
 *
 * 关键动作是**重写动态库引用路径**：Homebrew 的二进制把 dylib 路径硬编码成
 * `/opt/homebrew/opt/...`，那在用户机器上不存在。要用 install_name_tool 把每条
 * 引用改成 `@executable_path/../lib/xxx.dylib`，同时把 dylib 自身的 install name
 * 也改掉——只改引用方不改被引用方，dyld 一样找不到。
 *
 * ffmpeg 走静态编译（见 ~/Documents/Wave Subs/vendor/build-ffmpeg.sh），单文件无依赖，
 * 所以这里只需要拷过来；whisper / llama 那几个才需要走完整的闭包搬运。
 */
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 不能用 URL.pathname：路径里的空格会保持 %20，「Wave Subs」就会变成另一个目录
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const VENDOR = join(ROOT, 'vendor')
const BIN = join(VENDOR, 'bin')
const LIB = join(VENDOR, 'lib')


const VENDOR_SRC = join(process.env.HOME ?? '', 'Documents/Wave Subs/vendor')
/** 自编的最小 LGPL ffmpeg */
const LGPL_FFMPEG = join(VENDOR_SRC, 'ffmpeg-lgpl/bin')
/** 自编的 whisper / llama（后端静态链入，不依赖运行时 dlopen） */
const GGML_TOOLS = join(VENDOR_SRC, 'ggml-tools')

const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

/** 系统自带的库不能也不该打包 */
const isSystemLib = (p: string): boolean =>
  p.startsWith('/usr/lib/') || p.startsWith('/System/')

function realPath(p: string): string {
  try {
    return sh('readlink', ['-f', p]).trim() || p
  } catch {
    return p
  }
}

function which(name: string): string | null {
  try {
    return realPath(sh('command', ['-v', name]).trim())
  } catch {
    for (const dir of ['/opt/homebrew/bin', '/usr/local/bin']) {
      if (existsSync(join(dir, name))) return realPath(join(dir, name))
    }
    return null
  }
}

/**
 * @rpath/xxx.dylib 这种引用要靠二进制自己的 LC_RPATH 才能解析。
 * Homebrew 的 whisper/llama 大量使用它，不展开就会漏掉一半依赖。
 */
function rpaths(file: string): string[] {
  const out = sh('otool', ['-l', file])
  const found: string[] = []
  const lines = out.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('LC_RPATH')) continue
    const pathLine = lines.slice(i, i + 4).find((l) => l.trim().startsWith('path '))
    if (pathLine) found.push(pathLine.trim().split(' ')[1])
  }
  return found
}

function resolveRef(ref: string, from: string): string | null {
  if (!ref.startsWith('@rpath/')) return isSystemLib(ref) ? null : realPath(ref)
  const leaf = ref.slice('@rpath/'.length)
  for (const rp of rpaths(from)) {
    const base = rp.replace('@loader_path', from.replace(/\/[^/]+$/, ''))
                   .replace('@executable_path', from.replace(/\/[^/]+$/, ''))
    const candidate = join(base, leaf)
    if (existsSync(candidate)) return realPath(candidate)
  }
  return null
}

/**
 * 广度优先收集依赖闭包，返回「原始真实路径 → 打包后文件名」的映射。
 *
 * 必须记住映射而不是直接按 basename 拷：Homebrew 的 dylib 是带版本号的软链
 * （`libggml.0.dylib` → `libggml.0.17.0.dylib`），引用里写的是软链名、realpath 是实名。
 * 早先按 realpath 的 basename 拷过去，再拿引用名去找就永远对不上，
 * 结果 install_name_tool 一条都没改成，产物看着打包好了、实际一启动就 dyld 报错。
 */
function closure(entry: string): Map<string, string> {
  const map = new Map<string, string>()
  const stack = [entry]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || !existsSync(cur)) continue
    for (const ref of allRefs(cur)) {
      const real = resolveRef(ref, cur)
      if (!real || map.has(real)) continue
      map.set(real, basename(real))
      stack.push(real)
    }
  }
  return map
}

/** 一个 Mach-O 文件里所有非系统的库引用（含 @rpath 形式） */
function allRefs(file: string): string[] {
  return sh('otool', ['-L', file])
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(' ')[0])
    .filter((p) => p && !isSystemLib(p))
}

const RELINK = (name: string): string => `@executable_path/../lib/${name}`

function bundle(name: string, from: string): void {
  const libs = closure(from)

  copyFileSync(from, join(BIN, name))
  chmodSync(join(BIN, name), 0o755)
  for (const [real, out] of libs) {
    copyFileSync(real, join(LIB, out))
    chmodSync(join(LIB, out), 0o755)
  }

  // 每个待处理文件都记住它的「原件」——引用要拿原件去解析（副本的 LC_RPATH 还指向 Homebrew）
  const jobs: Array<{ original: string; copy: string }> = [
    { original: from, copy: join(BIN, name) },
    ...[...libs].map(([real, out]) => ({ original: real, copy: join(LIB, out) }))
  ]

  for (const { copy } of jobs) {
    if (!copy.endsWith('.dylib')) continue
    sh('install_name_tool', ['-id', RELINK(basename(copy)), copy])
  }

  for (const { original, copy } of jobs) {
    for (const ref of allRefs(original)) {
      const real = resolveRef(ref, original)
      const out = real ? libs.get(real) : undefined
      if (!out) continue
      sh('install_name_tool', ['-change', ref, RELINK(out), copy])
    }
    // install_name_tool 的任何改动都会让原签名失效，而 Hardened Runtime 下
    // 签名失效的二进制根本起不来，所以每个文件改完必须立刻重签
    sh('codesign', ['--force', '--sign', '-', '--timestamp=none', copy])
  }
  console.log(`  ${name.padEnd(30)} + ${libs.size} 个 dylib`)
}

rmSync(VENDOR, { recursive: true, force: true })
mkdirSync(BIN, { recursive: true })
mkdirSync(LIB, { recursive: true })

console.log('打包随附二进制：')

const ffmpegSrc = existsSync(join(LGPL_FFMPEG, 'ffmpeg')) ? LGPL_FFMPEG : null
if (ffmpegSrc) {
  for (const n of ['ffmpeg', 'ffprobe']) bundle(n, join(ffmpegSrc, n))
} else {
  console.warn(
    '⚠ 没找到自编的 LGPL ffmpeg，退回 Homebrew 版。\n' +
      '  Homebrew 的 ffmpeg 是 --enable-gpl（含 x264/x265），随闭源应用分发会违反 GPL。\n' +
      '  正式发布前必须先跑 ~/Documents/Wave Subs/vendor/build-ffmpeg.sh。'
  )
  for (const n of ['ffmpeg', 'ffprobe']) {
    const p = which(n)
    if (p) bundle(n, p)
  }
}

/**
 * whisper / llama 必须用自编的静态版，不能用 Homebrew 的。
 *
 * Homebrew 开了 GGML_BACKEND_DL：ggml 的 BLAS/Metal/CPU 后端是运行时 dlopen 的独立 .so，
 * 而搜索路径 `/opt/homebrew/Cellar/ggml/<版本>/libexec` 是**编译期写死**在 libggml 里的。
 * 用户机器上没有 Homebrew，那个目录不存在 —— 实测结果是一个后端都加载不到，
 * 而 GGML_BACKEND_PATH 一次只认一个 .so，凑不齐三个。可执行文件同目录也不在搜索列表里。
 * 这个坑在开发机上完全看不出来（本地有 Homebrew，照常加载）。
 */
const staticTools = existsSync(join(GGML_TOOLS, 'whisper-cli'))
if (!staticTools) {
  console.error(
    '\n✗ 找不到自编的 whisper/llama（' + GGML_TOOLS + '）。\n' +
      '  不能退回 Homebrew 版本：它的 ggml 后端靠运行时 dlopen 一个写死的 Homebrew 路径，\n' +
      '  在用户机器上会一个后端都加载不到。先跑 ~/Documents/Wave Subs/vendor/build-ggml-tools.sh。'
  )
  process.exit(1)
}
for (const n of ['whisper-cli', 'whisper-vad-speech-segments', 'llama-server']) {
  const p = join(GGML_TOOLS, n)
  if (!existsSync(p)) {
    console.warn(`⚠ 自编产物里没有 ${n}，跳过`)
    continue
  }
  bundle(n, p)
}

/**
 * 自检：残留任何指向 Homebrew 的引用，就说明这个包在别人机器上必然起不来。
 * 这种错误在开发机上完全看不出来（本地有 /opt/homebrew，照样能跑），
 * 只有用户下载后才炸——所以必须在打包阶段就断掉。
 */
// Silero VAD 模型随包自带（不到 1MB）：时间校正不再依赖任何下载，大陆用户下不到 huggingface 也不受影响
const VAD_DIR = join(VENDOR, 'vad')
mkdirSync(VAD_DIR, { recursive: true })
copyFileSync(join(ROOT, 'assets', 'ggml-silero-v5.1.2.bin'), join(VAD_DIR, 'ggml-silero-v5.1.2.bin'))

const leftovers: string[] = []
for (const dir of [BIN, LIB]) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    // lib/ 下面还有 ggml/ 这个子目录，喂给 otool 会直接报错
    if (statSync(full).isDirectory()) continue
    const bad = allRefs(full).filter(
      (r) => r.startsWith('/opt/homebrew') || r.startsWith('/usr/local')
    )
    if (bad.length > 0) leftovers.push(`${f}: ${bad.join(', ')}`)
  }
}
if (leftovers.length > 0) {
  console.error('\n✗ 仍有指向 Homebrew 的引用，这个包在没装 Homebrew 的机器上会直接 dyld 崩溃：')
  for (const l of leftovers) console.error(`    ${l}`)
  process.exit(1)
}
console.log(`\nvendor/ 合计 ${sh('du', ['-sh', VENDOR]).split('\t')[0].trim()}  ·  依赖引用自检通过 ✅`)
