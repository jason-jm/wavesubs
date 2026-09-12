import type { Cue } from './types'

export function formatSrtTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms))
  const h = Math.floor(clamped / 3_600_000)
  const m = Math.floor((clamped % 3_600_000) / 60_000)
  const s = Math.floor((clamped % 60_000) / 1000)
  const milli = clamped % 1000
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`
}

export type CueTextSelector = (cue: Cue) => string

/** 画面文字存在数组尾部（编辑器按类分开操作），写文件时按时间排回去 */
export function orderForOutput(cues: Cue[]): Cue[] {
  return [...cues].sort((a, b) => a.startMs - b.startMs || (a.kind === 'sign' ? 1 : 0) - (b.kind === 'sign' ? 1 : 0))
}

export function cuesToSrt(cues: Cue[], selectText: CueTextSelector = (c) => c.text): string {
  const blocks: string[] = []
  let n = 1
  for (const cue of orderForOutput(cues)) {
    const text = selectText(cue).trim()
    if (!text) continue
    // SRT 没有定位能力：画面文字放顶部（多数播放器认 {\an8}），把底部留给对白
    const body = cue.kind === 'sign' ? `{\\an8}${text}` : text
    blocks.push(`${n}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${body}`)
    n += 1
  }
  return blocks.join('\n\n') + '\n'
}
