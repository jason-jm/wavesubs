import type { ExportContent } from '../../../shared/types'
import type { Cue } from './types'
import { orderForOutput } from './srt'

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
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

/**
 * 画面文字的定位与字号。多行/大块盖在原文上（不透明底框，字号按原文行高，宽度超框再缩），
 * 单行贴在原文正下方，底部的放到顶部把底部留给对白。
 */
function signDialogue(cue: Cue, text: string): string {
  const pos = cue.pos ?? { x: 0.1, y: 0.05, w: 0.8, h: 0.05 }
  const srcLines = cue.text.split('\n').length
  const lineH = (pos.h * PLAY_H) / srcLines
  const cx = Math.round((pos.x + pos.w / 2) * PLAY_W)
  const cy = pos.y + pos.h / 2
  const outLines = text.split('\\N')
  const layout = cue.layout ?? 'below'
  if (layout === 'box') {
    let fs = clamp(Math.round(lineH * 0.85), 24, 64)
    const longest = Math.max(1, ...outLines.map((l) => l.length))
    fs = Math.min(fs, Math.max(24, Math.floor((pos.w * PLAY_W * 1.1) / longest)))
    return `Dialogue: 1,${formatAssTime(cue.startMs)},${formatAssTime(cue.endMs)},SignBox,,0,0,0,,{\\an5\\pos(${cx},${Math.round(cy * PLAY_H)})\\fs${fs}}${text}`
  }
  const fs = clamp(Math.round(lineH * 0.9), 28, 56)
  const tag =
    layout === 'top'
      ? `\\an8\\pos(${cx},${Math.round(PLAY_H * 0.04)})`
      : `\\an5\\pos(${cx},${Math.min(Math.round(PLAY_H * 0.95), Math.round((pos.y + pos.h) * PLAY_H + fs * 0.7 * outLines.length))})`
  return `Dialogue: 1,${formatAssTime(cue.startMs)},${formatAssTime(cue.endMs)},Sign,,0,0,0,,{${tag}\\fs${fs}}${text}`
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
