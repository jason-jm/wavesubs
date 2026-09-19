import { app, net } from 'electron'
import { existsSync } from 'node:fs'
import type { InstallSource, UpdateStatus } from '../shared/types'
import { compareVersions, LATEST_JSON_URL, parseLatest } from '../shared/updates'

/** 一次检查最多等这么久：静态文件、走 GitHub 的 CDN，8 秒还没回来就是网络不通 */
const TIMEOUT_MS = 8000

/**
 * 装的来源决定怎么更新：Homebrew / Scoop 装的要走它们自己的升级命令，手动覆盖会和包管理器打架；
 * App Store 版由 App Store 更新，根本不该检查。
 */
export function detectInstallSource(): InstallSource {
  if (process.mas) return 'mas'
  if (process.platform === 'darwin') {
    if (['/opt/homebrew/Caskroom/wavesubs', '/usr/local/Caskroom/wavesubs'].some((p) => existsSync(p))) return 'homebrew'
  }
  if (process.platform === 'win32' && /[\\/]scoop[\\/]apps[\\/]wavesubs[\\/]/i.test(process.execPath)) return 'scoop'
  return 'manual'
}

export interface UpdateCheckerOptions {
  /** 已跳过的版本（持久化在设置里） */
  skippedVersion: () => string | undefined
  setSkippedVersion: (version: string | undefined) => void
  onChange: (status: UpdateStatus) => void
  /** 测试用：换掉网络与地址 */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  url?: string
}

export class UpdateChecker {
  private status: UpdateStatus
  private inflight: Promise<UpdateStatus> | null = null

  constructor(private readonly opts: UpdateCheckerOptions) {
    this.status = { state: 'idle', current: app.getVersion(), installSource: detectInstallSource() }
  }

  current(): UpdateStatus {
    return this.status
  }

  /**
   * 查一次。手动点的会把「跳过」清掉——用户主动来看，就该看到最新的那个。
   * 同一时刻只跑一次，重复点的等同一个结果。
   */
  check(manual: boolean): Promise<UpdateStatus> {
    if (this.inflight) return this.inflight
    this.inflight = this.run(manual).finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  skip(version: string): UpdateStatus {
    this.opts.setSkippedVersion(version)
    if (this.status.latest?.version === version) this.set({ ...this.status, skipped: true })
    return this.status
  }

  private set(next: UpdateStatus): void {
    this.status = next
    this.opts.onChange(next)
  }

  private async run(manual: boolean): Promise<UpdateStatus> {
    if (manual) this.opts.setSkippedVersion(undefined)
    this.set({ ...this.status, state: 'checking', error: undefined })
    const base = { current: this.status.current, installSource: this.status.installSource, checkedAt: Date.now() }
    try {
      const doFetch = this.opts.fetch ?? ((url: string, init: RequestInit) => net.fetch(url, init))
      const res = await doFetch(this.opts.url ?? LATEST_JSON_URL, {
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const latest = parseLatest(await res.json(), process.platform, process.arch)
      if (compareVersions(latest.version, base.current) > 0) {
        this.set({ ...base, state: 'available', latest, skipped: this.opts.skippedVersion() === latest.version })
      } else {
        this.set({ ...base, state: 'latest' })
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[update] 检查更新失败：${reason}`)
      this.set({ ...base, state: 'error', error: reason })
    }
    return this.status
  }
}
