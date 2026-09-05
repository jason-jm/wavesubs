import { existsSync, readFileSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type {
  ExportContent,
  ExportFormat,
  SubtitleSource,
  TranslationEngine
} from '../src/shared/types'
import { pickBestInstalled, VAD_MODEL_FILE } from '../src/main/core/asr/catalog'
import { probeMedia } from '../src/main/core/media'
import { runSubtitleJob } from '../src/main/core/pipeline'
import { isSubtitleFile } from '../src/main/core/subtitle/import'
import { ffprobePath, listLocalLlmModels, listWhisperModels } from '../src/main/core/tools'
import { LlamaServerManager, LocalLlamaProvider } from '../src/main/core/translate/llamaServer'
import { pickBestInstalledLlm } from '../src/main/core/translate/localCatalog'
import { OpenAICompatibleProvider } from '../src/main/core/translate/openaiCompatible'
import type { TranslationProvider } from '../src/main/core/translate/types'
import { translatorFor } from '../src/shared/i18n'

const cliT = translatorFor('en')

function usage(): never {
  console.log(`用法: npm run cli -- <视频文件|字幕文件> [选项]

字幕来源:
  缺省对视频做语音识别；传入字幕文件则直接读取该文件
  --sub-track <N>         改用视频内嵌的第 N 条字幕轨（从 1 开始）
  --list-tracks           只列出文件里的音轨与字幕轨，不做任何处理

选项:
  --model <路径|文件名>   Whisper 模型（缺省取 models/ 下质量最高的 ggml-*.bin）
  --language <码>         源语言 ISO 码（缺省 auto 自动检测）
  --out-dir <目录>        字幕输出目录（缺省与源文件同目录）
  --format <srt|ass>      导出格式（缺省 srt）
  --cache-dir <目录>      任务缓存目录：识别结果与译文可跨次复用（缺省不启用）
  --refresh-cache         忽略已有缓存强制重跑（结果仍写入缓存）

翻译（可选）:
  --translate             开启翻译
  --engine <local|api>    翻译引擎（缺省 local 本地模型）
  --llm <路径|文件名>     本地翻译模型 gguf（缺省取 models/llm 下质量最高的）
  --content <c>           translated | bilingual | original（缺省 translated）
  --target <码>           目标语言（缺省 zh）
  --api-base <URL>        OpenAI 兼容接口地址（缺省 https://api.openai.com/v1）
  --api-model <名称>      翻译用的模型名（缺省 gpt-4o-mini）
  --glossary <文件>       术语表：每行「原文=译文」，命中的条目强制按指定译法
  云端 API Key 从环境变量 WAVESUBS_API_KEY 读取`)
  process.exit(1)
}

/** 每行「原文=译文」；# 开头是注释。解析不出的行直接报错退出，静默丢弃会让人以为生效了 */
function loadGlossaryFile(path: string): Array<{ from: string; to: string }> {
  const entries: Array<{ from: string; to: string }> = []
  const lines = readFileSync(path, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf('=')
    if (at <= 0 || at === line.length - 1) {
      console.error(`术语表第 ${i + 1} 行不是「原文=译文」格式: ${line}`)
      process.exit(1)
    }
    entries.push({ from: line.slice(0, at).trim(), to: line.slice(at + 1).trim() })
  }
  return entries
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  let input = ''
  let model = ''
  let language = 'auto'
  let outDir: string | undefined
  let format: ExportFormat = 'srt'
  let content: ExportContent = 'translated'
  let translate = false
  let engine: TranslationEngine = 'local'
  let llmModel = ''
  let target = 'zh'
  let apiBase = 'https://api.openai.com/v1'
  let apiModel = 'gpt-4o-mini'
  let subTrack: number | undefined
  let listTracks = false
  let cacheDir: string | undefined
  let refreshCache = false
  let glossaryFile = ''

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--sub-track') subTrack = Number(argv[++i]) - 1
    else if (arg === '--list-tracks') listTracks = true
    else if (arg === '--model') model = argv[++i] ?? ''
    else if (arg === '--language') language = argv[++i] ?? 'auto'
    else if (arg === '--out-dir') outDir = argv[++i]
    else if (arg === '--format') format = (argv[++i] ?? 'srt') as ExportFormat
    else if (arg === '--content') content = (argv[++i] ?? 'translated') as ExportContent
    else if (arg === '--translate') translate = true
    else if (arg === '--engine') engine = (argv[++i] ?? 'local') as TranslationEngine
    else if (arg === '--llm') llmModel = argv[++i] ?? ''
    else if (arg === '--target') target = argv[++i] ?? 'zh'
    else if (arg === '--api-base') apiBase = argv[++i] ?? apiBase
    else if (arg === '--api-model') apiModel = argv[++i] ?? apiModel
    else if (arg === '--cache-dir') cacheDir = argv[++i]
    else if (arg === '--refresh-cache') refreshCache = true
    else if (arg === '--glossary') glossaryFile = argv[++i] ?? ''
    else if (arg === '--help' || arg === '-h') usage()
    else if (!input) input = arg
    else usage()
  }
  if (!input) usage()
  const inputPath = resolve(input)

  if (listTracks) {
    const info = await probeMedia(ffprobePath(), inputPath)
    console.log(`时长 ${Math.round(info.durationSec)}s · ${info.format}`)
    info.audioStreams.forEach((s) =>
      console.log(
        `  音轨 ${s.audioIndex + 1}: ${s.codec} ${s.channels}ch ${s.language ?? ''} ${s.title ?? ''}`
      )
    )
    info.subtitleStreams.forEach((s) =>
      console.log(
        `  字幕轨 ${s.subtitleIndex + 1}: ${s.codec} ${s.language ?? ''} ${s.title ?? ''}` +
          `${s.forced ? ' [强制]' : ''}${s.hearingImpaired ? ' [听障]' : ''}` +
          `${s.textBased ? '' : ' [图形字幕，需 OCR]'}`
      )
    )
    return
  }

  const source: SubtitleSource = isSubtitleFile(inputPath)
    ? { kind: 'file' }
    : subTrack !== undefined
      ? { kind: 'embedded', subtitleIndex: subTrack }
      : { kind: 'asr' }
  const needsAsr = source.kind === 'asr'

  const modelsDir = join(process.cwd(), 'models')
  if (!needsAsr) {
    model = ''
  } else if (!model) {
    const models = await listWhisperModels(modelsDir)
    if (models.length === 0) {
      console.error(
        `models/ 下没有 Whisper 模型，先下载一个，例如:\n` +
          `  curl -L -o models/ggml-base.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin`
      )
      process.exit(1)
    }
    model = join(modelsDir, pickBestInstalled(models) ?? models[0])
  } else if (!isAbsolute(model) && !existsSync(model)) {
    model = join(modelsDir, model)
  }

  const llamaManager = new LlamaServerManager()
  let translateOpt:
    | { provider: TranslationProvider; targetLanguage: string; engineId: string }
    | undefined
  if (translate && engine === 'local') {
    const llmDir = join(modelsDir, 'llm')
    if (!llmModel) {
      const installed = await listLocalLlmModels(llmDir)
      const best = pickBestInstalledLlm(installed)
      if (!best) {
        console.error('models/llm 下没有翻译模型，请先下载一个 Qwen3 gguf')
        process.exit(1)
      }
      llmModel = join(llmDir, best)
    } else if (!isAbsolute(llmModel) && !existsSync(llmModel)) {
      llmModel = join(llmDir, llmModel)
    }
    translateOpt = {
      provider: new LocalLlamaProvider(llamaManager, llmModel, target),
      targetLanguage: target,
      engineId: `local|${basename(llmModel)}`
    }
  } else if (translate) {
    const apiKey = process.env.WAVESUBS_API_KEY
    if (!apiKey) {
      console.error('云端翻译需要设置环境变量 WAVESUBS_API_KEY')
      process.exit(1)
    }
    translateOpt = {
      provider: new OpenAICompatibleProvider({
        protocol: 'openai',
        baseUrl: apiBase,
        apiKey,
        model: apiModel,
        targetLanguage: target
      }),
      targetLanguage: target,
      engineId: `api|cli|${apiModel}`
    }
  }

  const vadPath = join(modelsDir, VAD_MODEL_FILE)
  try {
    const result = await runSubtitleJob({
      input: inputPath,
      modelPath: model || undefined,
      source,
      language: language === 'auto' ? undefined : language,
      vadModelPath: needsAsr && existsSync(vadPath) ? vadPath : undefined,
      outputDir: outDir ? resolve(outDir) : undefined,
      glossary: glossaryFile ? loadGlossaryFile(resolve(glossaryFile)) : undefined,
      cacheDir: cacheDir ? resolve(cacheDir) : undefined,
      refreshCache,
      translate: translateOpt,
      output: { format, content: translateOpt ? content : 'original' },
      onProgress: (p) => {
        // 命令行固定用英文，不跟界面语言走
        const note = p.messageKey ? cliT(p.messageKey) : ''
        process.stdout.write(
          `\r${p.stage.padEnd(10)} ${String(p.percent).padStart(3)}%  ${note}      `
        )
      }
    })
    const translatedNote =
      result.translatedCount !== undefined ? ` · 已翻译 ${result.translatedCount} 条` : ''
    const QC_KEY = {
      coverage: 'qc.finding.coverage', gap: 'qc.finding.gap', overlong: 'qc.finding.overlong',
      fastRate: 'qc.finding.fastRate', untranslated: 'qc.finding.untranslated',
      residual: 'qc.finding.residual', invalid: 'qc.finding.invalid'
    } as const
    if (result.qc.level !== 'good') {
      console.log(`\n[qc] ${cliT(result.qc.level === 'bad' ? 'qc.bad' : 'qc.warn')}`)
      for (const f of result.qc.findings) {
        const at = f.atSec !== undefined
          ? `${Math.floor(f.atSec / 60)}:${String(f.atSec % 60).padStart(2, '0')}`
          : ''
        console.log(`     - ${cliT(QC_KEY[f.kind], { n: f.n ?? 0, pct: f.pct ?? 0, at })}`)
      }
    }
    if (result.sourceFromCache) console.log('\n[cache] 识别/抽取结果来自缓存')
    if (result.translationReuse === 'all') console.log('[cache] 译文全部复用')
    else if (result.translationReuse === 'partial') {
      console.log(
        `[cache] 复用译文 ${result.translationReusedCount} 条，新翻 ${result.translationFreshCount} 条`
      )
    }
    console.log(
      `\n✓ 字幕已生成: ${result.outputPath}\n  语言: ${result.language}${translatedNote} · 共 ${result.cueCount} 条 · 视频时长 ${Math.round(result.durationSec)}s`
    )
  } finally {
    llamaManager.stop()
  }
}

main().catch((err: unknown) => {
  console.error('\n任务失败:', err instanceof Error ? err.message : err)
  process.exit(1)
})
