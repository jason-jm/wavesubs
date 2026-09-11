import { createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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

type Progress = Omit<ModelDownloadProgress, 'kind'>

/**
 * huggingface.co 在中国大陆不可达，hf-mirror.com 是路径完全一致的镜像。
 * 官方优先；官方 STAGGER_MS 内没回应就并行去连镜像，谁先回来用谁。
 * 赢过的来源记在内存里并落盘到模型目录：下一个文件、下一次启动都直接从它下，不再先等官方超时。
 */
const HF_OFFICIAL = 'https://huggingface.co/'
const HF_MIRRORS = ['https://hf-mirror.com/']
/** ModelScope 镜像了 Qwen 官方 GGUF 仓库（路径规则不同：/models/Qwen/<repo>/resolve/master/<file>）；whisper 的 ggml 它没有 */
const MODELSCOPE = 'https://modelscope.cn/'
const HOSTS = [HF_OFFICIAL, ...HF_MIRRORS, MODELSCOPE]
const PREFERRED_HOST_FILE = '.download-host'
let preferredHost: string | null = null

/** 一个下载地址展开成按优先级排列的候选列表；非 Hugging Face 的地址原样返回 */
export function candidateUrls(url: string): string[] {
  if (!url.startsWith(HF_OFFICIAL)) return [url]
  const path = url.slice(HF_OFFICIAL.length)
  const list = [HF_OFFICIAL + path, ...HF_MIRRORS.map((h) => h + path)]
  const qwen = /^Qwen\/([^/]+)\/resolve\/main\/(.+)$/.exec(path)
  if (qwen) list.push(`${MODELSCOPE}models/Qwen/${qwen[1]}/resolve/master/${qwen[2]}`)
  // 记住的来源排最前：上次谁赢了这次直接从它下
  if (preferredHost) {
    const i = list.findIndex((u) => u.startsWith(preferredHost as string))
    if (i > 0) list.unshift(...list.splice(i, 1))
  }
  return list
}

/** 仅测试用：清掉记住的来源偏好 */
export function resetPreferredHost(): void {
  preferredHost = null
}

/** 官方多久没回应就并行发起镜像。被墙时 TCP 握手会一直挂着，不能干等 */
const STAGGER_MS = 3000
/** 单次尝试拿到响应头的上限；只管响应头，正文动辄几个 GB 不能用同一个超时 */
const HEADERS_TIMEOUT_MS = 20_000

export class ModelDownloader {
  private active = new Map<string, AbortController>()
  private readonly fetchImpl: FetchLike
  private readonly staggerMs: number
  private hostLoaded = false

  constructor(
    private modelsDir: string,
    opts: { fetch?: FetchLike; staggerMs?: number } = {}
  ) {
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init))
    this.staggerMs = opts.staggerMs ?? STAGGER_MS
  }

  activeFiles(): string[] {
    return [...this.active.keys()]
  }

  async download(file: string, url: string, onProgress?: (p: Progress) => void): Promise<void> {
    if (this.active.has(file)) throw new LocalizedError('error.modelDownloading')
    await mkdir(this.modelsDir, { recursive: true })
    await this.loadPreferredHost()
    const controller = new AbortController()
    this.active.set(file, controller)
    const partPath = join(this.modelsDir, `${file}.download`)
    const finalPath = join(this.modelsDir, file)
    try {
      // 先告诉界面「在连」：被墙时官方要等几秒才切镜像，这段时间不能让用户对着 0% 干瞪眼
      onProgress?.({ file, phase: 'connecting', percent: -1, receivedMB: 0, totalMB: 0 })
      const { res, host } = await this.open(url, controller.signal)
      const total = Number(res.headers.get('content-length') ?? 0)
      const totalMB = Math.round(total / 1048576)
      onProgress?.({ file, phase: 'downloading', percent: total > 0 ? 0 : -1, receivedMB: 0, totalMB })
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
              phase: 'downloading',
              percent: total > 0 ? Math.round((received / total) * 100) : -1,
              receivedMB: Math.round(received / 1048576),
              totalMB
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
      if (host) await this.savePreferredHost(host)
      onProgress?.({ file, phase: 'downloading', percent: 100, receivedMB: Math.round(received / 1048576), totalMB })
    } catch (err) {
      await rm(partPath, { force: true })
      if (controller.signal.aborted) throw new DownloadCancelledError()
      throw err
    } finally {
      this.active.delete(file)
    }
  }

  private async loadPreferredHost(): Promise<void> {
    if (this.hostLoaded || preferredHost) return
    this.hostLoaded = true
    try {
      const saved = (await readFile(join(this.modelsDir, PREFERRED_HOST_FILE), 'utf8')).trim()
      if (HOSTS.includes(saved)) preferredHost = saved
    } catch {
      /* 没记过就走默认顺序 */
    }
  }

  private async savePreferredHost(host: string): Promise<void> {
    preferredHost = host
    try {
      await writeFile(join(this.modelsDir, PREFERRED_HOST_FILE), host)
    } catch {
      /* 记不下也不影响本次下载 */
    }
  }

  /**
   * 候选地址错开发起：第一个在 staggerMs 内没回应就并行发起下一个；任何一个失败立刻补发下一个。
   * 谁先拿到可读的 200 响应谁赢，其余全部中止。全部失败抛本地化错误；用户取消抛 DownloadCancelledError。
   */
  private open(url: string, userSignal: AbortSignal): Promise<{ res: Response; host: string | null }> {
    const candidates = candidateUrls(url)
    return new Promise((resolve, reject) => {
      const attempts: AbortController[] = []
      const timers: NodeJS.Timeout[] = []
      const errors: unknown[] = []
      let next = 0
      let failed = 0
      let done = false

      const finish = (fn: () => void): void => {
        if (done) return
        done = true
        timers.forEach(clearTimeout)
        userSignal.removeEventListener('abort', onUserAbort)
        fn()
      }
      const onUserAbort = (): void => {
        attempts.forEach((a) => a.abort())
        finish(() => reject(new DownloadCancelledError()))
      }
      userSignal.addEventListener('abort', onUserAbort, { once: true })

      const launch = (): void => {
        if (done || next >= candidates.length) return
        const candidate = candidates[next++]
        const ctrl = new AbortController()
        attempts.push(ctrl)
        const headersTimer = setTimeout(() => ctrl.abort(), HEADERS_TIMEOUT_MS)
        timers.push(headersTimer)
        // 这个还没回应就并行试下一个
        if (next < candidates.length) timers.push(setTimeout(launch, this.staggerMs))

        const fail = (err: unknown): void => {
          if (done) return
          errors.push(err)
          failed += 1
          console.warn(`[download] ${candidate} 失败：`, (err as Error)?.message ?? err)
          if (next < candidates.length) {
            launch() // 立刻补发下一个，不等错开计时
          } else if (failed >= candidates.length) {
            const all = new LocalizedError('error.modelDownloadFailed')
            ;(all as Error & { cause?: unknown }).cause = errors[errors.length - 1]
            finish(() => reject(all))
          }
        }

        this.fetchImpl(candidate, { signal: ctrl.signal, redirect: 'follow' }).then(
          (res) => {
            clearTimeout(headersTimer)
            if (done) {
              ctrl.abort() // 别人先赢了，这个响应不要
              return
            }
            if (!res.ok || !res.body) {
              ctrl.abort()
              fail(new Error(`HTTP ${res.status} ${candidate}`))
              return
            }
            const host = HOSTS.find((h) => candidate.startsWith(h)) ?? null
            attempts.filter((a) => a !== ctrl).forEach((a) => a.abort())
            finish(() => {
              // 赢家的正文还要读很久，用户取消要能掐断它
              userSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
              resolve({ res, host })
            })
          },
          (err) => {
            clearTimeout(headersTimer)
            fail(err)
          }
        )
      }
      launch()
    })
  }

  cancel(file: string): void {
    this.active.get(file)?.abort()
  }

  async delete(file: string): Promise<void> {
    if (this.active.has(file)) throw new LocalizedError('error.modelDownloadingCancelFirst')
    await rm(join(this.modelsDir, file), { force: true })
  }
}
