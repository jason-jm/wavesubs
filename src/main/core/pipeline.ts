import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve as resolvePath } from 'node:path'
import type { TranslationKey } from '../../shared/i18n/core'
import { LocalizedError } from '../../shared/i18n/core'
import type {
  ExportContent,
  ExportFormat,
  JobProgress,
  PipelineStage,
  QcReport,
  SubtitleSource
} from '../../shared/types'
import { detectSpeechRegions } from './asr/vad'
import type { SpeechRegion } from './asr/vad'
import { transcribeWithWhisperCpp } from './asr/whisperCpp'
import { extractAudio, probeMedia } from './media'
import { cuesToAss } from './subtitle/ass'
import { extractEmbeddedSubtitle, loadSubtitleFile } from './subtitle/import'
import { cuesToSrt } from './subtitle/srt'
import { analyzeWavEnergy, refineAsrCues, TIMING_REV } from './subtitle/timing'
import type { EnergyProfile } from './subtitle/timing'
import type { Cue } from './subtitle/types'
import { ffmpegPath, ffprobePath, vadBinPath, whisperCliPath } from './tools'
import { glossaryHashOf, JobStore, planTranslation, sourceKeyOf } from './jobstore'
import { computeQc } from './subtitle/qc'
import { writeOutput } from './output'
import type { JobRecord } from './jobstore'
import { PROMPT_REV } from './translate/prompt'
import { translateCues } from './translate/translateCues'
import { normalizeLanguageCode } from './translate/types'
import type { TranslationProvider } from './translate/types'
import { buildSignBlocks, extractFrames, judgeSigns, ocrLanguagesFor, runVisionOcr, signsToCues, SIGN_FPS, SIGN_FRAME_WIDTH } from './signs'
import type { OcrFrame } from './signs'
import { languageName } from './translate/types'

export interface JobOptions {
  input: string
  /** 语音识别用的模型路径；仅 source.kind === 'asr' 时需要 */
  modelPath?: string
  language?: string
  /** Silero VAD 模型路径；提供则用真实说话区间校正字幕时间、剔除幻觉 */
  vadModelPath?: string
  /** 缺省为语音识别 */
  source?: SubtitleSource
  audioIndex?: number
  /** 缺省导出到源文件所在目录 */
  outputDir?: string
  translate?: {
    provider: TranslationProvider
    targetLanguage: string
    /** 引擎身份（含具体模型），译文缓存靠它判断能否复用。不传则视为未知、永不复用 */
    engineId?: string
  }
  /** 术语表；参与译文缓存哈希——表变了旧译文就作废 */
  glossary?: Array<{ from: string; to: string }>
  output: { format: ExportFormat; content: ExportContent }
  /** 任务缓存目录。不传则完全不读写缓存（评测与简单 CLI 用法保持无状态） */
  cacheDir?: string
  /** 忽略已有缓存强制重跑（结果仍会写入缓存） */
  refreshCache?: boolean
  /** 目标目录写不进去（沙盒/只读卷）时的兜底输出目录；不传则直接报错 */
  fallbackOutputDir?: string
  onProgress?: (progress: JobProgress) => void
  /** 用户取消：各子进程被杀、翻译在批间停下，任务以 error.jobCancelled 结束 */
  signal?: AbortSignal
  /** 画面文字：随包 vision-ocr 的路径；需要 translate，源不能是字幕文件 */
  signs?: { visionOcr: string; minImportance?: number }
}

export interface JobResult {
  outputPath: string
  language: string
  targetLanguage?: string
  cueCount: number
  /** 画面文字条数（开启时才有） */
  signCount?: number
  translatedCount?: number
  asrDevice?: string
  durationSec: number
  cues: Cue[]
  /** 识别/抽取阶段来自缓存 */
  sourceFromCache: boolean
  /** 译文复用情况；没有翻译阶段时为 undefined */
  translationReuse?: 'none' | 'partial' | 'all'
  translationReusedCount?: number
  translationFreshCount?: number
  qc: QcReport
}

function stageSpans(
  fromAsr: boolean,
  withTranslate: boolean,
  withSigns: boolean
): Record<PipelineStage, [number, number]> {
  if (fromAsr) {
    if (withTranslate && withSigns) {
      return { probe: [0, 2], extract: [2, 8], transcribe: [8, 50], translate: [50, 80], signs: [80, 95], write: [95, 100] }
    }
    return withTranslate
      ? { probe: [0, 2], extract: [2, 8], transcribe: [8, 55], translate: [55, 95], signs: [95, 95], write: [95, 100] }
      : { probe: [0, 2], extract: [2, 10], transcribe: [10, 97], translate: [97, 97], signs: [97, 97], write: [97, 100] }
  }
  // 已有字幕：没有识别阶段，抽取/读取很快，主要时间花在翻译
  if (withTranslate && withSigns) {
    return { probe: [0, 3], extract: [3, 12], transcribe: [12, 12], translate: [12, 75], signs: [75, 95], write: [95, 100] }
  }
  return withTranslate
    ? { probe: [0, 3], extract: [3, 15], transcribe: [15, 15], translate: [15, 97], signs: [97, 97], write: [97, 100] }
    : { probe: [0, 5], extract: [5, 95], transcribe: [95, 95], translate: [95, 95], signs: [95, 95], write: [95, 100] }
}

export function serializeCues(cues: Cue[], format: ExportFormat, content: ExportContent): string {
  if (format === 'ass') return cuesToAss(cues, content)
  if (content === 'original') return cuesToSrt(cues, (c) => c.text)
  if (content === 'bilingual') {
    return cuesToSrt(cues, (c) => (c.translation ? `${c.translation}\n${c.text}` : c.text))
  }
  return cuesToSrt(cues, (c) => c.translation || c.text)
}

// 字幕文件常见 movie.chs.ass / movie.eng.forced.srt，去掉尾部语言标记避免叠加
const LANG_TOKENS = new Set([
  'zh', 'chs', 'cht', 'chi', 'zho', 'zh-cn', 'zh-tw', 'zh-hans', 'zh-hant', 'sc', 'tc',
  'en', 'eng', 'ja', 'jpn', 'jp', 'ko', 'kor', 'fr', 'fra', 'fre', 'de', 'ger', 'deu',
  'es', 'spa', 'ru', 'rus', 'it', 'ita', 'pt', 'por', 'ar', 'ara', 'th', 'tha', 'vi', 'vie',
  'forced', 'sdh', 'cc', 'default', 'engchs', 'chseng', 'simplified', 'traditional',
  '简体', '繁体', '简中', '繁中', '中文', '英文', '日文', '中日', '双语'
])

/** 拆出主干与被去掉的语言标记，后者在纯格式转换时用来保留原文件的语言后缀 */
function stripLanguageSuffix(stem: string): { stem: string; removed: string[] } {
  const parts = stem.split('.')
  const removed: string[] = []
  for (let i = 0; i < 2 && parts.length > 1; i += 1) {
    const last = parts[parts.length - 1].toLowerCase()
    if (!LANG_TOKENS.has(last)) break
    removed.unshift(parts.pop() as string)
  }
  return { stem: parts.join('.'), removed }
}

/**
 * 成品文件的落点与命名。抽成独立函数是因为编辑器的「重新导出」必须和管线
 * 完全一致——命名规则在两处各写一份，迟早会分叉出两套文件名。
 */
export function resolveOutputPath(opts: {
  input: string
  isSubtitleInput: boolean
  language: string
  targetLanguage?: string
  format: ExportFormat
  content: ExportContent
  outputDir?: string
}): string {
  const rawStem = basename(opts.input, extname(opts.input))
  const { stem, removed } = opts.isSubtitleInput
    ? stripLanguageSuffix(rawStem)
    : { stem: rawStem, removed: [] as string[] }
  const srcTag = opts.language !== 'unknown' ? opts.language : (removed[0] ?? 'orig')
  const langTag =
    opts.content === 'original' || !opts.targetLanguage ? srcTag : opts.targetLanguage
  const outDir = opts.outputDir ?? dirname(opts.input)
  let outputPath = join(outDir, `${stem}.${langTag}.${opts.format}`)
  // 绝不覆盖拖进来的源字幕文件
  if (resolvePath(outputPath) === resolvePath(opts.input)) {
    outputPath = join(outDir, `${stem}.${langTag}.translated.${opts.format}`)
  }
  return outputPath
}

const cloneCues = (cues: Cue[]): Cue[] => cues.map((c) => ({ ...c }))

export async function runSubtitleJob(opts: JobOptions): Promise<JobResult> {
  const source: SubtitleSource = opts.source ?? { kind: 'asr' }
  const fromAsr = source.kind === 'asr'
  // 画面文字要翻译引擎判别，也要有画面：字幕文件输入没有画面
  const signsWanted = Boolean(opts.signs && opts.translate && source.kind !== 'file')
  const spans = stageSpans(fromAsr, Boolean(opts.translate), signsWanted)
  const report = (stage: PipelineStage, stagePercent: number, messageKey?: TranslationKey): void => {
    const [lo, hi] = spans[stage]
    const bounded = Math.min(100, Math.max(0, stagePercent))
    opts.onProgress?.({
      stage,
      percent: Math.round(lo + ((hi - lo) * bounded) / 100),
      stagePercent: Math.round(bounded),
      messageKey,
      signs: signsWanted
    })
  }

  const store = opts.cacheDir ? new JobStore(opts.cacheDir) : null
  const sourceKey = sourceKeyOf(
    source.kind === 'asr'
      ? {
          kind: 'asr',
          modelFile: opts.modelPath ? basename(opts.modelPath) : '',
          language: opts.language ?? 'auto',
          audioIndex: opts.audioIndex ?? 0
        }
      : source.kind === 'embedded'
        ? { kind: 'embedded', subtitleIndex: source.subtitleIndex }
        : { kind: 'file' }
  )

  const workDir = await mkdtemp(join(tmpdir(), 'wavesubs-job-'))
  try {
    // null = 源阶段还没产出。用 null 而不是留待赋值，是让 TS 能证明两条路径都覆盖了
    let cues: Cue[] | null = null
    let language = opts.language ?? 'unknown'
    let durationSec = 0
    let record: JobRecord | null = null
    let sourceFromCache = false
    let qcRegions: SpeechRegion[] | null = null
    let asrDevice: string | undefined
    /** 缓存里已有的画面文字（上次开着这个选项跑过） */
    let cachedSignCues: Cue[] = []
    /** 抽帧 + OCR 与识别并行：OCR 走 CPU/神经引擎，whisper 走 GPU，互不抢 */
    let ocrPromise: Promise<OcrFrame[]> | null = null
    /**
     * OCR 用哪种语言得等语种确定：抽帧先并行跑，识别语言由 whisper 开头几秒的自动检测给出
     * （已指定语种或走缓存/字幕轨时立刻就有）。没有这一步时 Vision 只认英文，日文招牌一个都读不出。
     */
    let resolveLanguage: (lang: string | undefined) => void = () => undefined
    const languageKnown = new Promise<string | undefined>((resolve) => { resolveLanguage = resolve })
    const startOcr = (): void => {
      if (!signsWanted || ocrPromise || !opts.signs) return
      const bin = opts.signs.visionOcr
      ocrPromise = (async () => {
        const files = await extractFrames(ffmpegPath(), {
          input: opts.input,
          outDir: join(workDir, 'frames'),
          fps: SIGN_FPS,
          width: SIGN_FRAME_WIDTH,
          durationSec,
          signal: opts.signal
        })
        const lang = await languageKnown
        return runVisionOcr(bin, files, ocrLanguagesFor(lang), opts.signal)
      })()
      // 失败留到画面文字阶段再抛：识别与翻译的成果先落盘，不因为 OCR 挂了全丢
      ocrPromise.catch(() => undefined)
    }

    // ---------- 源阶段：优先吃缓存 ----------
    if (store && !opts.refreshCache) {
      const cached = await store.load(opts.input)
      if (cached && cached.sourceKey === sourceKey) {
        record = cached
        sourceFromCache = true
        language = cached.language
        durationSec = cached.durationSec
        if (!cached.edited && cached.timingRev !== TIMING_REV && source.kind === 'asr') {
          /**
           * 时间轴算法升级：用存下的原始转写 + VAD + 响度重新精修，让老缓存吃到新效果。
           * 分句边界会变，旧译文对不上新条目，只能一并作废——诚实的作废好过错位的复用。
           * 用户编辑过的记录例外：人修过的时间轴不能被算法覆盖。
           */
          const energy = await store.loadEnergy(opts.input)
          cachedSignCues = cloneCues(cached.cues.filter((c) => c.kind === 'sign'))
          cues = refineAsrCues(cloneCues(cached.rawCues), cached.regions, energy)
          cached.cues = [...cloneCues(cues), ...cachedSignCues]
          cached.timingRev = TIMING_REV
          cached.translation = undefined
        } else {
          // 画面文字存在数组尾部，和语音字幕分开走：翻译计划、时间轴精修都只看语音字幕
          cachedSignCues = cloneCues(cached.cues.filter((c) => c.kind === 'sign'))
          cues = cloneCues(cached.cues.filter((c) => c.kind !== 'sign'))
        }
        qcRegions = cached.regions
        report('probe', 100)
        report('extract', 100)
        report('transcribe', 100, 'progress.sourceCached')
        resolveLanguage(language)
        if (cachedSignCues.length === 0 || opts.refreshCache) startOcr()
      }
    }

    // ---------- 源阶段：正常路径 ----------
    if (cues === null) {
      let rawCues: Cue[]
      let regions: SpeechRegion[] | null = null
      let energy: EnergyProfile | null = null

      if (source.kind === 'file') {
        report('probe', 0, 'progress.readSubtitle')
        report('extract', 0, 'progress.parseSubtitle')
        const loaded = await loadSubtitleFile(ffmpegPath(), opts.input)
        cues = loaded.cues
        rawCues = cloneCues(cues)
        durationSec = (cues[cues.length - 1]?.endMs ?? 0) / 1000
        report('extract', 100)
      } else {
        report('probe', 0, 'progress.readMedia')
        const media = await probeMedia(ffprobePath(), opts.input)
        durationSec = media.durationSec
        report('probe', 100)
        // 指定了语种就立刻可用；自动检测的等 whisper 报出来（字幕轨的在下面按轨道语言给）
        if (opts.language) resolveLanguage(opts.language)
        startOcr()

        if (source.kind === 'embedded') {
          const stream = media.subtitleStreams.find(
            (s) => s.subtitleIndex === source.subtitleIndex
          )
          if (!stream) throw new Error(`这个文件里没有第 ${source.subtitleIndex + 1} 条字幕轨`)
          if (!stream.textBased) {
            throw new Error(
              `第 ${source.subtitleIndex + 1} 条是图形字幕（${stream.codec}），` +
                `需要 OCR 才能转成文本，暂不支持——请改用语音识别或选择文本字幕轨`
            )
          }
          report('extract', 0, 'progress.extractSubtitle')
          cues = await extractEmbeddedSubtitle(ffmpegPath(), {
            videoPath: opts.input,
            subtitleIndex: source.subtitleIndex,
            durationSec: media.durationSec,
            onProgress: (p) => report('extract', p, 'progress.extractSubtitle')
          })
          rawCues = cloneCues(cues)
          if (language === 'unknown' && stream.language) {
            language = normalizeLanguageCode(stream.language)
          }
          resolveLanguage(language !== 'unknown' ? language : undefined)
          report('extract', 100)
        } else {
          if (!opts.modelPath) throw new LocalizedError('error.noModelPath')
          if (media.audioStreams.length === 0) throw new LocalizedError('error.noAudioTrack')
          const wavPath = join(workDir, 'audio.wav')
          report('extract', 0, 'progress.extractAudio')
          await extractAudio(ffmpegPath(), {
            input: opts.input,
            output: wavPath,
            audioIndex: opts.audioIndex ?? 0,
            durationSec: media.durationSec,
            signal: opts.signal,
            onProgress: (p) => report('extract', p, 'progress.extractAudio')
          })
          report('extract', 100)

          report('transcribe', 0, 'progress.transcribing')
          const regionsPromise = opts.vadModelPath
            ? detectSpeechRegions(vadBinPath(), opts.vadModelPath, wavPath, opts.signal).catch(() => null)
            : Promise.resolve(null)
          const energyPromise = analyzeWavEnergy(wavPath).catch(() => null)
          const asr = await transcribeWithWhisperCpp(whisperCliPath(), {
            audioPath: wavPath,
            modelPath: opts.modelPath,
            language: opts.language,
            onProgress: (p) => report('transcribe', p, 'progress.transcribing'),
            onLanguage: (lang) => resolveLanguage(lang),
            signal: opts.signal
          })
          // 没检测出来（或没打印）也别让 OCR 干等：识别完了按结果语种给
          resolveLanguage(asr.language !== 'unknown' ? asr.language : undefined)
          ;[regions, energy] = await Promise.all([regionsPromise, energyPromise])
          qcRegions = regions
          rawCues = asr.cues
          asrDevice = asr.device
          cues = refineAsrCues(cloneCues(asr.cues), regions, energy)
          language = asr.language
        }
      }

      if (store) {
        const now = new Date().toISOString()
        record = {
          version: 1,
          inputPath: opts.input,
          identity: '',
          sourceKey,
          timingRev: TIMING_REV,
          language,
          durationSec,
          rawCues,
          regions,
          energyFrameMs: energy?.frameMs ?? null,
          cues: cloneCues(cues),
          edited: false,
          createdAt: now,
          updatedAt: now
        }
        // 翻译还没开始就先落盘：翻译阶段哪怕整个崩掉，识别成果也已经保住了
        await store.save(record, energy)
      }
    }

    if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
    if (cues === null || cues.length === 0) throw new LocalizedError('error.noCues')

    // ---------- 翻译阶段：按四元组决定复用还是重翻 ----------
    let translatedCount: number | undefined
    let translationReuse: JobResult['translationReuse']
    let translationReusedCount: number | undefined
    let translationFreshCount: number | undefined
    if (opts.translate) {
      const want = {
        engineId: opts.translate.engineId ?? 'unknown',
        targetLanguage: opts.translate.targetLanguage,
        promptRev: PROMPT_REV,
        glossaryHash: glossaryHashOf(opts.glossary ?? [])
      }
      const plan = planTranslation(record?.translation, want, cues)
      let targets: Cue[]
      if (plan.mode === 'fresh') {
        for (const c of cues) delete c.translation
        targets = cues
        translationReuse = 'none'
      } else {
        const missing = new Set(plan.missingIndexes)
        targets = cues.filter((c) => missing.has(c.index))
        translationReusedCount = cues.length - targets.length
        translationFreshCount = targets.length
        translationReuse = targets.length === 0 ? 'all' : 'partial'
        if (targets.length === 0) report('translate', 100)
      }

      if (targets.length > 0) {
        report('translate', 0, 'progress.translating')
        try {
          await translateCues(
            targets,
            opts.translate.provider,
            {
              sourceLanguage: language !== 'unknown' ? language : undefined,
              targetLanguage: opts.translate.targetLanguage,
              glossary: opts.glossary
            },
            (p) => report('translate', p, 'progress.translating'),
            { signal: opts.signal }
          )
        } catch (err) {
          // 部分批次可能已成功：先把已得译文连同元数据存下（partial），下次同参续翻
          if (store && record) {
            record.cues = cues
            record.translation = { ...want, partial: true, updatedAt: new Date().toISOString() }
            await store.save(record)
          }
          throw err
        }
        for (const c of targets) {
          if (c.translation) delete c.srcEdited
        }
      }

      translatedCount = cues.filter((c) => c.translation).length
      if (store && record) {
        record.cues = cues
        record.translation = {
          ...want,
          partial: translatedCount < cues.length,
          updatedAt: new Date().toISOString()
        }
        await store.save(record)
      }
    }

    // ---------- 画面文字 ----------
    let signCues: Cue[] = []
    if (signsWanted && opts.translate) {
      if (!ocrPromise) {
        signCues = cachedSignCues
        report('signs', 100, 'progress.signsCached')
      } else {
        report('signs', 0, 'progress.signs')
        const frames = await ocrPromise
        if (opts.signal?.aborted) throw new LocalizedError('error.jobCancelled')
        const { blocks } = buildSignBlocks(frames, SIGN_FPS, qcRegions)
        const provider = opts.translate.provider
        const judged = await judgeSigns(blocks, {
          chat: (system, user) => provider.chat(system, user, { signal: opts.signal }),
          cues,
          sourceLanguageName: language !== 'unknown' ? languageName(language) : 'foreign-language',
          targetLanguageName: languageName(opts.translate.targetLanguage),
          signal: opts.signal,
          onProgress: (p) => report('signs', p, 'progress.signs')
        })
        signCues = signsToCues(blocks, judged, { minImportance: opts.signs?.minImportance, startIndex: cues.length + 1 })
        report('signs', 100)
      }
    }
    const allCues = [...cues, ...signCues]
    if (store && record) {
      record.cues = allCues
      await store.save(record)
    }

    // ---------- 质检 ----------
    const qc = computeQc(cues, qcRegions, {
      translated: Boolean(opts.translate),
      targetLanguage: opts.translate?.targetLanguage
    })
    if (store && record) {
      record.qc = qc
      await store.save(record)
    }

    // ---------- 写出 ----------
    report('write', 0, 'progress.writing')
    const outputPath = resolveOutputPath({
      input: opts.input,
      isSubtitleInput: source.kind === 'file',
      language,
      targetLanguage: opts.translate?.targetLanguage,
      format: opts.output.format,
      content: opts.output.content,
      outputDir: opts.outputDir
    })
    const writtenPath = await writeOutput(
      outputPath,
      serializeCues(allCues, opts.output.format, opts.output.content),
      opts.fallbackOutputDir
    )
    report('write', 100, 'progress.done')

    return {
      outputPath: writtenPath,
      language,
      targetLanguage: opts.translate?.targetLanguage,
      cueCount: cues.length,
      signCount: signsWanted ? signCues.length : undefined,
      translatedCount,
      asrDevice,
      durationSec,
      cues: allCues,
      sourceFromCache,
      translationReuse,
      translationReusedCount,
      translationFreshCount,
      qc
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
