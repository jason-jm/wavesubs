import type { JobSummary } from '../../../shared/types'
import type { Translate } from '../../../shared/i18n'

/**
 * 「哪些环节吃了缓存」的一句话说明。单文件页和批量页共用。
 *
 * 必须亮出来而不是静默：识别 400 秒的活 2 秒跑完、或者换了设置译文却一字未动，
 * 用户若不知道背后是缓存在起作用，第一反应是「这软件坏了」。
 */
export function cacheNote(r: JobSummary, t: Translate): string | null {
  const parts: string[] = []
  if (r.sourceFromCache) parts.push(t('cache.sourceHit'))
  if (r.translationReuse === 'all') parts.push(t('cache.translationAll'))
  else if (r.translationReuse === 'partial') {
    parts.push(
      t('cache.translationPartial', {
        kept: r.translationReusedCount ?? 0,
        fresh: r.translationFreshCount ?? 0
      })
    )
  }
  return parts.length > 0 ? parts.join(' · ') : null
}
