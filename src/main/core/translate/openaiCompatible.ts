import type { BatchItem, TranslateConfig, TranslateContext, TranslationProvider } from './types'
import { postJsonWithRetry, TranslationHttpError } from './http'
import { cloudParallelism } from './types'
import { buildSystemPrompt, buildUserContent, parseBatchResponse } from './prompt'

/** Azure 的 URL 里必须带 api-version，用户没写就用这个 */
const AZURE_DEFAULT_API_VERSION = '2024-10-21'

/**
 * 各家「关闭深度思考」的参数不一样。字幕翻译不需要长思考，
 * 关掉能快数倍、也便宜得多，否则一批 20 条很容易撑爆超时。
 */
function noThinkingExtras(baseUrl: string): Record<string, unknown> {
  const host = baseUrl.toLowerCase()
  if (host.includes('volces.com')) return { thinking: { type: 'disabled' } }
  if (host.includes('dashscope')) return { enable_thinking: false }
  return {}
}

/**
 * 用户常直接粘贴文档里的完整 endpoint（.../v3/chat/completions 或方舟的 .../v3/responses），
 * 这里统一削回 base，避免拼出 .../chat/completions/chat/completions 这种地址。
 */
export function normalizeBaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:chat\/completions|responses|completions)$/i, '')
}

/**
 * Azure OpenAI 不走 /v1/chat/completions：部署名在路径里，版本号在 query 里。
 * 这里同时接受「只填资源域名」和「粘贴完整 endpoint」两种写法。
 */
function azureUrl(baseUrl: string, deployment: string): string {
  const [pathPart, query] = baseUrl.trim().replace(/\/+$/, '').split('?')
  const root = pathPart.replace(/\/openai\/deployments\/[^/]+(?:\/chat\/completions)?$/i, '')
  const version = new URLSearchParams(query ?? '').get('api-version') ?? AZURE_DEFAULT_API_VERSION
  return `${root}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(version)}`
}

/** OpenAI 的 /chat/completions 形态，以及和它只差 URL 与认证头的 Azure OpenAI */
export class OpenAICompatibleProvider implements TranslationProvider {
  readonly name: string
  readonly maxParallelBatches: number
  private tokenLimit: 'max_tokens' | 'max_completion_tokens'

  constructor(private config: TranslateConfig, private bundledLlama = false) {
    this.name = config.protocol === 'azure' ? 'azure-openai' : 'openai-compatible'
    this.maxParallelBatches = cloudParallelism(config.baseUrl)
    this.tokenLimit = config.protocol === 'azure' || /^https:\/\/api\.openai\.com(?:\/|$)/i.test(config.baseUrl)
      ? 'max_completion_tokens' : 'max_tokens'
  }

  async translateBatch(items: BatchItem[], ctx: TranslateContext): Promise<Map<number, string>> {
    const isAzure = this.config.protocol === 'azure'
    const body = JSON.stringify({
      // Azure 的模型由 URL 里的部署名决定，body 里的 model 会被忽略
      model: this.config.model,
      ...(this.bundledLlama ? { temperature: 0.3 } : {}),
      messages: [
        { role: 'system', content: buildSystemPrompt(ctx) },
        { role: 'user', content: buildUserContent(items, ctx) }
      ],
      ...noThinkingExtras(this.config.baseUrl)
    })
    const url = isAzure
      ? azureUrl(this.config.baseUrl, this.config.model)
      : `${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`
    const headers: Record<string, string> = isAzure
      ? { 'api-key': this.config.apiKey }
      : { authorization: `Bearer ${this.config.apiKey}` }

    const data = (await postJsonWithRetry(url, headers, body, ctx.signal)) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return parseBatchResponse(data.choices?.[0]?.message?.content ?? '', new Map(items.map((it) => [it.index, it.text])))
  }

  /**
   * 固定版 llama-server 支持确定性采样。云端模型自行提供兼容的采样默认值。
   */
  async chat(system: string, user: string, opts?: { signal?: AbortSignal; maxTokens?: number }): Promise<string> {
    const isAzure = this.config.protocol === 'azure'
    const body = {
      model: this.config.model,
      ...(this.bundledLlama ? { temperature: 0, top_p: 1, seed: 1 } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      ...noThinkingExtras(this.config.baseUrl)
    }
    const url = isAzure
      ? azureUrl(this.config.baseUrl, this.config.model)
      : `${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`
    const headers: Record<string, string> = isAzure
      ? { 'api-key': this.config.apiKey }
      : { authorization: `Bearer ${this.config.apiKey}` }
    const request = async (field: typeof this.tokenLimit): Promise<string> => {
      const data = (await postJsonWithRetry(url, headers, JSON.stringify({ ...body, [field]: opts?.maxTokens ?? 4000 }), opts?.signal)) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return data.choices?.[0]?.message?.content ?? ''
    }
    const field = this.tokenLimit
    try { return await request(field) }
    catch (err) {
      if (!(err instanceof TranslationHttpError) || ![400, 422].includes(err.status) || err.param !== field) throw err
      const alternate = field === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens'
      const reply = await request(alternate)
      this.tokenLimit = alternate
      return reply
    }
  }
}

export { parseBatchResponse }
