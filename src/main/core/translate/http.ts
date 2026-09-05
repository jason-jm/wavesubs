import { setTimeout as delay } from 'node:timers/promises'
import { TranslationConfigError } from './types'

const REQUEST_TIMEOUT_MS = 300_000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [2000, 6000]
/** 限流与服务端抖动可以重试；4xx 里的配置类错误不行 */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

/**
 * 发一次翻译请求，超时/限流/服务端错误自动重试；配置类错误立刻抛出。
 * 各家协议的请求体和响应结构不同，但重试策略是一样的。
 */
export async function postJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<unknown> {
  let lastError: Error = new Error('翻译请求失败')
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      if (res.ok) return await res.json()
      const text = (await res.text().catch(() => '')).slice(0, 300)
      const message = `翻译接口返回 HTTP ${res.status}：${text}`
      if (!RETRYABLE_STATUS.has(res.status)) throw new TranslationConfigError(message)
      lastError = new Error(message)
    } catch (err) {
      if (err instanceof TranslationConfigError) throw err
      lastError = err instanceof Error ? err : new Error(String(err))
    }
    if (attempt < MAX_ATTEMPTS - 1) await delay(RETRY_DELAYS_MS[attempt])
  }
  throw lastError
}
