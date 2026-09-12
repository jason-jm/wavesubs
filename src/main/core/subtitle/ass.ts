import type { ExportContent } from '../../../shared/types'
import type { Cue } from './types'
import { orderForOutput } from './srt'
import { fallbackPlacement } from '../signs/layout'

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
Style: Sign,PingFang SC,40,&H00F5F5F5,&H000000FF,&H00202020,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,5,20,20,20,1
Style: SignBox,PingFang SC,40,&H00FFFFFF,&H000000FF,&H00000000,&H50000000,-1,0,0,0,100,100,0,0,3,6,0,5,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

const PLAY_W = 1920
const PLAY_H = 1080

/**
 * 画面文字一条。位置与字号在 core/signs/layout.ts 里排好存在 cue 上，这里只负责写出来；
 * 老记录没有这两个字段时按原规则兜一个。
 */
function signDialogue(cue: Cue, text: string): string {
  const anchor = cue.anchor ?? fallbackPlacement(cue).anchor
  const fs = cue.fontSize ?? fallbackPlacement(cue).fontSize
  const style = (cue.layout ?? 'below') === 'box' ? 'SignBox' : 'Sign'
  const x = Math.round(anchor.x * PLAY_W)
  const y = Math.round(anchor.y * PLAY_H)
  return `Dialogue: 1,${formatAssTime(cue.startMs)},${formatAssTime(cue.endMs)},${style},,0,0,0,,{\\an5\\pos(${x},${y})\\fs${fs}}${text}`
}

export function cuesToAss(cues: Cue[], content: ExportContent): string {
  const lines: string[] = [ASS_HEADER]
  for (const cue of orderForOutput(cues)) {
    if (cue.kind === 'sign') {
      // 画面文字：原文就在画面上，双语时也只出译文
      const signText = content === 'original' ? escapeAssText(cue.text.trim()) : escapeAssText((cue.translation ?? '').trim()) || escapeAssText(cue.text.trim())
      if (signText) lines.push(signDialogue(cue, signText))
      continue
    }
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
