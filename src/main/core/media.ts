import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { BITMAP_SUBTITLE_CODECS } from './subtitle/import'
import { LocalizedError } from '../../shared/i18n/core'

const execFileAsync = promisify(execFile)

export interface AudioStreamInfo {
  /** 在所有音轨中的序号（ffmpeg 的 0:a:N） */
  audioIndex: number
  codec: string
  channels: number
  sampleRate: number
  language?: string
  title?: string
}

export interface SubtitleStreamInfo {
  /** 在所有字幕轨中的序号（ffmpeg 的 0:s:N） */
  subtitleIndex: number
  codec: string
  language?: string
  title?: string
  /** 图形字幕（PGS/VobSub 等）为 false，无法直接转成文本 */
  textBased: boolean
  forced: boolean
  hearingImpaired: boolean
}

export interface MediaInfo {
  path: string
  format: string
  durationSec: number
  audioStreams: AudioStreamInfo[]
  subtitleStreams: SubtitleStreamInfo[]
}

interface FfprobeStream {
  codec_type: string
  codec_name?: string
  channels?: number
  sample_rate?: string
  duration?: string
  disposition?: Record<string, number>
  tags?: Record<string, string>
}

export async function probeMedia(ffprobe: string, input: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync(
    ffprobe,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input],
    { maxBuffer: 32 * 1024 * 1024 }
  )
  const data = JSON.parse(stdout) as {
    format?: { format_name?: string; duration?: string }
    streams?: FfprobeStream[]
  }
  const streams = data.streams ?? []
  const audioStreams: AudioStreamInfo[] = streams
    .filter((s) => s.codec_type === 'audio')
    .map((s, i) => ({
      audioIndex: i,
      codec: s.codec_name ?? 'unknown',
      channels: s.channels ?? 0,
      sampleRate: Number(s.sample_rate ?? 0),
      language: s.tags?.language,
      title: s.tags?.title
    }))
  const subtitleStreams: SubtitleStreamInfo[] = streams
    .filter((s) => s.codec_type === 'subtitle')
    .map((s, i) => ({
      subtitleIndex: i,
      codec: s.codec_name ?? 'unknown',
      language: s.tags?.language,
      title: s.tags?.title,
      textBased: !BITMAP_SUBTITLE_CODECS.has(s.codec_name ?? ''),
      forced: Boolean(s.disposition?.forced),
      hearingImpaired: Boolean(s.disposition?.hearing_impaired)
    }))
  if (audioStreams.length === 0 && subtitleStreams.length === 0) {
    throw new LocalizedError('error.noAudioOrSubtitle')
  }
  const durationSec =
    Number(data.format?.duration ?? 0) ||
    Math.max(...streams.map((s) => Number(s.duration ?? 0)), 0)
  return {
    path: input,
    format: data.format?.format_name ?? 'unknown',
    durationSec,
    audioStreams,
    subtitleStreams
  }
}

export interface ExtractAudioOptions {
  input: string
  output: string
  audioIndex?: number
  durationSec?: number
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/** 抽取指定音轨并重采样为 Whisper 需要的 16kHz 单声道 WAV */
export async function extractAudio(ffmpeg: string, opts: ExtractAudioOptions): Promise<void> {
  const args = [
    '-y',
    '-v', 'error',
    '-progress', 'pipe:1',
    '-i', opts.input,
    '-map', `0:a:${opts.audioIndex ?? 0}`,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    opts.output
  ]
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, args)
    let stderrTail = ''
    const onAbort = (): void => { child.kill() }
    if (opts.signal?.aborted) onAbort()
    else opts.signal?.addEventListener('abort', onAbort, { once: true })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000)
    })
    child.stdout.on('data', (chunk: Buffer) => {
      // -progress 输出 key=value 行；out_time_us / out_time_ms 单位都是微秒
      for (const match of chunk.toString().matchAll(/out_time_(?:us|ms)=(\d+)/g)) {
        const seconds = Number(match[1]) / 1e6
        if (opts.durationSec && opts.durationSec > 0) {
          opts.onProgress?.(Math.min(100, (seconds / opts.durationSec) * 100))
        }
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort)
      if (opts.signal?.aborted) reject(new LocalizedError('error.jobCancelled'))
      else if (code === 0) resolve()
      else reject(new Error(`ffmpeg 抽取音频失败（退出码 ${code}）\n${stderrTail}`))
    })
  })
}
