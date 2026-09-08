/**
 * 时间轴后处理里「哪些条该丢、哪些不能丢」的自检。
 *
 * 这些规则每一条都对应语料里真实出现过的坏样本；改动 timing.ts 的过滤逻辑前先跑一遍。
 */
import { refineAsrCues } from '../src/main/core/subtitle/timing'
import type { Cue } from '../src/main/core/subtitle/types'

let bad = 0
const check = (name: string, ok: boolean): void => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}`)
  if (!ok) bad += 1
}

// 0~10s 全程有人声；10~20s 完全无声
const regions = [{ startMs: 0, endMs: 10_000 }]
const cues: Cue[] = [
  { index: 1, startMs: 0, endMs: 3000, text: '今日はいい天気ですね' },
  { index: 2, startMs: 3000, endMs: 6000, text: '♪ 誰にも邪魔されず 華麗に咲いてる' },
  { index: 3, startMs: 6000, endMs: 9000, text: '♪♪♪' },
  { index: 4, startMs: 12_000, endMs: 18_000, text: '*Gunshot*' },
  { index: 5, startMs: 12_000, endMs: 18_000, text: 'ご視聴ありがとうございました' }
]
const out = refineAsrCues(cues, regions, null)
const texts = out.map((c) => c.text)
console.log('后处理过滤：')
check('普通台词保留', texts.includes('今日はいい天気ですね'))
check('带歌词的 ♪ 行保留（真唱出来的内容）', texts.some((t) => t.includes('誰にも邪魔されず')))
check('只有音符的 ♪♪♪ 丢弃', !texts.some((t) => /^[\s♪♫♬]+$/.test(t)))
check('无人声处的 *Gunshot* 音效描述丢弃', !texts.includes('*Gunshot*'))
check('无人声处的「ご視聴ありがとうございました」丢弃', !texts.some((t) => t.includes('ご視聴')))

import { collapseRepetitions } from '../src/main/core/subtitle/timing'
console.log('条内复读收敛：')
const eqs: Array<[string, string, string]> = [
  ['空格分隔的片假名复读', 'ヤバイ ヤバイ ヤバイ ヤバイ ヤバイ ヤバイ', 'ヤバイ'],
  ['无分隔的短语复读', 'やばいやばいやばいやばいやばい', 'やばいやばい'],
  ['逗号分隔的英文复读', 'No, no, no, no, no, che pieno', 'No, che pieno'],
  ['单字刷屏', 'おおおおおおおお', 'おお'],
  ['正常句子不动', '今日はいい天気ですね', '今日はいい天気ですね'],
  ['两遍不算复读', 'そうそう', 'そうそう'],
  ['ますます 不动', 'ますます寒くなる', 'ますます寒くなる']
]
for (const [name, input, want] of eqs) {
  const got = collapseRepetitions(input)
  check(`${name}：${JSON.stringify(got)}`, got === want)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
