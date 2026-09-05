import type { MediaProbeInfo, SubtitleStreamView } from '../../../shared/types'
import type { Translate } from '../../../shared/i18n'

/**
 * 音轨/字幕轨的显示名。单文件页和批量页都要用同一份写法——
 * 两边各写一份的话，同一条轨道在两个页面上叫法不同，用户会以为选的不是一个东西。
 */
export function audioTrackLabel(
  stream: MediaProbeInfo['audioStreams'][number],
  t: Translate
): string {
  const parts = [t('track.audio', { n: stream.audioIndex + 1 })]
  if (stream.language) parts.push(stream.language)
  if (stream.title) parts.push(stream.title)
  parts.push(`${stream.codec} · ${t('track.channels', { n: stream.channels })}`)
  return parts.join(' · ')
}

export function subtitleTrackLabel(stream: SubtitleStreamView, t: Translate): string {
  const parts = [t('track.subtitle', { n: stream.subtitleIndex + 1 })]
  if (stream.language) parts.push(stream.language)
  if (stream.title) parts.push(stream.title)
  if (stream.forced) parts.push(t('track.forced'))
  if (stream.hearingImpaired) parts.push(t('track.hearingImpaired'))
  if (!stream.textBased) parts.push(`${stream.codec} · ${t('track.bitmap')}`)
  return parts.join(' · ')
}
