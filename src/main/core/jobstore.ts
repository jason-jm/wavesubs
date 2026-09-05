/**
 * 任务缓存：一个输入文件一条记录，存「昂贵阶段」的产出。
 *
 * 解决的问题：识别一部片要几分钟到十几分钟，抽取 NAS 大文件的内嵌字幕轨也要读完
 * 整个文件；而翻译失败重试、换个引擎重译、改个导出格式，原本都要从头再来。
 * 有了记录，源阶段（识别/抽取 + 精修）与翻译阶段各自独立复用。
 *
 * 三条防「错误复用」的规则，每一条都对应一种真实的翻车方式：
 *
 * 1. **源阶段的键里有全部影响输出的参数**（模型、语言、音轨/字幕轨），外加文件的
 *    大小和修改时间。任何一个变了就是未命中——换个识别模型绝不能拿旧转写充数。
 *
 * 2. **译文的复用条件是四元组完全相等**：引擎标识（含具体模型）、目标语言、
 *    提示词版本、术语表哈希。差一个就整体作废重翻，绝不把两个模型的译文混在一起。
 *    这是用户最容易被坑的场景：换了模型重跑，看到的却还是旧模型的译文。
 *
 * 3. **精修算法升级能触达老缓存**：记录里存原始转写 + VAD 区间 + 响度曲线，
 *    TIMING_REV 变了就用它们重新精修，而不是抱着旧时间轴不放。
 *    唯一例外是用户手动编辑过的记录——人改过的时间轴比算法新版更该保住。
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { SpeechRegion } from './asr/vad'
import type { QcReport } from '../../shared/types'
import type { EnergyProfile } from './subtitle/timing'
import type { Cue } from './subtitle/types'

export interface TranslationWant {
  /** 引擎身份：local|<模型文件> 或 api|<服务id>|<模型名>。含到具体模型，换模型必失配 */
  engineId: string
  targetLanguage: string
  promptRev: number
  glossaryHash: string
}

export interface TranslationMeta extends TranslationWant {
  /** 上次翻译是否有条目没翻上（可续翻） */
  partial: boolean
  updatedAt: string
}

export interface JobRecord {
  version: 1
  inputPath: string
  /** size|mtimeMs，加载时校验，防止同名换内容 */
  identity: string
  sourceKey: string
  timingRev: number
  language: string
  durationSec: number
  /** whisper 原始输出（精修前）。TIMING_REV 升级时用它重精修 */
  rawCues: Cue[]
  regions: SpeechRegion[] | null
  energyFrameMs: number | null
  /** 精修后的最终字幕（含译文）；编辑器的修改落在这里 */
  cues: Cue[]
  /** 用户在编辑器里改过。改过的记录不再被自动重精修覆盖 */
  edited: boolean
  translation?: TranslationMeta
  /** 最近一次任务的质检结论（可选字段，老记录没有也能读） */
  qc?: QcReport
  createdAt: string
  updatedAt: string
}

export type TranslationPlan =
  | { mode: 'fresh' }
  | { mode: 'reuse'; missingIndexes: number[] }

/**
 * 决定译文能不能复用。纯函数，缓存正确性的测试矩阵全打在它身上。
 *
 * fresh = 四元组任何一项不匹配，现有译文全部作废；
 * reuse = 完全匹配，只补「没有译文」或「原文被编辑过」的条目。
 */
export function planTranslation(
  meta: TranslationMeta | undefined,
  want: TranslationWant,
  cues: Cue[]
): TranslationPlan {
  if (
    !meta ||
    meta.engineId !== want.engineId ||
    meta.targetLanguage !== want.targetLanguage ||
    meta.promptRev !== want.promptRev ||
    meta.glossaryHash !== want.glossaryHash
  ) {
    return { mode: 'fresh' }
  }
  const missingIndexes = cues
    .filter((c) => !c.translation || c.srcEdited)
    .map((c) => c.index)
  return { mode: 'reuse', missingIndexes }
}

/** 术语表哈希：内容排序后取 sha1，与条目顺序无关。空表也有确定的哈希 */
export function glossaryHashOf(entries: Array<{ from: string; to: string }>): string {
  const normalized = entries
    .map((e) => `${e.from.trim().toLowerCase()} ${e.to.trim()}`)
    .filter((line) => line.length > 1)
    .sort()
    .join('\n')
  return createHash('sha1').update(normalized, 'utf8').digest('hex').slice(0, 16)
}

const SILENCE_DB = -100

/** 响度曲线量化成每帧 1 字节存 sidecar：2.5 小时约 450KB，够精修用，别塞进 JSON */
export function quantizeEnergy(profile: EnergyProfile): Buffer {
  const out = Buffer.allocUnsafe(profile.frames.length)
  for (let i = 0; i < profile.frames.length; i += 1) {
    const clamped = Math.round(Math.min(0, Math.max(SILENCE_DB, profile.frames[i])))
    out[i] = clamped < 0 ? clamped + 256 : clamped
  }
  return out
}

export function dequantizeEnergy(buf: Buffer, frameMs: number): EnergyProfile {
  const frames = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i += 1) {
    // 存进去的是 [-100, 0] 的补码字节，读回要按有符号解释
    const v = buf[i]
    frames[i] = v > 127 ? v - 256 : v
  }
  return { frameMs, frames }
}

const MAX_RECORDS = 200

export class JobStore {
  constructor(private readonly dir: string) {}

  private async keyFor(inputPath: string): Promise<{ key: string; identity: string } | null> {
    try {
      const s = await stat(inputPath)
      const identity = `${s.size}|${Math.round(s.mtimeMs)}`
      const key = createHash('sha1')
        .update(`${resolve(inputPath)}|${identity}`, 'utf8')
        .digest('hex')
      return { key, identity }
    } catch {
      return null
    }
  }

  private jsonPath(key: string): string {
    return join(this.dir, `${key}.json`)
  }

  private energyPath(key: string): string {
    return join(this.dir, `${key}.energy`)
  }

  /** 文件不存在、身份不匹配、格式读不懂，一律当没有缓存——损坏的缓存比没有更糟 */
  async load(inputPath: string): Promise<JobRecord | null> {
    const at = await this.keyFor(inputPath)
    if (!at) return null
    try {
      const rec = JSON.parse(await readFile(this.jsonPath(at.key), 'utf8')) as JobRecord
      if (rec.version !== 1 || rec.identity !== at.identity) return null
      if (!Array.isArray(rec.cues) || !Array.isArray(rec.rawCues)) return null
      return rec
    } catch {
      return null
    }
  }

  async loadEnergy(inputPath: string): Promise<EnergyProfile | null> {
    const at = await this.keyFor(inputPath)
    if (!at) return null
    try {
      const rec = await this.load(inputPath)
      if (!rec || rec.energyFrameMs === null) return null
      const buf = await readFile(this.energyPath(at.key))
      return dequantizeEnergy(buf, rec.energyFrameMs)
    } catch {
      return null
    }
  }

  async save(record: JobRecord, energy?: EnergyProfile | null): Promise<void> {
    const at = await this.keyFor(record.inputPath)
    if (!at) return
    await mkdir(this.dir, { recursive: true })
    record.identity = at.identity
    record.updatedAt = new Date().toISOString()
    await writeFile(this.jsonPath(at.key), JSON.stringify(record), 'utf8')
    if (energy) {
      await writeFile(this.energyPath(at.key), quantizeEnergy(energy))
    }
    void this.prune()
  }

  /** 只按数量上限清理，按更新时间淘汰最旧的。失败不致命，静默跳过 */
  private async prune(): Promise<void> {
    try {
      const files = (await readdir(this.dir)).filter((f) => f.endsWith('.json'))
      if (files.length <= MAX_RECORDS) return
      const dated = await Promise.all(
        files.map(async (f) => ({ f, mtime: (await stat(join(this.dir, f))).mtimeMs }))
      )
      dated.sort((a, b) => a.mtime - b.mtime)
      for (const { f } of dated.slice(0, dated.length - MAX_RECORDS)) {
        const key = f.replace(/\.json$/, '')
        await rm(this.jsonPath(key), { force: true })
        await rm(this.energyPath(key), { force: true })
      }
    } catch {
      /* 清理失败无所谓，下次再试 */
    }
  }
}

/** 源阶段的缓存键：任何影响转写/抽取输出的参数都在里面 */
export function sourceKeyOf(
  source:
    | { kind: 'asr'; modelFile: string; language: string; audioIndex: number }
    | { kind: 'embedded'; subtitleIndex: number }
    | { kind: 'file' }
): string {
  if (source.kind === 'asr') {
    return `asr|m=${source.modelFile}|l=${source.language}|a=${source.audioIndex}`
  }
  if (source.kind === 'embedded') return `sub|i=${source.subtitleIndex}`
  return 'file'
}
