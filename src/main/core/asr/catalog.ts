import type { TranslationKey } from '../../../shared/i18n/core'

export interface WhisperModelSpec {
  file: string
  name: string
  sizeMB: number
  /** 运行时大致需要的空闲内存（GB） */
  ramGB: number
  /** 识别质量 1-5 */
  quality: number
  /** 相对速度 1-5 */
  speed: number
  /** 机型要求与说明都存翻译键，展示时按界面语言解析 */
  requirement: TranslationKey
  detail: TranslationKey
  recommendedDefault?: boolean
}

export const WHISPER_MODELS: WhisperModelSpec[] = [
  {
    file: 'ggml-tiny.bin',
    name: 'Tiny',
    sizeMB: 75,
    ramGB: 0.5,
    quality: 1,
    speed: 5,
    requirement: 'req.anyMac',
    detail: 'asr.tiny.detail'
  },
  {
    file: 'ggml-base.bin',
    name: 'Base',
    sizeMB: 142,
    ramGB: 0.7,
    quality: 2,
    speed: 5,
    requirement: 'req.anyMac',
    detail: 'asr.base.detail'
  },
  {
    file: 'ggml-small.bin',
    name: 'Small',
    sizeMB: 466,
    ramGB: 1.2,
    quality: 3,
    speed: 4,
    requirement: 'req.mac8gb',
    detail: 'asr.small.detail'
  },
  {
    file: 'ggml-medium.bin',
    name: 'Medium',
    sizeMB: 1536,
    ramGB: 2.6,
    quality: 4,
    speed: 2,
    requirement: 'req.appleSiliconPreferred',
    detail: 'asr.medium.detail'
  },
  {
    file: 'ggml-large-v3-turbo.bin',
    name: 'Large v3 Turbo',
    sizeMB: 1620,
    ramGB: 2.2,
    quality: 4.5,
    speed: 4,
    requirement: 'req.appleSilicon8',
    detail: 'asr.largeTurbo.detail'
  },
  {
    file: 'ggml-large-v3.bin',
    name: 'Large v3',
    sizeMB: 3100,
    ramGB: 4.5,
    quality: 5,
    speed: 1,
    requirement: 'req.appleSilicon16',
    detail: 'asr.large.detail',
    recommendedDefault: true
  }
]

export function modelDownloadUrl(file: string): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`
}

/** Silero VAD 模型：用于字幕时间校正与幻觉剔除（不参与转写） */
export const VAD_MODEL_FILE = 'ggml-silero-v5.1.2.bin'
export const VAD_MODEL_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin'

export function findModelSpec(file: string): WhisperModelSpec | undefined {
  return WHISPER_MODELS.find((m) => m.file === file)
}

/** 优先「默认推荐」款（实测最稳），其次按质量从高到低 */
export function pickBestInstalled(installed: string[]): string | null {
  const ordered = [...WHISPER_MODELS].sort(
    (a, b) =>
      Number(b.recommendedDefault ?? false) - Number(a.recommendedDefault ?? false) ||
      b.quality - a.quality
  )
  for (const spec of ordered) {
    if (installed.includes(spec.file)) return spec.file
  }
  return installed[0] ?? null
}
