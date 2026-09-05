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

export class ModelDownloader {
  private active = new Map<string, AbortController>()

  constructor(private modelsDir: string) {}

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
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow'
      })
      if (!res.ok || !res.body) throw new Error(`下载失败：HTTP ${res.status}`)
      const total = Number(res.headers.get('content-length') ?? 0)
      const out = createWriteStream(partPath)
      let received = 0
      let lastEmit = 0
      try {
        for await (const chunk of res.body) {
          const buf = chunk as Uint8Array
          received += buf.length
          if (!out.write(buf)) await once(out, 'drain')
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

  cancel(file: string): void {
    this.active.get(file)?.abort()
  }

  async delete(file: string): Promise<void> {
    if (this.active.has(file)) throw new LocalizedError('error.modelDownloadingCancelFirst')
    await rm(join(this.modelsDir, file), { force: true })
  }
}
