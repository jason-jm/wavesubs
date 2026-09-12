import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Cue } from '../subtitle/types'
import { LocalizedError } from '../../../shared/i18n/core'

export interface WhisperOptions {
  audioPath: string
  modelPath: string
  /** ISO 639-1 语言码，缺省 'auto' 自动检测 */
  language?: string
  /** 直接追加给 whisper-cli 的额外参数（评测实验 / 高级选项用，例如 --prompt） */
  extraArgs?: string[]
  threads?: number
  onProgress?: (percent: number) => void
  /** 自动检测出语种时立刻回调（识别开始后几秒内）：画面文字 OCR 等着它选识别语言，不用等整段识别完 */
  onLanguage?: (language: string) => void
  /** 用户取消：杀掉 whisper-cli 子进程并抛 error.jobCancelled */
  signal?: AbortSignal
}

export interface AsrResult {
  language: string
  cues: Cue[]
  /** 识别实际跑在哪：GPU 名（Apple M1 / NVIDIA …）或 'CPU'。给界面显示，用户反馈「慢」时一眼能看出没吃到 GPU */
  device?: string
}

/**
 * 从 whisper.cpp 的日志里认出计算设备。各后端的行不一样：
 *   Metal   ggml_metal_device_init: GPU name:   MTL0 (Apple M4 Max)
 *   Vulkan  ggml_vulkan: 0 = NVIDIA GeForce RTX 4070 (NVIDIA) | uma: 0 | …
 *   CUDA    ggml_cuda_init: found 1 CUDA devices: / Device 0: NVIDIA GeForce RTX 4070, compute capability 8.9
 */
export function detectDevice(log: string): string {
  const metal = /GPU name:\s*(?:MTL\d+\s*)?\(?([^)\n]+)\)?/.exec(log)
  if (metal) return metal[1].trim()
  const vulkan = /ggml_vulkan:\s*0\s*=\s*([^|(\n]+)/.exec(log)
  if (vulkan) return `${vulkan[1].trim()} (Vulkan)`
  const cuda = /Device 0:\s*([^,\n]+)/.exec(log)
  if (cuda && /CUDA/.test(log)) return `${cuda[1].trim()} (CUDA)`
  return 'CPU'
}

interface WhisperJsonOutput {
  result?: { language?: string }
  transcription?: Array<{
    offsets: { from: number; to: number }
    text: string
  }>
}

export async function transcribeWithWhisperCpp(
  whisperCli: string,
  opts: WhisperOptions
): Promise<AsrResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'wavesubs-whisper-'))
  const outBase = join(workDir, 'transcript')
  const language = opts.language || 'auto'
  const args = [
    '-m', opts.modelPath,
    '-f', opts.audioPath,
    '-l', language,
    '-t', String(opts.threads ?? Math.min(8, availableParallelism())),
    '-oj',
    '-of', outBase,
    '-pp',
    // 跨窗口不携带文本上下文：显著降低配乐段落里的复读循环风险
    '-mc', '0',
    ...(opts.extraArgs ?? [])
  ]
  try {
    let deviceLog = ''
    let languageReported = false
    await new Promise<void>((resolve, reject) => {
      const child = spawn(whisperCli, args)
      let stderrTail = ''
      const onAbort = (): void => { child.kill() }
      if (opts.signal?.aborted) onAbort()
      else opts.signal?.addEventListener('abort', onAbort, { once: true })
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderrTail = (stderrTail + text).slice(-4000)
        // 设备信息只在启动头几秒打印，单独攒一份，别被后面的进度行冲掉
        if (deviceLog.length < 20000) deviceLog += text
        for (const match of text.matchAll(/progress\s*=\s*(\d+)%/g)) {
          opts.onProgress?.(Math.min(100, Number(match[1])))
        }
        if (!languageReported) {
          const m = /auto-detected language:\s*([a-z]{2,3})/.exec(text)
          if (m) {
            languageReported = true
            opts.onLanguage?.(m[1])
          }
        }
      })
      child.stdout.resume()
      child.on('error', reject)
      child.on('close', (code) => {
        opts.signal?.removeEventListener('abort', onAbort)
        if (opts.signal?.aborted) reject(new LocalizedError('error.jobCancelled'))
        else if (code === 0) resolve()
        else reject(new Error(`whisper-cli 识别失败（退出码 ${code}）\n${stderrTail}`))
      })
    })

    const raw = JSON.parse(await readFile(`${outBase}.json`, 'utf8')) as WhisperJsonOutput
    const cues: Cue[] = []
    for (const seg of raw.transcription ?? []) {
      const text = (seg.text ?? '').trim()
      if (!text) continue
      cues.push({
        index: cues.length + 1,
        startMs: seg.offsets.from,
        endMs: seg.offsets.to,
        text
      })
    }
    const detected = raw.result?.language
    return {
      language: detected ?? (language === 'auto' ? 'unknown' : language),
      cues,
      device: detectDevice(deviceLog)
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
