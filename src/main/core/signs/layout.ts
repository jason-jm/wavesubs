/**
 * 判别结果 → 字幕条（kind: 'sign'）。
 *
 * 同一时刻最多 3 条，按重要度、再按字号取舍——手机界面一屏十几个按钮全译出来只会糊成一片。
 * 排法三种：多行/大块盖在原文上（box），单行贴原文正下方（below），底部的挪到顶部（top）把底部留给对白。
 */
import type { Cue, SignLayout } from '../subtitle/types'
import type { SignBlock, SignJudgement } from './types'

const norm = (s: string): string => s.normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase()

export interface LayoutOptions {
  /** 只出这个重要度及以上的（默认 2） */
  minImportance?: number
  /** 同屏上限（默认 3） */
  maxConcurrent?: number
  /** 起始 index（接在语音字幕后面） */
  startIndex?: number
}

export function layoutOf(block: SignBlock, translation: string): SignLayout {
  const srcLines = block.text.split('\n').length
  const cy = block.box.y + block.box.h / 2
  if (srcLines >= 2 || block.box.h > 0.12) return 'box'
  if (cy > 0.78) return 'top'
  return translation.includes('\n') ? 'box' : 'below'
}

export function signsToCues(blocks: SignBlock[], judged: SignJudgement[], opts: LayoutOptions = {}): Cue[] {
  const minImportance = opts.minImportance ?? 2
  const maxConcurrent = opts.maxConcurrent ?? 3
  const byId = new Map(judged.map((j) => [j.id, j]))
  const signs = blocks.filter((b) => {
    const j = byId.get(b.id)
    return !b.drop && j?.category === 'sign' && j.importance >= minImportance
  })
  // 同一时刻文本互相包含的块只留最长的那条：一张书封在不同帧里会被分成整块和零碎的行
  const longestFirst = [...signs].sort((a, b) => norm(b.text).length - norm(a.text).length)
  const kept: SignBlock[] = []
  for (const b of longestFirst) {
    const nb = norm(b.text)
    const swallowed = kept.some((o) => o.startSec < b.endSec && b.startSec < o.endSec && nb.length >= 2 && norm(o.text).includes(nb))
    if (!swallowed) kept.push(b)
  }
  const ranked = kept.sort((a, b) => (byId.get(b.id)!.importance - byId.get(a.id)!.importance) || (b.box.h - a.box.h))
  const accepted: SignBlock[] = []
  for (const b of ranked) {
    const overlapping = accepted.filter((o) => o.startSec < b.endSec && b.startSec < o.endSec)
    if (overlapping.length < maxConcurrent) accepted.push(b)
  }
  accepted.sort((a, b) => a.startSec - b.startSec)
  let index = opts.startIndex ?? 1
  return accepted.map((b) => {
    const j = byId.get(b.id)!
    const text = (j.fixed.trim() || b.text).trim()
    const translation = j.tr.trim()
    const cue: Cue = {
      index: index++,
      startMs: Math.round(b.startSec * 1000),
      endMs: Math.round(b.endSec * 1000),
      text,
      kind: 'sign',
      pos: { x: round4(b.box.x), y: round4(b.box.y), w: round4(b.box.w), h: round4(b.box.h) },
      layout: layoutOf(b, translation),
      importance: j.importance
    }
    if (translation) cue.translation = translation
    return cue
  })
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000
