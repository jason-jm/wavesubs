// Exercises the HTTP transport without keys, billing or an external model.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { OpenAICompatibleProvider } from '../src/main/core/translate/openaiCompatible'
import { postJsonWithRetry } from '../src/main/core/translate/http'
import { translateCues } from '../src/main/core/translate/translateCues'
import { cloudParallelism, TranslationConfigError, type TranslationProvider } from '../src/main/core/translate/types'
import type { Cue } from '../src/main/core/subtitle/types'

const server = createServer()
let requests = 0, unsupported = 0, busy = 0, peak = 0
server.on('request', async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  const body = JSON.parse(raw)
  const send = (status: number, value: object, headers = {}): void => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers })
    res.end(JSON.stringify(value))
  }
  if (req.url === '/rate') { requests++; send(429, {error:{code:'rate_limit'}}, {'retry-after':'0'}); return }
  if (req.url === '/quota' || req.url === '/wait') {
    requests++; send(429, {error:{code:req.url === '/quota' ? 'insufficient_quota' : 'busy'}}, {'retry-after':'10'}); return
  }
  if (['temperature','top_p','seed'].some(key => key in body)) {
    send(400, {error:{param:'temperature',code:'unsupported_value'}}); return
  }
  if ('max_tokens' in body) { unsupported++; send(400,{error:{param:'max_tokens',code:'unsupported_parameter'}}); return }
  if ('max_completion_tokens' in body) { send(200, {choices:[{message:{content:'YES'}}]}); return }
  const items = JSON.parse(body.messages[1].content.split('\n').at(-1))
  busy++; peak = Math.max(peak,busy)
  await sleep(24 + (items[0].i % 3) * 7)
  busy--
  send(200, {choices:[{message:{content:JSON.stringify(items.map((i: {i:number}) => ({i:i.i,t:'译文' + i.i})))}}]})
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const addr = server.address()
if (!addr || typeof addr === 'string') throw new Error('test server address')
const baseUrl = 'http://127.0.0.1:' + addr.port
const ctx = { targetLanguage:'zh' }
const provider = new OpenAICompatibleProvider({protocol:'openai',apiKey:'fixture',baseUrl,model:'strict',...ctx})
const cues = (n: number): Cue[] => Array.from({length:n},(_,i) => ({index:i+1,text:'line '+i,startMs:i*1000,endMs:(i+1)*1000}))
try {
  assert.equal(cloudParallelism('https://api.example.org/v1'),3)
  assert.equal(provider.maxParallelBatches,1)
  const strict = await provider.translateBatch([{index:21,text:'hello'}], ctx)
  assert.equal(strict.get(21), '译文21')
  assert.equal(await provider.chat('Classify', 'Hello'), 'YES')
  assert.equal(await provider.chat('Classify', 'Again'), 'YES')
  assert.equal(unsupported, 1)
  console.log('✓ Strict default-only sampling on subtitles and OCR, cached token-limit fallback')

  const benchmark = async (parallel: number): Promise<number> => {
    const work = cues(1200), progress: number[] = []
    const start = performance.now()
    const result = await translateCues(work, {name:'HTTP benchmark',maxParallelBatches:parallel,
      translateBatch: provider.translateBatch.bind(provider), chat:provider.chat.bind(provider)}, ctx, p => progress.push(p))
    assert.equal(result.translatedCount, work.length)
    assert.ok(work.every(c => c.translation === '译文' + c.index))
    assert.ok(progress.every((n,i) => n <= 100 && (!i || n >= progress[i-1])))
    assert.equal(progress.at(-1),100)
    return Math.round(performance.now() - start)
  }
  const serial = await benchmark(1)
  assert.equal(peak,1)
  const parallel = await benchmark(3)
  assert.equal(peak,3)
  console.log('✓ 1200 cues, 60 HTTP calls per run, all rows aligned. Serial',serial,'ms; three concurrent',parallel,'ms.')

  const work = cues(61)
  const scoped: TranslationProvider = { name:'misaligned',maxParallelBatches:3,chat:provider.chat.bind(provider),
    async translateBatch(items) {
      const answer = new Map(items.filter(c => c.index !== 7 || items.length === 1).map(c => [c.index,'T'+c.index]))
      if (items[0].index > 20) answer.set(1,'wrong batch')
      return answer
    } }
  assert.equal((await translateCues(work,scoped,ctx)).missingCount,0)
  assert.ok(work.every(c => c.translation === 'T'+c.index))
  console.log('✓ Out-of-batch replies ignored and a missing line recovered in single-line retry')

  const partial = cues(120)
  let launched = 0, active = 0
  const stop: TranslationProvider = {...scoped, async translateBatch(items, context) {
    launched++; active++
    try {
      if (items[0].index === 21) { await sleep(35); throw new TranslationConfigError('invalid model') }
      await sleep(items[0].index === 1 ? 5 : 500, undefined, {signal:context.signal})
      return new Map(items.map(c => [c.index,'ok']))
    } finally { active-- }
  }}
  await assert.rejects(translateCues(partial,stop,ctx), /invalid model/)
  assert.ok(launched <= 4); assert.equal(active,0); assert.equal(partial.filter(c => c.translation).length,20)
  console.log('✓ Fatal response stops new batches, drains active requests and retains completed translations')
  await assert.rejects(postJsonWithRetry(baseUrl+'/rate',{},'{}'), /429/)
  assert.equal(requests,3)
  await assert.rejects(postJsonWithRetry(baseUrl+'/quota',{},'{}'), /429/)
  assert.equal(requests,4)
  const before = performance.now()
  await assert.rejects(postJsonWithRetry(baseUrl+'/wait',{},'{}',AbortSignal.timeout(130)))
  assert.ok(performance.now()-before < 2500); assert.equal(requests,5)
  console.log('✓ Retry-After, permanent quota exhaustion and cancellation during backoff')
} finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
