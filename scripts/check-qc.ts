/**
 * 质检规则的自检矩阵：每种「该报」和「不该报」的情形各钉一条。
 *
 * 特别防两头：漏报让坏结果混进片库（用户看到一半才发现漏了五分钟对白），
 * 误报让徽标狼来了（每个文件都黄，等于没有质检）。
 */
import { computeQc } from '../src/main/core/subtitle/qc'
import type { Cue } from '../src/main/core/subtitle/types'
import type { SpeechRegion } from '../src/main/core/asr/vad'

let bad = 0
const check = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${name}`)
    return
  }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

/** 造一条 60 分钟的「健康」样本：语音区间与字幕一一贴合 */
function healthy(n = 100): { cues: Cue[]; regions: SpeechRegion[] } {
  const cues: Cue[] = []
  const regions: SpeechRegion[] = []
  for (let i = 0; i < n; i += 1) {
    const start = i * 30000
    regions.push({ startMs: start + 100, endMs: start + 2900 })
    cues.push({
      index: i + 1,
      startMs: start,
      endMs: start + 3000,
      text: 'こんにちは世界です',
      translation: '你好世界'
    })
  }
  return { cues, regions }
}

console.log('健康样本：')
{
  const { cues, regions } = healthy()
  const qc = computeQc(cues, regions, { translated: true, targetLanguage: 'zh' })
  check('等级 good、零发现', { level: qc.level, n: qc.findings.length }, { level: 'good', n: 0 })
}

console.log('\n覆盖率：')
{
  // 语音区间是字幕的三倍多 → 覆盖率跌破 55% → bad
  const { cues, regions } = healthy(30)
  for (let i = 0; i < 70; i += 1) {
    const start = (30 + i) * 30000
    regions.push({ startMs: start, endMs: start + 2800 })
  }
  const qc = computeQc(cues, regions)
  check(
    '覆盖率过低 → bad + coverage 发现',
    { level: qc.level, kind: qc.findings[0]?.kind },
    { level: 'bad', kind: 'coverage' }
  )
}

console.log('\n漏段（gap）：')
{
  const { cues, regions } = healthy(20)
  // 在字幕之间插一段 12 秒的连续语音，没有任何字幕盖住它
  regions.push({ startMs: 700000, endMs: 712000 })
  const qc = computeQc(cues, regions)
  const gap = qc.findings.find((f) => f.kind === 'gap')
  check('12 秒无字幕语音 → gap 发现', { n: gap?.n, atSec: gap?.atSec }, { n: 1, atSec: 700 })
  // 4 秒的间隙（配乐误检的典型长度）不该报
  const qc2 = computeQc(healthy(20).cues, [...healthy(20).regions, { startMs: 700000, endMs: 704000 }])
  check('4 秒间隙不报（配乐假阳性）', qc2.findings.some((f) => f.kind === 'gap'), false)
}

console.log('\n超长条：')
{
  const { cues, regions } = healthy(20)
  cues[5] = { ...cues[5], startMs: 150000, endMs: 168000 }
  const qc = computeQc(cues, regions)
  check('18 秒长条 → overlong', qc.findings.some((f) => f.kind === 'overlong'), true)
}

console.log('\n语速：')
{
  const { cues, regions } = healthy(100)
  // 3 条 1 秒塞 30 个字（30 单位/秒）
  for (const i of [3, 4, 5]) {
    cues[i] = { ...cues[i], endMs: cues[i].startMs + 1000, text: '字'.repeat(30) }
  }
  const qc = computeQc(cues, regions)
  check('成片超速 → fastRate', qc.findings.some((f) => f.kind === 'fastRate'), true)
  // 只有 1 条超速（喊叫/拟声词）不报
  const one = healthy(100)
  one.cues[3] = { ...one.cues[3], endMs: one.cues[3].startMs + 1000, text: '字'.repeat(30) }
  check(
    '孤例超速不报（喊叫与拟声词的豁免）',
    computeQc(one.cues, one.regions).findings.some((f) => f.kind === 'fastRate'),
    false
  )
}

console.log('\n非法时长（编辑器手改时间的护栏）：')
{
  const { cues, regions } = healthy(20)
  cues[4] = { ...cues[4], startMs: 130000, endMs: 129000 }
  const qc = computeQc(cues, regions)
  const f = qc.findings.find((x) => x.kind === 'invalid')
  check('起止颠倒 → invalid + bad', { sev: f?.severity, n: f?.n }, { sev: 'bad', n: 1 })
}

console.log('\n翻译检查：')
{
  const { cues, regions } = healthy(20)
  delete cues[2].translation
  delete cues[7].translation
  const qc = computeQc(cues, regions, { translated: true, targetLanguage: 'zh' })
  const f = qc.findings.find((x) => x.kind === 'untranslated')
  check('缺译文 → untranslated（2/20 = warn 档）', { n: f?.n, sev: f?.severity }, { n: 2, sev: 'warn' })

  const many = healthy(20)
  for (let i = 0; i < 5; i += 1) delete many.cues[i].translation
  const qc2 = computeQc(many.cues, many.regions, { translated: true, targetLanguage: 'zh' })
  check(
    '缺译文超一成 → bad',
    qc2.findings.find((x) => x.kind === 'untranslated')?.severity,
    'bad'
  )

  const resid = healthy(20)
  resid.cues[4] = { ...resid.cues[4], translation: '你好ございます' }
  const qc3 = computeQc(resid.cues, resid.regions, { translated: true, targetLanguage: 'zh' })
  check('中文译文残留假名 → residual', qc3.findings.some((x) => x.kind === 'residual'), true)

  check(
    '未开翻译时不做翻译检查',
    computeQc(resid.cues, resid.regions).findings.some((x) => x.kind === 'residual'),
    false
  )
}

console.log('\n无 VAD 的来源（字幕轨/字幕文件）：')
{
  const { cues } = healthy(20)
  const qc = computeQc(cues, null, { translated: true, targetLanguage: 'zh' })
  check('没有区间就不做覆盖率检查，结构与翻译检查照常', qc.level, 'good')
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
