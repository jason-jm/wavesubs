import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelDownloadProgress } from '../../shared/types'
import { LocalizedError } from '../../shared/i18n/core'

/** 用户主动取消下载。界面据此静默忽略，不能靠比对文案——文案会随语言变 */
export class DownloadCancelledError extends Error {
  readonly cancelled = true
  constructor() {
    super('download cancelled')
  }
}

/** fetch 的最小子集：主进程注入 Electron 的 net.fetch（走 Chromium 网络栈、认系统代理），CLI 用 Node 自带的 */
export type FetchLike = (
  input: string,
  init: { signal: AbortSignal; redirect: 'follow' }
) => Promise<Response>

/**
 * huggingface.co 在中国大陆不可达，hf-mirror.com 是路径完全一致的镜像。
 * 官方优先，连不上再换镜像；哪个成功了就记住，下一个文件直接从它下，不再每次先等官方超时。
 */
const HF_OFFICIAL = 'https://huggingface.co/'
const HF_MIRRORS = ['https://hf-mirror.com/']
let preferredHost: string | null = null

/** 一个下载地址展开成按优先级排列的候选列表；非 Hugging Face 的地址原样返回 */
export function candidateUrls(url: string): string[] {
  if (!url.startsWith(HF_OFFICIAL)) return [url]
  const path = url.slice(HF_OFFICIAL.length)
  const hosts = [HF_OFFICIAL, ...HF_MIRRORS]
  if (preferredHost && hosts.includes(preferredHost)) {
    hosts.splice(hosts.indexOf(preferredHost), 1)
    hosts.unshift(preferredHost)
  }
  return hosts.map((h) => h + path)
}

/** 仅测试用：清掉记住的镜像偏好 */
export function resetPreferredHost(): void {
  preferredHost = null
}

/**
 * 响应头阶段的超时。被墙时 TCP 握手会一直挂着，不设上限就永远切不到镜像。
 * 只管「拿到响应头」这一步；正文动辄几个 GB，不能用同一个超时。
 */
const HEADERS_TIMEOUT_MS = 20_000

export class ModelDownloader {
  private active = new Map<string, AbortController>()
  private readonly fetchImpl: FetchLike

  constructor(
    private modelsDir: string,
    opts: { fetch?: FetchLike } = {}
  ) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
  }

  activeFiles(): string[] {
    return [...this.active.keys()]
  }

  async download(
    file: string,
    url: string,
    onProgress?: (p: Omit<ModelDownloadProgress, 'kind'>) => void
  ): Promise<void> {
    if (this.active.has(file)) throw new LocalizedError('error.modelDownloading')
    await mkdir(this.modelsDir, { recursive: true })
    const controller = new AbortController()
    this.active.set(file, controller)
    const partPath = join(this.modelsDir, `${file}.download`)
    const finalPath = join(this.modelsDir, file)
    try {
      const { res, host } = await this.open(url, controller.signal)
      const total = Number(res.headers.get('content-length') ?? 0)
      const out = createWriteStream(partPath)
      let received = 0
      let lastEmit = 0
      try {
        for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
          received += chunk.length
          if (!out.write(chunk)) await once(out, 'drain')
          const now = Date.now()
          if (now - lastEmit > 300) {
            lastEmit = now
            onProgress?.({
              file,
              percent: total > 0 ? Math.round((received / total) * 100) : -1,
              receivedMB: Math.round(received / 1048576),
              totalMB: Math.round(total / 1048576)
            })
          }
        }
        await new Promise<void>((resolve, reject) => {
          out.end(() => resolve())
          out.on('error', reject)
        })
      } catch (err) {
        out.destroy()
        throw err
      }
      await rename(partPath, finalPath)
      if (host) preferredHost = host
      onProgress?.({
        file,
        percent: 100,
        receivedMB: Math.round(received / 1048576),
        totalMB: Math.round(total / 1048576)
      })
    } catch (err) {
      await rm(partPath, { force: true })
      if (controller.signal.aborted) throw new DownloadCancelledError()
      throw err
    } finally {
      this.active.delete(file)
    }
  }

  /**
   * 逐个候选地址尝试，直到拿到可读的 200 响应。
   * 每次尝试用独立的 AbortController：响应头超时只掐当前这次；用户取消则一并掐掉。
   */
  private async open(url: string, userSignal: AbortSignal): Promise<{ res: Response; host: string | null }> {
    const candidates = candidateUrls(url)
    let lastErr: unknown
    for (const candidate of candidates) {
      if (userSignal.aborted) throw new DownloadCancelledError()
      const attempt = new AbortController()
      const onUserAbort = (): void => attempt.abort()
      userSignal.addEventListener('abort', onUserAbort, { once: true })
      const timer = setTimeout(() => attempt.abort(), HEADERS_TIMEOUT_MS)
      try {
        const res = await this.fetchImpl(candidate, { signal: attempt.signal, redirect: 'follow' })
        clearTimeout(timer)
        if (!res.ok || !res.body) {
          userSignal.removeEventListener('abort', onUserAbort)
          lastErr = new Error(`HTTP ${res.status} ${candidate}`)
          continue
        }
        // 成功后 onUserAbort 保持挂着：用户取消时要能中断正文读取
        const host = [HF_OFFICIAL, ...HF_MIRRORS].find((h) => candidate.startsWith(h)) ?? null
        return { res, host }
      } catch (err) {
        clearTimeout(timer)
        userSignal.removeEventListener('abort', onUserAbort)
        if (userSignal.aborted) throw new DownloadCancelledError()
        lastErr = err
        console.warn(`[download] ${candidate} 失败，${candidates.length > 1 ? '换下一个来源' : '无备用来源'}：`, (err as Error)?.message ?? err)
      }
    }
    const failed = new LocalizedError('error.modelDownloadFailed')
    ;(failed as Error & { cause?: unknown }).cause = lastErr
    throw failed
  }

  cancel(file: string): void {
    this.active.get(file)?.abort()
  }

  async delete(file: string): Promise<void> {
    if (this.active.has(file)) throw new LocalizedError('error.modelDownloadingCancelFirst')
    await rm(join(this.modelsDir, file), { force: true })
  }
}
