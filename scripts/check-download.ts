/**
 * 模型下载器自检：镜像回退矩阵 + 用户取消 + 全部失败时的本地化错误。
 *
 * 用假 fetch 模拟「官方被墙、镜像正常」：这是中国大陆用户的真实处境，
 * 1.0.2 之前会直接报 "TypeError: fetch failed"。
 */
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
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

console.log('候选地址：')
resetPreferredHost()
eq('HF 地址展开为 官方 → 镜像', candidateUrls(HF), [HF, MIRROR])
eq('非 HF 地址原样', candidateUrls('https://example.com/x.bin'), ['https://example.com/x.bin'])

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
        // 分两块写，验证进度回调与 drain 路径
        ctrl.enqueue(bytes.slice(0, 2))
        ctrl.enqueue(bytes.slice(2))
        ctrl.close()
      }
    })
    return new Response(stream, { status: 200, headers: { 'content-length': String(bytes.length) } })
  }
  return Object.assign(impl, { calls })
}

const work = mkdtempSync(join(tmpdir(), 'wavesubs-checkdl-'))
try {
  console.log('\n官方被墙、镜像正常（大陆用户的处境）：')
  resetPreferredHost()
  const f1 = fakeFetch({ 'huggingface.co': 'fail', 'hf-mirror.com': 'ok' })
  const d1 = new ModelDownloader(work, { fetch: f1 })
  let last = 0
  await d1.download('a.bin', HF, (p) => { last = p.percent })
  eq('先试官方再试镜像', f1.calls, [HF, MIRROR])
  eq('文件落盘且内容完整', readFileSync(join(work, 'a.bin'), 'utf8'), 'hello')
  eq('进度最终 100%', last, 100)
  eq('镜像成功后记住偏好，下一个文件直接用镜像', candidateUrls(HF), [MIRROR, HF])
  eq('临时 .download 文件已清理', existsSync(join(work, 'a.bin.download')), false)

  console.log('\n官方 404、镜像正常：')
  resetPreferredHost()
  const f2 = fakeFetch({ 'huggingface.co': '404', 'hf-mirror.com': 'ok' })
  await new ModelDownloader(work, { fetch: f2 }).download('b.bin', HF)
  eq('404 也算失败、切到镜像', f2.calls, [HF, MIRROR])

  console.log('\n两边都连不上：')
  resetPreferredHost()
  const f3 = fakeFetch({ 'huggingface.co': 'fail', 'hf-mirror.com': 'fail' })
  let err: unknown
  try { await new ModelDownloader(work, { fetch: f3 }).download('c.bin', HF) } catch (e) { err = e }
  eq('抛本地化错误 error.modelDownloadFailed', err instanceof LocalizedError ? err.key : String(err), 'error.modelDownloadFailed')
  eq('cause 保留原始错误', (err as { cause?: Error })?.cause?.message, 'fetch failed')
  eq('失败文件不残留', existsSync(join(work, 'c.bin')) || existsSync(join(work, 'c.bin.download')), false)

  console.log('\n用户取消：')
  resetPreferredHost()
  const f4 = fakeFetch({ 'huggingface.co': 'hang' })
  const d4 = new ModelDownloader(work, { fetch: f4 })
  const pending = d4.download('d.bin', HF)
  setTimeout(() => d4.cancel('d.bin'), 50)
  let cancelErr: unknown
  try { await pending } catch (e) { cancelErr = e }
  eq('取消抛 DownloadCancelledError，不会误切镜像', cancelErr instanceof DownloadCancelledError, true)
  eq('取消时只请求了一次', f4.calls.length, 1)

  console.log('\n非 HF 地址：')
  const f5 = fakeFetch({ 'example.com': 'ok' }, 'xyz')
  await new ModelDownloader(work, { fetch: f5 }).download('e.bin', 'https://example.com/e.bin')
  eq('没有镜像可换，直接下', f5.calls, ['https://example.com/e.bin'])
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
