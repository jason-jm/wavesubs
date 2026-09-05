import type { QcFinding, QcReport } from '../../../shared/types'
import type { Translate, TranslationKey } from '../../../shared/i18n'

/** 质检等级 → 徽标文案与配色。单文件页与批量页共用，两边观感一致 */
export const QC_TAG: Record<QcReport['level'], { key: TranslationKey; tone: string }> = {
  good: { key: 'qc.good', tone: 'tag-green' },
  warn: { key: 'qc.warn', tone: 'tag-orange' },
  bad: { key: 'qc.bad', tone: 'tag-red' }
}

const FINDING_KEY: Record<QcFinding['kind'], TranslationKey> = {
  coverage: 'qc.finding.coverage',
  gap: 'qc.finding.gap',
  overlong: 'qc.finding.overlong',
  fastRate: 'qc.finding.fastRate',
  untranslated: 'qc.finding.untranslated',
  residual: 'qc.finding.residual',
  invalid: 'qc.finding.invalid'
}

/** 秒 → mm:ss / h:mm:ss，给「最早出现在 {at}」用 */
function fmtAt(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function qcFindingText(finding: QcFinding, t: Translate): string {
  return t(FINDING_KEY[finding.kind], {
    n: finding.n ?? 0,
    pct: finding.pct ?? 0,
    at: finding.atSec !== undefined ? fmtAt(finding.atSec) : ''
  })
}
