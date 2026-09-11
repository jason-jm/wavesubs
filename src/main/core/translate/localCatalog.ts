import type { TranslationKey } from '../../../shared/i18n/core'

export interface LocalLlmSpec {
  file: string
  /** 官方文件的 sha256：下载完成后核对 */
  sha256: string
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
    sha256: '061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a',
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
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
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
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
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
    sha256: '500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0',
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
    sha256: 'efd971561896866f0e910cce52761ca77b1b138090c7f15fe284676d57d1f689',
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
