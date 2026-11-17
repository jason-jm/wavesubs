import { setTimeout as delay } from 'node:timers/promises'
import { TranslationConfigError } from './types'

const REQUEST_TIMEOUT_MS = 300_000
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [2000, 6000]
/** 限流与服务端抖动可以重试；4xx 里的配置类错误不行 */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

export class TranslationHttpError extends TranslationConfigError {
  constructor(readonly status: number, readonly param: string | undefined, message: string) { super(message) }
}

/**
 * 发一次翻译请求，超时/限流/服务端错误自动重试；配置类错误立刻抛出。
 * 各家协议的请求体和响应结构不同，但重试策略是一样的。
 */
export async function postJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  signal?: AbortSignal
): Promise<unknown> {
  let lastError: Error = new Error('翻译请求失败')
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    // 用户取消：不发、不等、不重试。本地 llama-server 一批要几十秒，云端超时 300 秒，
    // 不把取消传到 fetch 的话，点了「取消」还得干等这一批跑完
    signal?.throwIfAborted()
    let wait = RETRY_DELAYS_MS[attempt] ?? 0
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout
      })
      if (res.ok) return await res.json()
      const text = await res.text().catch(() => '')
      let detail: { param?: string; code?: string; type?: string } = {}
      try { detail = JSON.parse(text)?.error ?? {} } catch { /* Some gateways return plain text. */ }
      const message = `翻译接口返回 HTTP ${res.status}：${text.slice(0, 300)}`
      const retryAfter = res.headers.get('retry-after')
      if (retryAfter) {
        const seconds = Number(retryAfter)
        const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
        if (Number.isFinite(ms)) wait = Math.max(0, ms)
      }
      if (!RETRYABLE_STATUS.has(res.status) || wait > 60_000 ||
          (res.status === 429 && (attempt === MAX_ATTEMPTS - 1 || [detail.code, detail.type].includes('insufficient_quota'))))
        throw new TranslationHttpError(res.status, detail.param, message)
      lastError = new Error(message)
    } catch (err) {
      if (err instanceof TranslationConfigError) throw err
      lastError = err instanceof Error ? err : new Error(String(err))
    }
    signal?.throwIfAborted()
    if (attempt < MAX_ATTEMPTS - 1) await delay(wait, undefined, { signal })
  }
  throw lastError
}
