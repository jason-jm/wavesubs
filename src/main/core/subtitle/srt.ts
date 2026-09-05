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

export function cuesToSrt(cues: Cue[], selectText: CueTextSelector = (c) => c.text): string {
  const blocks: string[] = []
  let n = 1
  for (const cue of cues) {
    const text = selectText(cue).trim()
    if (!text) continue
    blocks.push(`${n}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${text}`)
    n += 1
  }
  return blocks.join('\n\n') + '\n'
}
