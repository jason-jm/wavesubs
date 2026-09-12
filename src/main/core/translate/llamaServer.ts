import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { findTool } from '../tools'
import { OpenAICompatibleProvider } from './openaiCompatible'
import type { BatchItem, TranslateContext, TranslationProvider } from './types'
import { LocalizedError } from '../../../shared/i18n/core'

const PORT = 18173

export const llamaServerPath = (): string =>
  findTool('llama-server', 'WAVESUBS_LLAMA_SERVER', 'brew install llama.cpp')

/**
 * 管理本地 llama-server 子进程（OpenAI 兼容接口）。
 * 同一模型复用已启动的服务，换模型时自动重启。
 */
export class LlamaServerManager {
  private proc: ChildProcess | null = null
  private currentModel: string | null = null
  private starting: Promise<string> | null = null

  get baseUrl(): string {
    return `http://127.0.0.1:${PORT}/v1`
  }

  async ensure(modelPath: string): Promise<string> {
    if (this.starting) await this.starting.catch(() => {})
    if (this.proc && this.proc.exitCode === null && this.currentModel === modelPath) {
      return this.baseUrl
    }
    this.starting = this.start(modelPath)
    try {
      return await this.starting
    } finally {
      this.starting = null
    }
  }

  private async start(modelPath: string): Promise<string> {
    this.stop()
    const bin = llamaServerPath()
    const proc = spawn(bin, [
      '-m', modelPath,
      '--port', String(PORT),
      '--host', '127.0.0.1',
      '-ngl', '99',
      '-c', '8192',
      // Qwen3 等思考型模型直接给答案，避免 <think> 拖慢并污染输出
      '--reasoning-budget', '0'
    ])
    let stderrTail = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-3000)
    })
    proc.stdout?.resume()
    this.proc = proc
    this.currentModel = modelPath

    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) {
        this.proc = null
        this.currentModel = null
        throw new Error(`本地翻译模型启动失败（退出码 ${proc.exitCode}）\n${stderrTail}`)
      }
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`, {
          signal: AbortSignal.timeout(2000)
        })
        if (res.ok) return this.baseUrl
      } catch {
        // 未就绪，继续等
      }
      await delay(500)
    }
    this.stop()
    throw new LocalizedError('error.llmLoadTimeout')
  }

  stop(): void {
    if (this.proc && this.proc.exitCode === null) {
      // Windows 上没有 POSIX 信号，Node 会把这里翻译成 TerminateProcess，
      // 效果是强制结束而非优雅退出。llama-server 不派生子进程，所以够用。
      this.proc.kill('SIGTERM')
    }
    this.proc = null
    this.currentModel = null
  }
}

/** 首次调用时按需启动 llama-server，再复用 OpenAI 兼容通道 */
export class LocalLlamaProvider implements TranslationProvider {
  readonly name = 'local-llama'
  private inner: OpenAICompatibleProvider | null = null

  constructor(
    private manager: LlamaServerManager,
    private modelPath: string,
    private targetLanguage: string
  ) {}

  private async ensureInner(): Promise<OpenAICompatibleProvider> {
    if (!this.inner) {
      const baseUrl = await this.manager.ensure(this.modelPath)
      this.inner = new OpenAICompatibleProvider({
        // llama-server 本身就是 OpenAI 兼容端点
        protocol: 'openai',
        baseUrl,
        apiKey: 'local',
        model: 'local',
        targetLanguage: this.targetLanguage
      })
    }
    return this.inner
  }

  async translateBatch(items: BatchItem[], ctx: TranslateContext): Promise<Map<number, string>> {
    return (await this.ensureInner()).translateBatch(items, ctx)
  }

  async chat(system: string, user: string, opts?: { signal?: AbortSignal; maxTokens?: number }): Promise<string> {
    return (await this.ensureInner()).chat(system, user, opts)
  }
}
