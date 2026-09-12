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

/**
 * 语种采样窗口：在人声最密的地方取几段 20 秒（彼此隔开 ≥2 分钟），而不是只看开头 30 秒。
 * whisper 自带的检测只看第一段——NHK 剧开头 56 秒是片头音乐，被判成英语后整集识别成英文胡话。
 */
export function pickDetectionWindows(
  regions: Array<{ startMs: number; endMs: number }>,
  durationSec: number,
  opts: { windowSec?: number; maxWindows?: number; minGapSec?: number; minSpeechSec?: number } = {}
): number[] {
  const win = opts.windowSec ?? 20
  const maxWindows = opts.maxWindows ?? 5
  const minGap = opts.minGapSec ?? 120
  const minSpeech = opts.minSpeechSec ?? 8
  const scored: Array<{ start: number; speech: number }> = []
  for (let start = 0; start + win <= durationSec; start += 10) {
    let speech = 0
    for (const r of regions) speech += Math.max(0, Math.min(r.endMs / 1000, start + win) - Math.max(r.startMs / 1000, start))
    if (speech >= minSpeech) scored.push({ start, speech })
  }
  scored.sort((a, b) => b.speech - a.speech || a.start - b.start)
  const picked: number[] = []
  for (const c of scored) {
    if (picked.length >= maxWindows) break
    if (picked.every((p) => Math.abs(p - c.start) >= minGap)) picked.push(c.start)
  }
  return picked.sort((a, b) => a - b)
}

/** 在一段 WAV 上跑 whisper 的语种检测（-dl，只看开头 30 秒就退出），返回语种与概率 */
async function detectOnSample(whisperCli: string, modelPath: string, wavPath: string, signal?: AbortSignal): Promise<{ language: string; p: number } | null> {
  return new Promise((resolve) => {
    const child = spawn(whisperCli, ['-m', modelPath, '-f', wavPath, '-dl', '-l', 'auto', '-t', '4'])
    const onAbort = (): void => { child.kill() }
    signal?.addEventListener('abort', onAbort, { once: true })
    let out = ''
    child.stderr.on('data', (c: Buffer) => { out += c.toString() })
    child.stdout.resume()
    child.on('error', () => resolve(null))
    child.on('close', () => {
      signal?.removeEventListener('abort', onAbort)
      const m = /auto-detected language:\s*([a-z]{2,3})\s*\(p\s*=\s*([\d.]+)\)/.exec(out)
      resolve(m ? { language: m[1], p: Number(m[2]) } : null)
    })
  })
}

/**
 * 多点采样判语种：从人声密集处取几段 20 秒各自检测，按概率加权投票。
 * 返回 undefined 表示没把握（没有足够人声、全部失败或票数太散），调用方退回 whisper 自己的检测。
 */
export async function detectLanguageBySampling(opts: {
  whisperCli: string
  ffmpeg: string
  modelPath: string
  wavPath: string
  workDir: string
  regions: Array<{ startMs: number; endMs: number }>
  durationSec: number
  signal?: AbortSignal
}): Promise<{ language: string; votes: Record<string, number>; samples: number } | undefined> {
  const starts = pickDetectionWindows(opts.regions, opts.durationSec)
  if (starts.length === 0) return undefined
  const results = await Promise.all(
    starts.map(async (start, i) => {
      const sample = join(opts.workDir, `langdet-${i}.wav`)
      const ok = await new Promise<boolean>((resolve) => {
        const child = spawn(opts.ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(start), '-t', '20', '-i', opts.wavPath, '-c:a', 'pcm_s16le', sample])
        child.on('error', () => resolve(false))
        child.on('close', (code) => resolve(code === 0))
      })
      if (!ok) return null
      return detectOnSample(opts.whisperCli, opts.modelPath, sample, opts.signal)
    })
  )
  const votes: Record<string, number> = {}
  let samples = 0
  for (const r of results) {
    if (!r) continue
    samples += 1
    votes[r.language] = (votes[r.language] ?? 0) + r.p
  }
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) return undefined
  const [language, score] = ranked[0]
  // 至少要么一段很确定（≥0.8），要么两段以上加起来过 1.0，否则不如让 whisper 自己判
  if (score < 0.8) return undefined
  return { language, votes, samples }
}
