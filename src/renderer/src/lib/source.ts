import type { MediaProbeInfo, SubtitleSource } from '../../../shared/types'

import { sameLanguage } from './languages'

/**
 * 自动决定用哪条字幕来源。
 * 有文本字幕轨时优先用它——比语音识别更快也更准；跳过只含少量翻译的强制轨。
 * 单文件流程和批量流程共用这一份判断，避免两边逻辑走偏。
 *
 * 轨道打分而不是取第一条：多语字幕的发行版常把别国语言排在前面（实测一部意大利语剧
 * 第一条是丹麦语），闭眼取第一条会拿别的语言当「原文」去翻译。优先挑与音轨语言一致的
 * 轨（那才是真正的原文字幕），其次非听障版（少一堆音效标注）。
 */
export function pickDefaultSource(info: MediaProbeInfo): SubtitleSource {
  if (info.kind === 'subtitle') return { kind: 'file' }
  const textTracks = info.subtitleStreams.filter((s) => s.textBased)
  if (textTracks.length === 0) return { kind: 'asr' }
  const audioLang = info.audioStreams[0]?.language
  const candidates = textTracks.filter((s) => !s.forced)
  if (candidates.length === 0) {
    return { kind: 'embedded', subtitleIndex: textTracks[0].subtitleIndex }
  }
  let best = candidates[0]
  let bestScore = -1
  for (const track of candidates) {
    const score =
      (sameLanguage(track.language, audioLang) ? 2 : 0) + (track.hearingImpaired ? 0 : 1)
    if (score > bestScore) {
      best = track
      bestScore = score
    }
  }
  return { kind: 'embedded', subtitleIndex: best.subtitleIndex }
}

/** 同一判断的字符串形式，供单文件页的下拉框回显选中项 */
export function defaultSourceKey(info: MediaProbeInfo): string {
  const source = pickDefaultSource(info)
  if (source.kind === 'file') return 'file'
  if (source.kind === 'asr') return 'asr'
  return `sub:${source.subtitleIndex}`
}
