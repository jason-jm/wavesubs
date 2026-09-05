/**
 * 成品字幕的质量体检。
 *
 * 动机：批量任务挂几个小时跑完，坏结果（漏识别一大段、译文残留原文）混在
 * 好结果里毫无提示，用户往往看片看到一半才发现。这里把调时间轴时建立的
 * 检测机制反过来服务用户：跑完直接告诉你「这个文件建议检查」。
 *
 * 阈值不是拍的，来自六部整片的基准（见 bench/、eval/ 与 NAS 基准报告）：
 * - 健康的整片识别，字幕对 VAD 语音的覆盖率在 75~85%；掉到 70% 以下通常意味着
 *   有成段漏识别，55% 以下基本必有问题。
 * - 官方人工字幕的语速 p95 在 9~10 单位/秒、p99 约 13~21；超过 13 的条目
 *   多半读不完（或是切分错位挤出来的）。
 * - 连续 8 秒以上「VAD 认定有人说话但没有任何字幕」——配乐会造成短的假阳性，
 *   8 秒以上仍大概率是真的漏对白。
 *
 * 纯函数、无 IO：单文件与批量共用，渲染进程也能直接引用来即时重算。
 */
import type { SpeechRegion } from '../asr/vad'
import type { QcFinding, QcReport } from '../../../shared/types'
import type { Cue } from './types'

const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/

/** 与 timing.ts 同一套「音节量」折算：中日韩按字数，拉丁按词数×2.5 */
export function speakingUnitsOf(text: string): number {
  if (HAS_CJK.test(text)) return text.replace(/\s+/g, '').length
  return text.trim().split(/\s+/).filter(Boolean).length * 2.5
}

/** 目标语言里绝不该出现的源语言文字——与 translateCues 的重译判定同一逻辑 */
const FOREIGN_SCRIPTS: Record<string, RegExp> = {
  zh: /[぀-ゟ゠-ヿ가-힯]/,
  en: /[぀-ヿ一-鿿가-힯]/,
  ja: /[가-힯]/,
  ko: /[぀-ヿ]/
}

const COVERAGE_WARN = 0.7
const COVERAGE_BAD = 0.55
const GAP_MIN_MS = 8000
const OVERLONG_MS = 15000
const FAST_RATE = 13
const BIN_MS = 50

export function computeQc(
  cues: Cue[],
  regions: SpeechRegion[] | null,
  opts?: { targetLanguage?: string; translated?: boolean }
): QcReport {
  const findings: QcFinding[] = []

  // ---------- 覆盖率与漏段（只有走过 VAD 的识别任务才有依据） ----------
  if (regions && regions.length > 0 && cues.length > 0) {
    const lenMs = Math.max(
      regions[regions.length - 1].endMs,
      cues[cues.length - 1].endMs
    )
    const bins = Math.ceil(lenMs / BIN_MS)
    const speech = new Uint8Array(bins)
    const covered = new Uint8Array(bins)
    for (const r of regions) {
      const a = Math.max(0, Math.floor(r.startMs / BIN_MS))
      const b = Math.min(bins, Math.ceil(r.endMs / BIN_MS))
      for (let i = a; i < b; i += 1) speech[i] = 1
    }
    for (const c of cues) {
      const a = Math.max(0, Math.floor(c.startMs / BIN_MS))
      const b = Math.min(bins, Math.ceil(c.endMs / BIN_MS))
      for (let i = a; i < b; i += 1) covered[i] = 1
    }
    let speechBins = 0
    let coveredBins = 0
    for (let i = 0; i < bins; i += 1) {
      if (speech[i]) {
        speechBins += 1
        if (covered[i]) coveredBins += 1
      }
    }
    const coverage = speechBins > 0 ? coveredBins / speechBins : 1
    if (coverage < COVERAGE_BAD) {
      findings.push({ kind: 'coverage', severity: 'bad', pct: Math.round(coverage * 100) })
    } else if (coverage < COVERAGE_WARN) {
      findings.push({ kind: 'coverage', severity: 'warn', pct: Math.round(coverage * 100) })
    }

    // 连续未覆盖的语音段：只统计 8 秒以上的（配乐的假阳性大多更短）
    let gapCount = 0
    let firstGapSec: number | undefined
    let run = 0
    for (let i = 0; i <= bins; i += 1) {
      const uncovered = i < bins && speech[i] === 1 && covered[i] === 0
      if (uncovered) {
        run += 1
        continue
      }
      if (run * BIN_MS >= GAP_MIN_MS) {
        gapCount += 1
        firstGapSec ??= Math.round(((i - run) * BIN_MS) / 1000)
      }
      run = 0
    }
    if (gapCount > 0) {
      findings.push({
        kind: 'gap',
        severity: gapCount >= 3 ? 'bad' : 'warn',
        n: gapCount,
        atSec: firstGapSec
      })
    }
  }

  // ---------- 结构检查（任何来源都适用） ----------
  // 起止颠倒或零时长：管线出不来这种条（normalizeCues 会兜住），
  // 但编辑器允许手改时间，改错了必须在质检里立刻亮出来
  const invalid = cues.filter((c) => c.endMs <= c.startMs)
  if (invalid.length > 0) {
    findings.push({
      kind: 'invalid',
      severity: 'bad',
      n: invalid.length,
      atSec: Math.round(invalid[0].startMs / 1000)
    })
  }

  const overlong = cues.filter((c) => c.endMs - c.startMs > OVERLONG_MS)
  if (overlong.length > 0) {
    findings.push({
      kind: 'overlong',
      severity: 'warn',
      n: overlong.length,
      atSec: Math.round(overlong[0].startMs / 1000)
    })
  }

  const fast = cues.filter((c) => {
    const dur = c.endMs - c.startMs
    return dur > 0 && speakingUnitsOf(c.text) / (dur / 1000) > FAST_RATE
  })
  // 一两条超速往往是喊叫或拟声词，成片出现才是切分/时长分配出了问题
  if (fast.length >= 3 && fast.length / cues.length > 0.02) {
    findings.push({
      kind: 'fastRate',
      severity: 'warn',
      n: fast.length,
      atSec: Math.round(fast[0].startMs / 1000)
    })
  }

  // ---------- 翻译检查 ----------
  if (opts?.translated) {
    const missing = cues.filter((c) => !c.translation)
    if (missing.length > 0) {
      findings.push({
        kind: 'untranslated',
        severity: missing.length / cues.length > 0.1 ? 'bad' : 'warn',
        n: missing.length,
        atSec: Math.round(missing[0].startMs / 1000)
      })
    }
    const pattern = opts.targetLanguage
      ? FOREIGN_SCRIPTS[opts.targetLanguage.toLowerCase().split('-')[0]]
      : undefined
    if (pattern) {
      const residual = cues.filter((c) => c.translation && pattern.test(c.translation))
      if (residual.length > 0) {
        findings.push({
          kind: 'residual',
          severity: 'warn',
          n: residual.length,
          atSec: Math.round(residual[0].startMs / 1000)
        })
      }
    }
  }

  const level = findings.some((f) => f.severity === 'bad')
    ? 'bad'
    : findings.length > 0
      ? 'warn'
      : 'good'
  return { level, findings }
}
