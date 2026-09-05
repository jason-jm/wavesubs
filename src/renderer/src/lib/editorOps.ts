/**
 * 编辑器对字幕数组的全部操作，纯函数、不可变返回。
 *
 * 抽出来是为了两件事：撤销栈只需要保存输入数组的引用（每次操作返回新数组，
 * 旧数组天然就是快照）；check-editor.ts 能对着它们逐条断言，不用起 UI。
 */
import type { RecordView } from '../../../shared/types'

export type EditorCue = RecordView['cues'][number]

const renumber = (cues: EditorCue[]): EditorCue[] =>
  cues.map((c, i) => ({ ...c, index: i + 1 }))

/** '1:23.456' / '01:02:03.450' / '83.4' → 毫秒；解析不出返回 null（调用方回退原值） */
export function parseTimeMs(raw: string): number | null {
  const text = raw.trim().replace('，', ',').replace(',', '.')
  if (!text) return null
  const parts = text.split(':')
  if (parts.length > 3) return null
  let seconds = 0
  for (const part of parts) {
    if (!/^\d*(\.\d*)?$/.test(part) || part === '' || part === '.') return null
    seconds = seconds * 60 + Number(part)
  }
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.round(seconds * 1000)
}

export function formatTimeMs(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const frac = total % 1000
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0')
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  return `${base}.${pad(frac, 3)}`
}

const CJK_EDGE = /[぀-ヿ㐀-䶿一-鿿]$|^[぀-ヿ㐀-䶿一-鿿]/

/** 拼接两段文本：CJK 交界不加空格（「你好」+「世界」≠「你好 世界」），拉丁加 */
export function joinText(a: string, b: string): string {
  const left = a.trim()
  const right = b.trim()
  if (!left) return right
  if (!right) return left
  const noSpace = CJK_EDGE.test(left.slice(-1)) || CJK_EDGE.test(right.charAt(0))
  return noSpace ? left + right : `${left} ${right}`
}

export function updateCue(
  cues: EditorCue[],
  at: number,
  patch: Partial<EditorCue>
): EditorCue[] {
  return cues.map((c, i) => {
    if (i !== at) return c
    const next = { ...c, ...patch }
    // 改了原文且这条有译文 → 标记译文过期（重译时只补这些条）；
    // 用户手动改译文视为已核对，标记解除
    if (patch.text !== undefined && patch.text !== c.text && next.translation) {
      next.srcEdited = true
    }
    if (patch.translation !== undefined && patch.translation !== c.translation) {
      delete next.srcEdited
    }
    return next
  })
}

/** 在 at 后插入空条：起点接上一条终点，时长给 2 秒但不越过下一条起点 */
export function insertAfter(cues: EditorCue[], at: number): EditorCue[] {
  const prev = cues[at]
  const next = cues[at + 1]
  const startMs = prev ? prev.endMs : 0
  const endMs = next ? Math.min(startMs + 2000, Math.max(next.startMs, startMs + 200)) : startMs + 2000
  const cue: EditorCue = { index: 0, startMs, endMs, text: '', srcEdited: true }
  return renumber([...cues.slice(0, at + 1), cue, ...cues.slice(at + 1)])
}

export function deleteAt(cues: EditorCue[], at: number): EditorCue[] {
  return renumber(cues.filter((_, i) => i !== at))
}

/** 与下一条合并：文本智能拼接、终点取下一条的，译文两边都有才拼、否则丢弃并标过期 */
export function mergeWithNext(cues: EditorCue[], at: number): EditorCue[] {
  const a = cues[at]
  const b = cues[at + 1]
  if (!a || !b) return cues
  const merged: EditorCue = {
    index: 0,
    startMs: a.startMs,
    endMs: Math.max(a.endMs, b.endMs),
    text: joinText(a.text, b.text)
  }
  if (a.translation && b.translation) {
    merged.translation = joinText(a.translation, b.translation)
  } else if (a.translation || b.translation) {
    // 只有一边有译文：拼出来是半截译文，不如标成待重译
    merged.srcEdited = true
    const only = a.translation ?? b.translation
    if (only) merged.translation = only
  }
  return renumber([...cues.slice(0, at), merged, ...cues.slice(at + 2)])
}

/** 撤销栈：不可变数组直接存引用，容量满了丢最旧的 */
export const UNDO_LIMIT = 50

export function pushUndo(stack: EditorCue[][], snapshot: EditorCue[]): EditorCue[][] {
  const next = [...stack, snapshot]
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next
}
