/**
 * 任务缓存的正确性矩阵。
 *
 * 缓存错误复用不会报错，只会**静默给出错的结果**——最典型的：换了翻译模型重跑，
 * 看到的却还是旧模型的译文，用户以为换模型没用。这里把每一种「必须作废」和
 * 每一种「可以复用」都钉死；改动 jobstore 或 pipeline 的缓存逻辑必须先过这关。
 *
 * 与 check-i18n / check-css / check-batch 一样是自检脚本，不引入测试框架。
 */
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  dequantizeEnergy,
  glossaryHashOf,
  JobStore,
  planTranslation,
  quantizeEnergy,
  sourceKeyOf
} from '../src/main/core/jobstore'
import type { JobRecord, TranslationMeta } from '../src/main/core/jobstore'
import type { Cue } from '../src/main/core/subtitle/types'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${name}`)
    return
  }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

const cues = (spec: Array<[number, string, string | null, boolean?]>): Cue[] =>
  spec.map(([index, text, translation, srcEdited]) => ({
    index,
    startMs: index * 1000,
    endMs: index * 1000 + 900,
    text,
    ...(translation ? { translation } : {}),
    ...(srcEdited ? { srcEdited: true } : {})
  }))

const META: TranslationMeta = {
  engineId: 'api|p1|doubao-seed',
  targetLanguage: 'zh',
  promptRev: 1,
  glossaryHash: glossaryHashOf([]),
  partial: false,
  updatedAt: '2026-08-24T00:00:00Z'
}
const WANT = {
  engineId: META.engineId,
  targetLanguage: META.targetLanguage,
  promptRev: META.promptRev,
  glossaryHash: META.glossaryHash
}

console.log('译文复用判定（planTranslation）：')
eq('没有历史元数据 → 全部重翻', planTranslation(undefined, WANT, cues([[1, 'a', '甲']])), {
  mode: 'fresh'
})
eq(
  '四元组完全一致且全有译文 → 全部复用',
  planTranslation(META, WANT, cues([[1, 'a', '甲'], [2, 'b', '乙']])),
  { mode: 'reuse', missingIndexes: [] }
)
eq(
  '换翻译模型（engineId 变）→ 全部重翻，绝不混用',
  planTranslation(META, { ...WANT, engineId: 'api|p1|gpt-4o' }, cues([[1, 'a', '甲']])),
  { mode: 'fresh' }
)
eq(
  '换本地/云端引擎 → 全部重翻',
  planTranslation(META, { ...WANT, engineId: 'local|qwen3-8b.gguf' }, cues([[1, 'a', '甲']])),
  { mode: 'fresh' }
)
eq(
  '换目标语言 → 全部重翻',
  planTranslation(META, { ...WANT, targetLanguage: 'en' }, cues([[1, 'a', '甲']])),
  { mode: 'fresh' }
)
eq(
  '提示词升级（promptRev 变）→ 全部重翻',
  planTranslation(META, { ...WANT, promptRev: 2 }, cues([[1, 'a', '甲']])),
  { mode: 'fresh' }
)
eq(
  '术语表内容变（哈希变）→ 全部重翻',
  planTranslation(
    META,
    { ...WANT, glossaryHash: glossaryHashOf([{ from: 'Lena', to: '蕾娜' }]) },
    cues([[1, 'a', '甲']])
  ),
  { mode: 'fresh' }
)
eq(
  '同参数但有条目缺译文 → 只补缺的',
  planTranslation(META, WANT, cues([[1, 'a', '甲'], [2, 'b', null], [3, 'c', '丙']])),
  { mode: 'reuse', missingIndexes: [2] }
)
eq(
  '同参数但原文被编辑过 → 该条重翻（旧译文对应的是改前原文）',
  planTranslation(META, WANT, cues([[1, 'a', '甲', true], [2, 'b', '乙']])),
  { mode: 'reuse', missingIndexes: [1] }
)
eq(
  '上次翻译标记为 partial 不影响判定（按每条实际有无译文算）',
  planTranslation({ ...META, partial: true }, WANT, cues([[1, 'a', '甲'], [2, 'b', null]])),
  { mode: 'reuse', missingIndexes: [2] }
)

console.log('\n术语表哈希（glossaryHashOf）：')
eq(
  '与条目顺序无关',
  glossaryHashOf([
    { from: 'Lena', to: '蕾娜' },
    { from: 'Shin', to: '辛' }
  ]),
  glossaryHashOf([
    { from: 'Shin', to: '辛' },
    { from: 'Lena', to: '蕾娜' }
  ])
)
eq(
  '译法变了哈希必须变',
  glossaryHashOf([{ from: 'Lena', to: '蕾娜' }]) === glossaryHashOf([{ from: 'Lena', to: '莱娜' }]),
  false
)
eq('空表哈希稳定', glossaryHashOf([]), glossaryHashOf([]))
eq(
  '仅空白的条目视同不存在',
  glossaryHashOf([{ from: '  ', to: '' }]),
  glossaryHashOf([])
)

console.log('\n源阶段缓存键（sourceKeyOf）：')
{
  const base = sourceKeyOf({ kind: 'asr', modelFile: 'ggml-large-v3.bin', language: 'ja', audioIndex: 0 })
  eq(
    '换识别模型 → 键不同',
    base === sourceKeyOf({ kind: 'asr', modelFile: 'ggml-large-v3-turbo.bin', language: 'ja', audioIndex: 0 }),
    false
  )
  eq(
    '换源语言 → 键不同',
    base === sourceKeyOf({ kind: 'asr', modelFile: 'ggml-large-v3.bin', language: 'auto', audioIndex: 0 }),
    false
  )
  eq(
    '换音轨 → 键不同',
    base === sourceKeyOf({ kind: 'asr', modelFile: 'ggml-large-v3.bin', language: 'ja', audioIndex: 1 }),
    false
  )
  eq(
    '换字幕轨 → 键不同',
    sourceKeyOf({ kind: 'embedded', subtitleIndex: 0 }) ===
      sourceKeyOf({ kind: 'embedded', subtitleIndex: 1 }),
    false
  )
}

console.log('\n响度曲线量化往返：')
{
  const frames = Float32Array.from([-100, -87.6, -45.2, -0.4, 0, -12.9])
  const back = dequantizeEnergy(quantizeEnergy({ frameMs: 20, frames }), 20)
  const maxErr = Math.max(...frames.map((v, i) => Math.abs(back.frames[i] - v)))
  eq('量化误差 ≤ 0.5dB（精修阈值粒度远大于此）', maxErr <= 0.5, true)
  eq('帧数不变', back.frames.length, frames.length)
}

console.log('\nJobStore 文件往返：')
const work = mkdtempSync(join(tmpdir(), 'wavesubs-checkcache-'))
try {
  const inputPath = join(work, 'movie.mkv')
  writeFileSync(inputPath, 'fake-video-bytes')
  const store = new JobStore(join(work, 'cache'))

  const record: JobRecord = {
    version: 1,
    inputPath,
    identity: '',
    sourceKey: sourceKeyOf({ kind: 'asr', modelFile: 'm.bin', language: 'ja', audioIndex: 0 }),
    timingRev: 1,
    language: 'ja',
    durationSec: 120,
    rawCues: cues([[1, 'こんにちは', null]]),
    regions: [{ startMs: 100, endMs: 900 }],
    energyFrameMs: 20,
    cues: cues([[1, 'こんにちは', '你好']]),
    edited: false,
    createdAt: '2026-08-24T00:00:00Z',
    updatedAt: '2026-08-24T00:00:00Z'
  }
  await store.save(record, { frameMs: 20, frames: Float32Array.from([-50, -20, -80]) })

  const loaded = await store.load(inputPath)
  eq('存进去读出来内容一致', loaded?.cues[0]?.translation, '你好')
  eq('语音区间保留', loaded?.regions?.length, 1)
  const energy = await store.loadEnergy(inputPath)
  eq('响度 sidecar 可读回', energy?.frames.length, 3)

  // 文件被替换（大小变）→ 身份不匹配 → 视为无缓存。同名不同内容绝不能吃到旧转写
  writeFileSync(inputPath, 'different-and-longer-content-!!')
  eq('源文件内容变了 → 缓存作废', await store.load(inputPath), null)

  // 只动 mtime 也作废：宁可错杀（重新识别一次），不可错放（旧转写配新文件）
  writeFileSync(inputPath, 'fake-video-bytes')
  await store.save({ ...record }, null)
  utimesSync(inputPath, new Date(), new Date(Date.now() + 5000))
  eq('mtime 变了 → 缓存作废', await store.load(inputPath), null)
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
