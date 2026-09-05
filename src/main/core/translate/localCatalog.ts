import type { TranslationKey } from '../../../shared/i18n/core'

export interface LocalLlmSpec {
  file: string
  name: string
  sizeMB: number
  /** 运行时大致需要的空闲内存（GB），含 KV cache */
  ramGB: number
  /** 翻译质量 1-5 */
  quality: number
  /** 相对速度 1-5 */
  speed: number
  /** 机型要求与说明都存翻译键，展示时按界面语言解析 */
  requirement: TranslationKey
  detail: TranslationKey
  url: string
  recommendedDefault?: boolean
}

const HF = 'https://huggingface.co/Qwen'

export const LOCAL_LLM_MODELS: LocalLlmSpec[] = [
  {
    file: 'Qwen3-1.7B-Q8_0.gguf',
    name: 'Qwen3 1.7B',
    sizeMB: 1834,
    ramGB: 2.5,
    quality: 2,
    speed: 5,
    requirement: 'req.mac8gb',
    detail: 'llm.1_7b.detail',
    url: `${HF}/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q8_0.gguf`
  },
  {
    file: 'Qwen3-4B-Q4_K_M.gguf',
    name: 'Qwen3 4B',
    sizeMB: 2440,
    ramGB: 3.5,
    quality: 3,
    speed: 4,
    requirement: 'req.llm8or16',
    detail: 'llm.4b.detail',
    url: `${HF}/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf`
  },
  {
    file: 'Qwen3-8B-Q4_K_M.gguf',
    name: 'Qwen3 8B',
    sizeMB: 5030,
    ramGB: 6,
    quality: 4,
    speed: 3,
    requirement: 'req.appleSilicon16plus',
    detail: 'llm.8b.detail',
    url: `${HF}/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf`,
    recommendedDefault: true
  },
  {
    file: 'Qwen3-14B-Q4_K_M.gguf',
    name: 'Qwen3 14B',
    sizeMB: 9200,
    ramGB: 10.5,
    quality: 4.5,
    speed: 2,
    requirement: 'req.llm24or32',
    detail: 'llm.14b.detail',
    url: `${HF}/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf`
  },
  {
    file: 'Qwen3-32B-Q4_K_M.gguf',
    name: 'Qwen3 32B',
    sizeMB: 20200,
    ramGB: 22,
    quality: 5,
    speed: 1,
    requirement: 'req.appleSilicon48',
    detail: 'llm.32b.detail',
    url: `${HF}/Qwen3-32B-GGUF/resolve/main/Qwen3-32B-Q4_K_M.gguf`
  }
]

export function findLocalLlmSpec(file: string): LocalLlmSpec | undefined {
  return LOCAL_LLM_MODELS.find((m) => m.file === file)
}

/** 按质量从高到低，在已安装模型里挑最好的 */
export function pickBestInstalledLlm(installed: string[]): string | null {
  const byQuality = [...LOCAL_LLM_MODELS].sort((a, b) => b.quality - a.quality)
  for (const spec of byQuality) {
    if (installed.includes(spec.file)) return spec.file
  }
  return installed[0] ?? null
}
