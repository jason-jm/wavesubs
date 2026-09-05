import { useCallback, useState } from 'react'
import type {
  ExportContent,
  ExportFormat,
  JobRequest,
  MediaProbeInfo,
  ModelsOverview,
  PipelineStage,
  SettingsUpdate,
  SettingsView,
  SubtitleSource
} from '../../../shared/types'
import type { TranslationKey } from '../../../shared/i18n'
import type { JobState } from '../App'
import { useT, withNode } from '../i18n'
import { normalizeLanguageTag, SOURCE_LANGUAGES, TARGET_LANGUAGES } from '../lib/languages'
import { cacheNote } from '../lib/jobSummary'
import { QC_TAG, qcFindingText } from '../lib/qc'
import { fileNameOf } from '../lib/paths'
import { defaultSourceKey } from '../lib/source'
import { audioTrackLabel, subtitleTrackLabel } from '../lib/trackLabels'
import { Icon } from '../components/Icon'


const STAGE_ORDER: PipelineStage[] = ['probe', 'extract', 'transcribe', 'translate', 'write']
const STAGE_LABELS: Record<PipelineStage, TranslationKey> = {
  probe: 'stage.probe',
  extract: 'stage.extract',
  transcribe: 'stage.transcribe',
  translate: 'stage.translate',
  write: 'stage.write'
}


interface PendingFile {
  path: string
  info?: MediaProbeInfo
  probeError?: string
}

interface Props {
  settings: SettingsView | null
  overview: ModelsOverview | null
  jobState: JobState
  lastInput: string | null
  onEdit: (path: string) => void
  onRun: (input: string, request: JobRequest) => void
  updateSettings: (patch: SettingsUpdate) => Promise<void>
  onSelectModel: (file: string) => void
  onSelectLlm: (file: string) => void
  goModels: () => void
}

function formatDuration(sec: number): string {
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}


function Select(props: {
  value: string | number
  onChange: (v: string) => void
  disabled?: boolean
  wide?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span className={props.wide ? 'select select-wide' : 'select'}>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.children}
      </select>
    </span>
  )
}

export function HomeView(props: Props): React.JSX.Element {
  const { settings, overview, jobState, lastInput, onEdit, onRun, updateSettings } = props
  const { onSelectModel, onSelectLlm, goModels } = props
  const t = useT()
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<PendingFile | null>(null)
  const [sourceKey, setSourceKey] = useState('asr')
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh')
  /** 'local' 或 'api:<服务 id>' */
  const [service, setService] = useState('local')
  const [content, setContent] = useState<ExportContent>('translated')
  const [format, setFormat] = useState<ExportFormat>('srt')
  const [audioIndex, setAudioIndex] = useState(0)

  const busy = jobState.kind === 'running'
  const installedModels = overview?.models.filter((m) => m.installed) ?? []
  const installedLlm = overview?.llmModels.filter((m) => m.installed) ?? []
  const translating = targetLang !== 'none'
  const providers = settings?.translation.providers ?? []
  const useLocal = service === 'local'
  const providerId = useLocal ? undefined : service.slice(4)
  const activeProvider = providers.find((p) => p.id === providerId)
  const needApiKey = translating && !useLocal && activeProvider !== undefined && !activeProvider.hasApiKey
  const needLlmModel = translating && useLocal && overview !== null && installedLlm.length === 0
  const usingAsr = sourceKey === 'asr'
  const needAsrModel = usingAsr && overview !== null && installedModels.length === 0

  const acceptFile = useCallback(
    (path: string) => {
      if (settings) {
        setTargetLang(settings.translateEnabled ? settings.translation.targetLanguage : 'none')
        const active = settings.translation.activeProviderId
        setService(settings.translation.engine === 'api' && active ? `api:${active}` : 'local')
        setContent(settings.export.content === 'original' ? 'translated' : settings.export.content)
        setFormat(settings.export.format)
      }
      setSourceLang('auto')
      setSourceKey('asr')
      setAudioIndex(0)
      setPending({ path })
      window.waveSubs
        .probeMedia(path)
        .then((info) => {
          setPending((prev) => (prev?.path === path ? { ...prev, info } : prev))
          const key = defaultSourceKey(info)
          setSourceKey(key)
          if (key.startsWith('sub:')) {
            const idx = Number(key.slice(4))
            const track = info.subtitleStreams.find((s) => s.subtitleIndex === idx)
            setSourceLang(normalizeLanguageTag(track?.language))
          }
        })
        .catch((err: unknown) =>
          setPending((prev) =>
            prev?.path === path
              ? { ...prev, probeError: err instanceof Error ? err.message : String(err) }
              : prev
          )
        )
    },
    [settings]
  )

  const pickFile = useCallback(async () => {
    if (busy) return
    const path = await window.waveSubs.pickVideo()
    if (path) acceptFile(path)
  }, [busy, acceptFile])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      if (busy) return
      const file = event.dataTransfer.files[0]
      if (!file) return
      acceptFile(window.waveSubs.pathForFile(file))
    },
    [busy, acceptFile]
  )

  const changeSource = useCallback(
    (key: string) => {
      setSourceKey(key)
      if (key.startsWith('sub:') && pending?.info) {
        const idx = Number(key.slice(4))
        const track = pending.info.subtitleStreams.find((s) => s.subtitleIndex === idx)
        setSourceLang(normalizeLanguageTag(track?.language))
      }
    },
    [pending]
  )

  const start = useCallback(() => {
    if (!pending) return
    const source: SubtitleSource = sourceKey.startsWith('sub:')
      ? { kind: 'embedded', subtitleIndex: Number(sourceKey.slice(4)) }
      : sourceKey === 'file'
        ? { kind: 'file' }
        : { kind: 'asr' }
    void updateSettings({
      translateEnabled: translating,
      ...(translating
        ? {
            translation: {
              targetLanguage: targetLang,
              engine: useLocal ? ('local' as const) : ('api' as const),
              ...(providerId ? { activeProviderId: providerId } : {})
            }
          }
        : {}),
      export: { format, ...(translating ? { content } : {}) }
    })
    onRun(pending.path, {
      language: sourceLang,
      source,
      audioIndex,
      translate: translating,
      targetLanguage: translating ? targetLang : undefined,
      engine: translating ? (useLocal ? 'local' : 'api') : undefined,
      providerId: translating && !useLocal ? providerId : undefined,
      format,
      content: translating ? content : 'original'
    })
    setPending(null)
  }, [
    pending,
    sourceKey,
    translating,
    targetLang,
    useLocal,
    providerId,
    format,
    content,
    sourceLang,
    audioIndex,
    updateSettings,
    onRun
  ])

  const info = pending?.info
  const isSubtitleInput = info?.kind === 'subtitle'
  const fileName = pending ? fileNameOf(pending.path) : undefined

  const fileSummary = (): string => {
    if (pending?.probeError) return t('file.readFailed', { error: pending.probeError })
    if (!info) return t('file.reading')
    if (info.kind === 'subtitle') {
      const bits = [
        t('file.subtitleFormat', { format: info.format.toUpperCase() }),
        t('file.cueCount', { n: info.cueCount ?? 0 })
      ]
      if (info.durationSec > 0) {
        bits.push(t('file.span', { duration: formatDuration(info.durationSec) }))
      }
      if (info.encoding && info.encoding !== 'utf-8') {
        bits.push(t('file.encoding', { encoding: info.encoding }))
      }
      return bits.join(' · ')
    }
    const bits = [
      formatDuration(info.durationSec),
      info.format.split(',')[0].toUpperCase(),
      t('file.audioTracks', { n: info.audioStreams.length })
    ]
    if (info.subtitleStreams.length > 0) {
      const textCount = info.subtitleStreams.filter((s) => s.textBased).length
      bits.push(
        t('file.subtitleTracks', { n: info.subtitleStreams.length, usable: textCount })
      )
    }
    return bits.join(' · ')
  }

  /* ------------------------------ 运行中 ------------------------------ */
  if (busy) {
    const { progress, input } = jobState
    const nowIndex = STAGE_ORDER.indexOf(progress.stage)
    return (
      <div className="card progress-card rise">
        <div className="progress-head">
          <div style={{ minWidth: 0 }}>
            <div className="job-title">{fileNameOf(input)}</div>
            <div className="job-meta">{t(progress.messageKey ?? STAGE_LABELS[progress.stage])}</div>
          </div>
          <div className="progress-pct">{progress.percent}%</div>
        </div>
        <div className="track">
          <div className="track-fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="stages">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={`stage ${i === nowIndex ? 'stage-now' : ''} ${i < nowIndex ? 'stage-done' : ''}`}
            >
              {t(STAGE_LABELS[s])}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ------------------------------ 待确认 ------------------------------ */
  if (pending) {
    return (
      <div className="rise">
        <div className="card">
          <div className="job-head">
            <span className="job-glyph">
              <Icon name={isSubtitleInput ? 'caption' : 'video'} size={19} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="job-title">{fileName}</div>
              <div className="job-meta">{fileSummary()}</div>
            </div>
          </div>

          {info && info.kind === 'video' && (
            <div className="row">
              <div className="row-label">
                <strong>{t('home.source')}</strong>
                <span>{t('home.source.hint')}</span>
              </div>
              <div className="row-control">
                <Select value={sourceKey} onChange={changeSource} wide>
                  <option value="asr">{t('home.source.asr')}</option>
                  {info.subtitleStreams.map((s) => (
                    <option
                      key={s.subtitleIndex}
                      value={`sub:${s.subtitleIndex}`}
                      disabled={!s.textBased}
                    >
                      {subtitleTrackLabel(s, t)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {usingAsr && info && info.audioStreams.length > 1 && (
            <div className="row">
              <div className="row-label">
                <strong>{t('home.audioTrack')}</strong>
              </div>
              <div className="row-control">
                <Select value={audioIndex} onChange={(v) => setAudioIndex(Number(v))} wide>
                  {info.audioStreams.map((s) => (
                    <option key={s.audioIndex} value={s.audioIndex}>
                      {audioTrackLabel(s, t)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className="row">
            <div className="row-label">
              <strong>{t('home.language')}</strong>
              <span>{usingAsr ? t('home.language.hintAsr') : t('home.language.hintSub')}</span>
            </div>
            <div className="row-control lang-flow">
              <Select value={sourceLang} onChange={setSourceLang}>
                {SOURCE_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {t(l.key)}
                  </option>
                ))}
              </Select>
              <span className="lang-arrow">→</span>
              <Select value={targetLang} onChange={setTargetLang}>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {t(l.key)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {translating && (
            <>
              <div className="row">
                <div className="row-label">
                  <strong>{t('home.service')}</strong>
                  <span>{t('home.service.hint')}</span>
                </div>
                <div className="row-control">
                  <Select value={service} onChange={setService} wide>
                    <optgroup label={t('home.service.localGroup')}>
                      <option value="local">{t('home.service.localModel')}</option>
                    </optgroup>
                    {providers.length > 0 && (
                      <optgroup label={t('home.service.cloudGroup')}>
                        {providers.map((p) => (
                          <option key={p.id} value={`api:${p.id}`}>
                            {p.name}
                            {p.hasApiKey ? '' : t('home.service.missingKey')}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </div>
              </div>

              {useLocal && installedLlm.length > 0 && (
                <div className="row">
                  <div className="row-label">
                    <strong>{t('home.llmModel')}</strong>
                    <span>{t('home.llmModel.hint')}</span>
                  </div>
                  <div className="row-control">
                    <Select value={overview?.llmSelected ?? ''} onChange={onSelectLlm}>
                      {installedLlm.map((m) => (
                        <option key={m.file} value={m.file}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              <div className="row">
                <div className="row-label">
                  <strong>{t('home.content')}</strong>
                </div>
                <div className="row-control">
                  <div className="segmented">
                    <button
                      className={content === 'translated' ? 'segmented-on' : ''}
                      onClick={() => setContent('translated')}
                    >
                      {t('home.content.translated')}
                    </button>
                    <button
                      className={content === 'bilingual' ? 'segmented-on' : ''}
                      onClick={() => setContent('bilingual')}
                    >
                      {t('home.content.bilingual')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="row">
            <div className="row-label">
              <strong>{t('home.format')}</strong>
              <span>{format === 'srt' ? t('home.format.srtHint') : t('home.format.assHint')}</span>
            </div>
            <div className="row-control">
              <div className="segmented">
                <button
                  className={format === 'srt' ? 'segmented-on' : ''}
                  onClick={() => setFormat('srt')}
                >
                  SRT
                </button>
                <button
                  className={format === 'ass' ? 'segmented-on' : ''}
                  onClick={() => setFormat('ass')}
                >
                  ASS
                </button>
              </div>
            </div>
          </div>

          {usingAsr && (
            <div className="row">
              <div className="row-label">
                <strong>{t('home.asrModel')}</strong>
              </div>
              <div className="row-control">
                <Select
                  value={overview?.selected ?? ''}
                  onChange={onSelectModel}
                  disabled={installedModels.length === 0}
                >
                  {installedModels.map((m) => (
                    <option key={m.file} value={m.file}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className="job-actions">
            {/* 和「开始翻译」同高同形，只是不上色——macOS 对话框里取消就是这么配的。
                之前用 btn-quiet 是透明无阴影，看着像一行说明文字而不是按钮 */}
            <button className="btn btn-lg" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </button>
            <span className="spacer" />
            <button
              className="btn btn-primary btn-lg"
              disabled={Boolean(pending.probeError) || needAsrModel || needApiKey || needLlmModel}
              onClick={start}
            >
              {usingAsr ? t('home.start.asr') : translating ? t('home.start.translate') : t('home.start.convert')}
            </button>
          </div>
        </div>

        {needApiKey && (
          <div className="notice notice-warn" style={{ marginTop: 16 }}>
            <Icon name="warning" />
            <p>{t('home.notice.needKey', { name: activeProvider?.name ?? '' })}</p>
            <button className="btn" onClick={goModels}>
              {t('home.notice.goConfigure')}
            </button>
          </div>
        )}
        {needLlmModel && (
          <div className="notice notice-warn" style={{ marginTop: 16 }}>
            <Icon name="warning" />
            <p>{t('home.notice.needLlm')}</p>
            <button className="btn" onClick={goModels}>
              {t('home.notice.goDownload')}
            </button>
          </div>
        )}
        {needAsrModel && (
          <div className="notice notice-warn" style={{ marginTop: 16 }}>
            <Icon name="warning" />
            <p>{t('home.notice.needAsr')}</p>
            <button className="btn" onClick={goModels}>
              {t('home.notice.goDownload')}
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ------------------------------ 空态 ------------------------------ */
  return (
    <div
      className="home-empty"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div
        className={`dropzone ${dragOver ? 'dropzone-over' : ''}`}
        onClick={() => void pickFile()}
      >
        <span className="dropzone-glyph">
          <Icon name="drop" size={26} />
        </span>
        <h2>{t('home.drop.title')}</h2>
        <p>
          {withNode(t('home.drop.videoLine'), 'formats', <b>{t('home.drop.videoFormats')}</b>)}
          <br />
          {withNode(
            t('home.drop.subtitleLine'),
            'formats',
            <b>{t('home.drop.subtitleFormats')}</b>
          )}
        </p>
        <button className="btn">{t('home.drop.pick')}</button>
      </div>

      {jobState.kind === 'done' && (
        <div className="card result result-ok rise">
          <span className="result-glyph">
            <Icon name="check" size={17} />
          </span>
          <div className="result-body">
            <h3>
              {t('home.result.title', { n: jobState.result.cueCount })}
              {jobState.result.translated &&
                t('home.result.translated', {
                  n: jobState.result.translatedCount ?? jobState.result.cueCount
                })}
            </h3>
            <p className="result-path">{jobState.result.outputPath}</p>
            {cacheNote(jobState.result, t) && (
              <p className="result-cache">{cacheNote(jobState.result, t)}</p>
            )}
            {jobState.result.qc && (
              <div className="qc-line">
                <span className={`tag ${QC_TAG[jobState.result.qc.level].tone}`}>
                  {t(QC_TAG[jobState.result.qc.level].key)}
                </span>
                {jobState.result.qc.findings.map((f, i) => (
                  <span key={i} className="qc-finding">
                    {qcFindingText(f, t)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="result-actions">
            {lastInput && (
              <button className="btn" onClick={() => onEdit(lastInput)}>
                <Icon name="edit" size={14} />
                {t('editor.open')}
              </button>
            )}
            <button
              className="btn"
              onClick={() => window.waveSubs.revealInFinder(jobState.result.outputPath)}
            >
              <Icon name="reveal" size={14} />
              {t('home.result.reveal')}
            </button>
          </div>
        </div>
      )}

      {jobState.kind === 'error' && (
        <div className="card result result-fail rise">
          <span className="result-glyph">
            <Icon name="close" size={16} />
          </span>
          <div className="result-body">
            <h3>{t('home.result.failed')}</h3>
            <pre className="result-error-detail">{jobState.message}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
