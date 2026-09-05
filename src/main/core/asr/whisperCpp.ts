import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Cue } from '../subtitle/types'

export interface WhisperOptions {
  audioPath: string
  modelPath: string
  /** ISO 639-1 语言码，缺省 'auto' 自动检测 */
  language?: string
  threads?: number
  onProgress?: (percent: number) => void
}

export interface AsrResult {
  language: string
  cues: Cue[]
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
    '-mc', '0'
  ]
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(whisperCli, args)
      let stderrTail = ''
      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString()
        stderrTail = (stderrTail + text).slice(-4000)
        for (const match of text.matchAll(/progress\s*=\s*(\d+)%/g)) {
          opts.onProgress?.(Math.min(100, Number(match[1])))
        }
      })
      child.stdout.resume()
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
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
      cues
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
