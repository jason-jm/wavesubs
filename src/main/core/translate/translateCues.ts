import type { Cue } from '../subtitle/types'
import { LocalizedError } from '../../../shared/i18n/core'
import { applicableGlossary, looksUntranslated } from './prompt'
import type { TranslateContext, TranslationProvider } from './types'
import { TranslationConfigError } from './types'

const BATCH_SIZE = 20
/** 重试轮用更小的批：大批撑爆超时时，拆小往往就能过 */
const RETRY_BATCH_SIZE = 6
/** 每批附带多少条前文作为上下文 */
const CONTEXT_LINES = 4

export interface TranslateCuesResult {
  translatedCount: number
  missingCount: number
}

/**
 * 分批翻译全部字幕并写入 cue.translation。
 * 单批失败（超时、限流、解析不出）不致命，结尾用更小的批重试一轮；
 * 只有配置类错误（Key 无效、模型名不存在）才立刻中止整个任务。
 */
export async function translateCues(
  cues: Cue[],
  provider: TranslationProvider,
  ctx: TranslateContext,
  onProgress?: (percent: number) => void,
  control?: { signal?: AbortSignal }
): Promise<TranslateCuesResult> {
  const controller = new AbortController()
  const inputs = [controller.signal, ctx.signal, control?.signal].filter((s): s is AbortSignal => Boolean(s))
  const signal = AbortSignal.any(inputs)
  const positions = new Map(cues.map((cue, index) => [cue, index]))
  let lastError: Error | undefined
  let fatal: TranslationConfigError | undefined

  const runBatch = async (batch: Cue[]): Promise<void> => {
    const pos = positions.get(batch[0])!
    const texts = batch.map(c => c.text)
    try {
      const returned = await provider.translateBatch(batch.map(c => ({ index: c.index, text: c.text })), {
        ...ctx, signal, precedingText: cues.slice(Math.max(0, pos - CONTEXT_LINES), pos).map(c => c.text),
        glossary: applicableGlossary(ctx.glossary, texts)
      })
      // A provider may return an index from the surrounding context. Only this batch owns these cues.
      for (const cue of batch) {
        const text = returned.get(cue.index)
        if (text && !looksUntranslated(text, ctx.targetLanguage)) cue.translation = text
      }
    } catch (err) {
      if (err instanceof TranslationConfigError && !fatal && !signal.aborted) {
        fatal = err
        controller.abort()
      } else if (!signal.aborted) lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  const runPass = async (work: Cue[], size: number, start: number, end: number): Promise<void> => {
    let next = 0, done = 0
    const worker = async (): Promise<void> => {
      while (!signal.aborted && next < work.length) {
        const batch = work.slice(next, next + size)
        next += size
        await runBatch(batch)
        done += batch.length
        if (!signal.aborted) onProgress?.(Math.round(start + done / work.length * (end - start)))
      }
    }
    const count = Math.min(Math.ceil(work.length / size), provider.maxParallelBatches ?? 1)
    await Promise.all(Array.from({ length: count }, worker))
    if (fatal) throw fatal
    if (signal.aborted) throw new LocalizedError('error.jobCancelled')
  }
  const missing = (): Cue[] => cues.filter(c => !c.translation)
  await runPass(missing(), BATCH_SIZE, 0, 90)
  await runPass(missing(), RETRY_BATCH_SIZE, 90, 98)
  await runPass(missing(), 1, 98, 99)
  onProgress?.(100)
  const total = cues.length

  const missingCount = cues.filter((c) => !c.translation).length
  // 一条都没译出来说明不是偶发问题，要把原始错误报出去，而不是默默导出原文
  if (missingCount === total && lastError) throw lastError
  return { translatedCount: total - missingCount, missingCount }
}
