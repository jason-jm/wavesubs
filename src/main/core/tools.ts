import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

const IS_WINDOWS = process.platform === 'win32'

/**
 * macOS 的 GUI 应用从 Finder 启动时 PATH 不含 Homebrew 目录，需要显式补上。
 * Windows 上没有对应的约定位置，只靠随包目录和 PATH。
 */
const EXTRA_BIN_DIRS = IS_WINDOWS ? [] : ['/opt/homebrew/bin', '/usr/local/bin']

/** Windows 上可执行文件带 .exe，查找时要补齐；传进来的名字统一不带后缀 */
function exeName(name: string): string {
  // 已经带扩展名的（win-ocr.ps1）不再补 .exe
  return IS_WINDOWS && !/\.[A-Za-z0-9]{1,4}$/.test(name) ? `${name}.exe` : name
}

/**
 * 随包分发的二进制目录，优先级高于系统 PATH——用户机器上可能装着版本不一样的
 * ffmpeg，随包那份才是我们测过的。
 *
 * 为什么是**多个**目录而不是一个：Windows 上 whisper 和 llama 各自带同名不同版本的
 * `ggml.dll` / `ggml-base.dll`，而 Windows 的 DLL 搜索以 exe 所在目录优先，
 * 放进同一个目录必然互相覆盖，谁后拷谁赢。所以两边各占一个子目录、各自带自己的 DLL。
 * macOS 上没这个问题（dylib 路径在二进制里写死），一个目录就够。
 *
 * 用注入而不是直接读 Electron 的 process.resourcesPath，是为了让 core/ 保持
 * 与 Electron 解耦：scripts/cli.ts 不经过主进程，照旧走 PATH 查找。
 */
let bundledBinDirs: string[] = []

export function setBundledBinDirs(dirs: string[]): void {
  bundledBinDirs = dirs.filter((d) => existsSync(d))
}

function searchInPath(name: string): string | null {
  const dirs = [
    ...bundledBinDirs,
    ...(process.env.PATH ?? '').split(delimiter),
    ...EXTRA_BIN_DIRS
  ]
  for (const dir of dirs) {
    if (!dir) continue
    const candidate = join(dir, exeName(name))
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function findTool(name: string, envVar: string, installHint: string): string {
  const fromEnv = process.env[envVar]
  if (fromEnv) {
    if (existsSync(fromEnv)) return fromEnv
    throw new Error(`${envVar} 指向的文件不存在: ${fromEnv}`)
  }
  const found = searchInPath(name)
  if (found) return found
  throw new Error(
    `找不到 ${name}。正常情况下它随应用一起分发，出现这个错误通常说明安装包不完整——` +
      `请重新下载。开发环境下可以 ${installHint}，或用环境变量 ${envVar} 指定其路径`
  )
}

export const ffmpegPath = (): string => findTool('ffmpeg', 'WAVESUBS_FFMPEG', 'brew install ffmpeg')
export const visionOcrPath = (): string => findTool('vision-ocr', 'WAVESUBS_VISION_OCR', 'npm run build:native')
export const winOcrScriptPath = (): string => findTool('win-ocr.ps1', 'WAVESUBS_WIN_OCR', '把仓库里的 native/win-ocr/win-ocr.ps1 放进随包目录')
/** Windows PowerShell 5.1（系统自带）；win-ocr.ps1 只能在它里面跑，PowerShell 7 投影不了 WinRT */
export const powershellPath = (): string =>
  join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** Windows 上已装的 OCR 语言标签；null 表示还没探测 */
let winOcrLanguages: string[] | null = null
let winOcrProbe: Promise<string[]> | null = null

/**
 * 探测 Windows 自带 OCR 装了哪些语言。要起一个 PowerShell（一两秒），所以启动时异步做一次，
 * 结果缓存；signsSupported() 读缓存，appInfo 与开任务之前先 await 一下。
 */
export function probeWindowsOcr(): Promise<string[]> {
  if (!IS_WINDOWS) return Promise.resolve([])
  if (!winOcrProbe) {
    winOcrProbe = new Promise<string[]>((resolve) => {
      let script: string
      try {
        script = winOcrScriptPath()
      } catch {
        winOcrLanguages = []
        resolve([])
        return
      }
      execFile(
        powershellPath(),
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ListLangs'],
        { timeout: 30_000, windowsHide: true },
        (err, stdout) => {
          winOcrLanguages = err ? [] : stdout.trim().split(',').map((x) => x.trim()).filter(Boolean)
          resolve(winOcrLanguages)
        }
      )
    })
  }
  return winOcrProbe
}

/** 识别程序的路径：macOS 是自编的 vision-ocr，Windows 是随包的 PowerShell 脚本 */
export const ocrHelperPath = (): string => (IS_WINDOWS ? winOcrScriptPath() : visionOcrPath())

/**
 * 画面文字识别可用吗。macOS：随包的 vision-ocr 在就行（系统 Vision 框架，零模型下载）。
 * Windows：随包脚本在、且系统至少装了一种 OCR 语言（语言包里的「光学字符识别」）。
 */
export function signsSupported(): boolean {
  if (IS_WINDOWS) return (winOcrLanguages?.length ?? 0) > 0
  if (process.platform !== 'darwin') return false
  try {
    visionOcrPath()
    return true
  } catch {
    return false
  }
}
export const ffprobePath = (): string => findTool('ffprobe', 'WAVESUBS_FFPROBE', 'brew install ffmpeg')
export const whisperCliPath = (): string =>
  findTool('whisper-cli', 'WAVESUBS_WHISPER', 'brew install whisper-cpp')
export const vadBinPath = (): string =>
  findTool('whisper-vad-speech-segments', 'WAVESUBS_VAD_BIN', 'brew install whisper-cpp')

export async function listWhisperModels(modelsDir: string): Promise<string[]> {
  try {
    const entries = await readdir(modelsDir)
    return entries
      .filter((f) => f.startsWith('ggml-') && f.endsWith('.bin') && !f.includes('silero'))
      .sort()
  } catch {
    return []
  }
}

export async function listLocalLlmModels(llmDir: string): Promise<string[]> {
  try {
    const entries = await readdir(llmDir)
    return entries.filter((f) => f.endsWith('.gguf')).sort()
  } catch {
    return []
  }
}
