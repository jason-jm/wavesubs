import type { Cue } from '../subtitle/types'
import { LocalizedError } from '../../../shared/i18n/core'
import { applicableGlossary } from './prompt'
import type { TranslateContext, TranslationProvider } from './types'
import { normalizeLanguageCode, TranslationConfigError } from './types'

/** 目标语言里绝不该出现的源语言文字——出现了就说明这条没翻译干净 */
const FOREIGN_SCRIPTS: Record<string, RegExp> = {
  zh: /[぀-ゟ゠-ヿ가-힯]/, // 中文译文里不该有假名或谚文
  en: /[぀-ヿ一-鿿가-힯]/, // 英文译文里不该有中日韩文字
  ja: /[가-힯]/,
  ko: /[぀-ヿ]/
}

function looksUntranslated(text: string, targetLanguage: string): boolean {
  const pattern = FOREIGN_SCRIPTS[normalizeLanguageCode(targetLanguage).toLowerCase().split('-')[0]]
  return pattern ? pattern.test(text) : false
}

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
  // 取消只在批与批之间生效：单批最长几十秒（本地）到 300 秒（云端超时），不去打断进行中的请求
  const checkCancelled = (): void => {
    if (control?.signal?.aborted) throw new LocalizedError('error.jobCancelled')
  }
  const apply = (map: Map<number, string>): void => {
    for (const cue of cues) {
      const t = map.get(cue.index)
      if (t) cue.translation = t
    }
  }

  const byIndex = new Map(cues.map((c) => [c.index, c]))
  /** 取该批之前的几条原文当上下文，帮模型判断言外之意与批次衔接 */
  const precedingOf = (batch: Cue[]): string[] => {
    const first = batch[0]
    if (!first) return []
    const pos = cues.indexOf(byIndex.get(first.index) as Cue)
    return pos > 0 ? cues.slice(Math.max(0, pos - CONTEXT_LINES), pos).map((c) => c.text) : []
  }

  let lastError: Error | null = null
  const runBatch = async (batch: Cue[]): Promise<void> => {
    try {
      apply(
        await provider.translateBatch(
          batch.map((c) => ({ index: c.index, text: c.text })),
          {
            ...ctx,
            precedingText: precedingOf(batch),
            signal: control?.signal,
            // 全量表在 ctx 里，这里narrow成本批真正命中的那几条
            glossary: applicableGlossary(ctx.glossary, batch.map((c) => c.text))
          }
        )
      )
    } catch (err) {
      if (err instanceof TranslationConfigError) throw err
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  const total = cues.length
  let done = 0
  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    checkCancelled()
    const batch = cues.slice(i, i + BATCH_SIZE)
    await runBatch(batch)
    done += batch.length
    onProgress?.(Math.round((done / total) * 95))
  }

  // 漏译的、以及译文里还残留源语言文字的，都用更小的批再试一轮
  const needRetry = cues.filter(
    (c) => !c.translation || looksUntranslated(c.translation, ctx.targetLanguage)
  )
  for (const cue of needRetry) {
    if (cue.translation && looksUntranslated(cue.translation, ctx.targetLanguage)) {
      cue.translation = undefined
    }
  }
  for (let i = 0; i < needRetry.length; i += RETRY_BATCH_SIZE) {
    checkCancelled()
    await runBatch(needRetry.slice(i, i + RETRY_BATCH_SIZE))
    onProgress?.(Math.round(95 + ((i + RETRY_BATCH_SIZE) / needRetry.length) * 5))
  }
  // 兜底：小批之后还缺的逐条单独翻。单条批次没有错位可能，解析端也不再核对对齐锚——
  // 对齐锚会把「模型没照抄原文开头」的行整批丢掉，个别条会连着两轮都过不了，不能让它们留着原文出片
  for (const cue of cues.filter((c) => !c.translation)) {
    checkCancelled()
    await runBatch([cue])
  }
  onProgress?.(100)

  const missingCount = cues.filter((c) => !c.translation).length
  // 一条都没译出来说明不是偶发问题，要把原始错误报出去，而不是默默导出原文
  if (missingCount === total && lastError) throw lastError
  return { translatedCount: total - missingCount, missingCount }
}
