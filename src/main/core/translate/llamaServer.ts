import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { nativePaths } from '../asr/pathArgs'
import { createServer } from 'node:net'
import { findTool } from '../tools'
import { OpenAICompatibleProvider } from './openaiCompatible'
import type { BatchItem, TranslateContext, TranslationProvider } from './types'
import { looksUntranslated } from './prompt'
import { languageName, normalizeLanguageCode, TranslationParseError } from './types'
import { LocalizedError } from '../../../shared/i18n/core'

async function availablePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(err => err ? reject(err) : resolve(port))
    })
  })
}

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

  private port = 0
  private closed: Promise<void> = Promise.resolve()

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}/v1`
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
    await this.shutdown()
    this.port = await availablePort()
    const bin = llamaServerPath()
    const { paths: [model], cwd, release } = await nativePaths(modelPath, [modelPath])
    const proc = spawn(bin, [
      '-m', model,
      '--port', String(this.port),
      '--host', '127.0.0.1',
      '-ngl', '99',
      '-c', '8192',
      // Qwen3 等思考型模型直接给答案，避免 <think> 拖慢并污染输出
      '--reasoning-budget', '0'
    ], { cwd, windowsHide: true })
    let spawnError: Error | undefined
    proc.on('error', err => { spawnError = err })
    this.closed = new Promise<void>(resolve => proc.once('close', () => { void release().finally(resolve) }))
    let stderrTail = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-3000)
    })
    proc.stdout?.resume()
    this.proc = proc
    this.currentModel = modelPath

    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError
      if (proc.exitCode !== null || proc.signalCode !== null) {
        this.proc = null
        this.currentModel = null
        throw new Error(`本地翻译模型启动失败（退出码 ${proc.exitCode}）\n${stderrTail}`)
      }
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`, {
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

  async shutdown(): Promise<void> {
    this.stop()
    await this.closed
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
      }, true)
    }
    return this.inner
  }

  async translateBatch(items: BatchItem[], ctx: TranslateContext): Promise<Map<number, string>> {
    const inner = await this.ensureInner()
    if (items.length !== 1) return inner.translateBatch(items, ctx)
    const [item] = items
    try {
      const response = await inner.translateBatch(items, ctx)
      const text = response.get(item.index)
      if (text && !looksUntranslated(text, ctx.targetLanguage)) return response
    } catch (err) {
      if (!(err instanceof TranslationParseError)) throw err
    }
    // Small instruction models sometimes return the example's row number. For one subtitle we
    // can ask directly, without asking the model to reproduce a JSON schema or infer an index.
    const terms = ctx.glossary?.map(g => g.from + ' → ' + g.to).join('\n')
    const code = normalizeLanguageCode(ctx.targetLanguage)
    let target = languageName(code)
    try { target = new Intl.DisplayNames('en', { type: 'language' }).of(code === 'zh' ? 'zh-Hans' : code) ?? target }
    catch { /* Use the configured language name for a custom tag. */ }
    const prompt = 'You are a translator.' + (terms ? '\nUse these terms:\n' + terms : '')
    const request = 'Translate the following subtitle to ' + target + '. Return only the translation:\n' + item.text
    const raw = await inner.chat(prompt, request, { signal: ctx.signal, maxTokens: 1500 })
    const line = raw.replace(/^[\s\S]*?<\/think(?:ing)?>/i, '').trim().replace(/^(?:译文|Translation)\s*[:：]\s*/i, '').trim()
    if (!line || /^[\[{`]/.test(line) || line === item.text) return new Map()
    return new Map([[item.index, line]])
  }

  async chat(system: string, user: string, opts?: { signal?: AbortSignal; maxTokens?: number }): Promise<string> {
    return (await this.ensureInner()).chat(system, user, opts)
  }
}
