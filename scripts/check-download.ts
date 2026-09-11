/**
 * 模型下载器自检：镜像回退矩阵 + 错开并发 + 来源记忆 + 用户取消 + 全部失败时的本地化错误。
 *
 * 用假 fetch 模拟「官方被墙、镜像正常」：这是中国大陆用户的真实处境，
 * 1.0.2 之前会直接报 "TypeError: fetch failed"，1.0.3 会先干等官方 20 秒。
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ModelDownloader,
  DownloadCancelledError,
  candidateUrls,
  resetPreferredHost,
  type FetchLike
} from '../src/main/core/modelManager'
import { LocalizedError } from '../src/shared/i18n/core'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${name}`)
    return
  }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

const HF = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
const MIRROR = 'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
/** 测试里错开时间缩到 150ms，真实值是 3 秒 */
const STAGGER = 150

console.log('候选地址：')
resetPreferredHost()
eq('HF 地址展开为 官方 → 镜像', candidateUrls(HF), [HF, MIRROR])
eq('非 HF 地址原样', candidateUrls('https://example.com/x.bin'), ['https://example.com/x.bin'])
const QWEN = 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf'
eq('Qwen 的 GGUF 多一个 ModelScope 来源（路径规则不同）', candidateUrls(QWEN), [
  QWEN,
  'https://hf-mirror.com/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf',
  'https://modelscope.cn/models/Qwen/Qwen3-8B-GGUF/resolve/master/Qwen3-8B-Q4_K_M.gguf'
])
eq('whisper 的 ggml 没有 ModelScope 来源', candidateUrls(HF).length, 2)

/** 造一个假 fetch：按主机决定成败；成功时返回一段可流式读取的正文 */
function fakeFetch(behaviour: Record<string, 'ok' | 'fail' | 'hang' | '404'>, body = 'hello'): FetchLike & { calls: string[] } {
  const calls: string[] = []
  const impl: FetchLike = async (input, init) => {
    calls.push(input)
    const host = new URL(input).host
    const mode = behaviour[host] ?? 'fail'
    if (mode === 'fail') throw new TypeError('fetch failed')
    if (mode === 'hang') {
      await new Promise<void>((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
      throw new Error('unreachable')
    }
    if (mode === '404') return new Response('nope', { status: 404 })
    const bytes = new TextEncoder().encode(body)
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(bytes.slice(0, 2))
        ctrl.enqueue(bytes.slice(2))
        ctrl.close()
      }
    })
    return new Response(stream, { status: 200, headers: { 'content-length': String(bytes.length) } })
  }
  return Object.assign(impl, { calls })
}

const root = mkdtempSync(join(tmpdir(), 'wavesubs-checkdl-'))
let n = 0
/** 每个用例独立目录：来源偏好会落盘，不能串到下一个用例 */
const fresh = (): string => {
  const d = join(root, `t${n++}`)
  mkdirSync(d)
  resetPreferredHost()
  return d
}

try {
  console.log('\n官方直接报错、镜像正常：')
  {
    const work = fresh()
    const f = fakeFetch({ 'huggingface.co': 'fail', 'hf-mirror.com': 'ok' })
    const phases: string[] = []
    let last = 0
    await new ModelDownloader(work, { fetch: f, staggerMs: STAGGER }).download('a.bin', HF, (p) => {
      if (p.phase && phases[phases.length - 1] !== p.phase) phases.push(p.phase)
      last = p.percent
    })
    eq('先试官方，失败立刻补镜像', f.calls, [HF, MIRROR])
    eq('文件落盘且内容完整', readFileSync(join(work, 'a.bin'), 'utf8'), 'hello')
    eq('进度阶段 connecting → downloading', phases, ['connecting', 'downloading'])
    eq('进度最终 100%', last, 100)
    eq('镜像赢了之后记住：下一个文件先走镜像', candidateUrls(HF), [MIRROR, HF])
    eq('偏好落盘到模型目录', readFileSync(join(work, '.download-host'), 'utf8'), 'https://hf-mirror.com/')
    eq('临时 .download 文件已清理', existsSync(join(work, 'a.bin.download')), false)
  }

  console.log('\n官方挂着不回应（被墙的典型表现）、镜像正常：')
  {
    const work = fresh()
    const f = fakeFetch({ 'huggingface.co': 'hang', 'hf-mirror.com': 'ok' })
    const t0 = Date.now()
    await new ModelDownloader(work, { fetch: f, staggerMs: STAGGER }).download('b.bin', HF)
    const ms = Date.now() - t0
    eq('错开时间一到就并行发起镜像', f.calls, [HF, MIRROR])
    eq(`没有等官方超时（耗时 ${ms}ms，应远小于 20s）`, ms < 5000, true)
  }

  console.log('\n记住的偏好跨实例生效（模拟重启）：')
  {
    const work = fresh()
    const f1 = fakeFetch({ 'huggingface.co': 'hang', 'hf-mirror.com': 'ok' })
    await new ModelDownloader(work, { fetch: f1, staggerMs: STAGGER }).download('c.bin', HF)
    resetPreferredHost() // 内存清掉，只剩磁盘上的记录
    const f2 = fakeFetch({ 'huggingface.co': 'hang', 'hf-mirror.com': 'ok' })
    await new ModelDownloader(work, { fetch: f2, staggerMs: STAGGER }).download('d.bin', HF)
    eq('新实例读到落盘偏好，直接从镜像下', f2.calls[0], MIRROR)
  }

  console.log('\n官方 404、镜像正常：')
  {
    const work = fresh()
    const f = fakeFetch({ 'huggingface.co': '404', 'hf-mirror.com': 'ok' })
    await new ModelDownloader(work, { fetch: f, staggerMs: STAGGER }).download('e.bin', HF)
    eq('404 也算失败、切到镜像', f.calls, [HF, MIRROR])
  }

  console.log('\n两边都连不上：')
  {
    const work = fresh()
    const f = fakeFetch({ 'huggingface.co': 'fail', 'hf-mirror.com': 'fail' })
    let err: unknown
    try {
      await new ModelDownloader(work, { fetch: f, staggerMs: STAGGER }).download('f.bin', HF)
    } catch (e) {
      err = e
    }
    eq('抛本地化错误 error.modelDownloadFailed', err instanceof LocalizedError ? err.key : String(err), 'error.modelDownloadFailed')
    eq('cause 保留原始错误', (err as { cause?: Error })?.cause?.message, 'fetch failed')
    eq('失败文件不残留', existsSync(join(work, 'f.bin')) || existsSync(join(work, 'f.bin.download')), false)
  }

  console.log('\n用户取消：')
  {
    const work = fresh()
    const f = fakeFetch({ 'huggingface.co': 'hang', 'hf-mirror.com': 'hang' })
    const d = new ModelDownloader(work, { fetch: f, staggerMs: STAGGER })
    const pending = d.download('g.bin', HF)
    setTimeout(() => d.cancel('g.bin'), 50)
    let cancelErr: unknown
    try {
      await pending
    } catch (e) {
      cancelErr = e
    }
    eq('取消抛 DownloadCancelledError', cancelErr instanceof DownloadCancelledError, true)
    eq('取消发生在错开时间之前，只请求了一次', f.calls.length, 1)
  }

  console.log('\n非 HF 地址：')
  {
    const work = fresh()
    const f = fakeFetch({ 'example.com': 'ok' }, 'xyz')
    await new ModelDownloader(work, { fetch: f, staggerMs: STAGGER }).download('h.bin', 'https://example.com/h.bin')
    eq('没有镜像可换，直接下', f.calls, ['https://example.com/h.bin'])
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
