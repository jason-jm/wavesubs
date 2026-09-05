import type { BatchItem, TranslateConfig, TranslateContext, TranslationProvider } from './types'
import { TranslationParseError } from './types'
import { postJsonWithRetry } from './http'
import { buildSystemPrompt, buildUserContent, parseBatchResponse } from './prompt'

const ANTHROPIC_VERSION = '2023-06-01'
/** 一批 20 条字幕的译文远用不到这么多，留足余量避免中途截断 */
const MAX_TOKENS = 8192

/**
 * Claude 原生接口和 OpenAI 的差别：认证头是 x-api-key、要带 anthropic-version、
 * max_tokens 必填、system 是顶层字段、返回的是 content 块数组而不是 choices。
 */
export function normalizeAnthropicBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/messages$/i, '')
}

/**
 * 关掉深度思考能让字幕翻译快很多，但 Fable / Mythos 系列上显式 disabled 会直接 400
 * （这两个模型的思考不可关闭），只能整个字段都不发。
 */
function thinkingExtras(model: string): Record<string, unknown> {
  const id = model.toLowerCase()
  if (id.includes('fable') || id.includes('mythos')) return {}
  return { thinking: { type: 'disabled' } }
}

export class AnthropicProvider implements TranslationProvider {
  readonly name = 'anthropic'

  constructor(private config: TranslateConfig) {}

  async translateBatch(items: BatchItem[], ctx: TranslateContext): Promise<Map<number, string>> {
    const body = JSON.stringify({
      model: this.config.model,
      max_tokens: MAX_TOKENS,
      // 新一代 Claude 已移除 temperature，发了会 400，所以一律不带
      system: buildSystemPrompt(ctx),
      messages: [{ role: 'user', content: buildUserContent(items, ctx) }],
      ...thinkingExtras(this.config.model)
    })
    const data = (await postJsonWithRetry(
      `${normalizeAnthropicBaseUrl(this.config.baseUrl)}/messages`,
      {
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body
    )) as {
      content?: Array<{ type?: string; text?: string }>
      stop_reason?: string
    }

    // 安全分类器拒答时是 HTTP 200 + 空 content，不检查会当成解析失败，报错很难懂
    if (data.stop_reason === 'refusal') {
      throw new TranslationParseError('模型拒绝翻译这一批内容（安全策略），该段将保留原文')
    }
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('')
    return parseBatchResponse(text)
  }
}
