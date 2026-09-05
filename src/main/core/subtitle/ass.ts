import type { ExportContent } from '../../../shared/types'
import type { Cue } from './types'

function formatAssTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms))
  const h = Math.floor(clamped / 3_600_000)
  const m = Math.floor((clamped % 3_600_000) / 60_000)
  const s = Math.floor((clamped % 60_000) / 1000)
  const cs = Math.floor((clamped % 1000) / 10)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`
}

function escapeAssText(text: string): string {
  // 花括号会被播放器解析成样式标签
  return text.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, '\\N')
}

const ASS_HEADER = `[Script Info]
Title: Wave Subs
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,PingFang SC,70,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,45,1
Style: Orig,Helvetica,46,&H00C8C8C8,&H000000FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,45,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

export function cuesToAss(cues: Cue[], content: ExportContent): string {
  const lines: string[] = [ASS_HEADER]
  for (const cue of cues) {
    const original = escapeAssText(cue.text.trim())
    const translation = escapeAssText((cue.translation ?? '').trim())
    let text: string
    if (content === 'original') {
      text = original
    } else if (content === 'bilingual' && translation) {
      text = `${translation}\\N{\\rOrig}${original}`
    } else {
      text = translation || original
    }
    if (!text) continue
    lines.push(
      `Dialogue: 0,${formatAssTime(cue.startMs)},${formatAssTime(cue.endMs)},Default,,0,0,0,,${text}`
    )
  }
  return lines.join('\n') + '\n'
}
