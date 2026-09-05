import type { TranslateConfig, TranslationProvider } from './types'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openaiCompatible'

/** 按配置里的协议选客户端。openai 和 azure 共用一个实现，只有地址和认证头不同 */
export function createCloudProvider(config: TranslateConfig): TranslationProvider {
  if (config.protocol === 'anthropic') return new AnthropicProvider(config)
  return new OpenAICompatibleProvider(config)
}
