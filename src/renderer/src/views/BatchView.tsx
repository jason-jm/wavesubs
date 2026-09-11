import { useCallback, useEffect, useState } from 'react'
import type {
  BatchEntry,
  BatchOverride,
  ExportContent,
  ExportFormat,
  JobRequest,
  ModelsOverview,
  SettingsUpdate,
  SettingsView,
  SubtitleSource
} from '../../../shared/types'
import { useI18n } from '../i18n'
import type { Translate } from '../../../shared/i18n'
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, targetLanguageLabel } from '../lib/languages'
import { cacheNote } from '../lib/jobSummary'
import { QC_TAG, qcFindingText } from '../lib/qc'
import { pickDefaultSource } from '../lib/source'
import { audioTrackLabel, subtitleTrackLabel } from '../lib/trackLabels'
import { Icon } from '../components/Icon'
import { formatDuration } from '../lib/duration'
import { useStageEta } from '../lib/useStageEta'

interface Props {
  settings: SettingsView | null
  overview: ModelsOverview | null
  entries: BatchEntry[]
  running: boolean
  stopping: boolean
  onAdd: (paths: string[]) => number
  onRemove: (id: string) => void
  onClear: () => void
  /** 传 undefined 表示这一项恢复成完全跟随全局 */
  onOverride: (id: string, override: BatchOverride | undefined) => void
  onEdit: (path: string) => void
  onStart: (request: JobRequest) => void
  onStop: () => void
  /** 立刻取消正在跑的那个文件（退回等待），队列继续处理后面的 */
  onCancelCurrent: () => void
  updateSettings: (patch: SettingsUpdate) => Promise<void>
  goModels: () => void
}

function Select(props: {
  value: string
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

/** 「跟随全局」在下拉框里的取值。用空串而不是特殊字符串，省得和真实取值撞上 */
const FOLLOW = ''

/**
 * 这一项实际会用的字幕来源：单独指定过就用指定的，否则按探测结果自动挑。
 * 还没探测出来时返回 null——此时无从判断，界面上只说「读取中」。
 */
function effectiveSource(entry: BatchEntry): SubtitleSource | null {
  if (entry.override?.source) return entry.override.source
  return entry.info ? pickDefaultSource(entry.info) : null
}

/** 折叠状态下那行小字：不展开也能一眼看出这个文件会走识别还是走现成字幕轨 */
function sourceSummary(entry: BatchEntry, t: Translate): string | null {
  if (entry.probing) return t('batch.probing')
  if (!entry.info) return entry.probeError ? t('batch.probeFailed') : null
  if (entry.info.kind === 'subtitle') return null
  const src = effectiveSource(entry)
  if (!src) return null
  if (src.kind === 'asr') return t('home.source.asr')
  if (src.kind === 'embedded') {
    const track = entry.info.subtitleStreams.find((x) => x.subtitleIndex === src.subtitleIndex)
    return track ? subtitleTrackLabel(track, t) : null
  }
  return null
}

/**
 * 单个文件的个别设置面板。
 *
 * 每一项默认都是「跟随全局」，只有用户明确挑了别的才写进 override。
 * 所以之后改全局设置，没被单独指定的字段仍然会跟着变——这正是
 * 「大部分文件一个配置、个别文件另说」想要的行为。
 */
function EntryConfig(props: {
  entry: BatchEntry
  providers: SettingsView['translation']['providers']
  onChange: (o: BatchOverride | undefined) => void
  t: Translate
}): React.JSX.Element {
  const { locale } = useI18n()
  const { entry, providers, onChange, t } = props
  const o = entry.override ?? {}
  const info = entry.info

  const set = (patch: BatchOverride, drop: Array<keyof BatchOverride> = []): void => {
    const next: BatchOverride = { ...o, ...patch }
    for (const k of drop) delete next[k]
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }

  const src = effectiveSource(entry)
  const usingAsr = src?.kind === 'asr'
  const sourceValue = !o.source
    ? FOLLOW
    : o.source.kind === 'embedded'
      ? `sub:${o.source.subtitleIndex}`
      : o.source.kind === 'asr'
        ? 'asr'
        : FOLLOW

  // 不翻译时目标语言和服务都无从谈起，用 'none' 表示，和全局那边的写法保持一致
  const targetValue = o.translate === false ? 'none' : (o.targetLanguage ?? FOLLOW)
  const serviceValue = !o.engine ? FOLLOW : o.engine === 'local' ? 'local' : `api:${o.providerId ?? ''}`

  const followOption = <option value={FOLLOW}>{t('batch.perFile.follow')}</option>

  return (
    <div className="row-editing">
      {info?.kind === 'video' && (
        <div className="row">
          <div className="row-label">
            <strong>{t('home.source')}</strong>
            <span>{t('home.source.hint')}</span>
          </div>
          <div className="row-control">
            <Select
              value={sourceValue}
              wide
              onChange={(v) => {
                if (v === FOLLOW) set({}, ['source', 'audioIndex'])
                else if (v === 'asr') set({ source: { kind: 'asr' } })
                else set({ source: { kind: 'embedded', subtitleIndex: Number(v.slice(4)) } }, ['audioIndex'])
              }}
            >
              <option value={FOLLOW}>{t('batch.source.auto')}</option>
              <option value="asr">{t('home.source.asr')}</option>
              {info.subtitleStreams.map((x) => (
                <option key={x.subtitleIndex} value={`sub:${x.subtitleIndex}`} disabled={!x.textBased}>
                  {subtitleTrackLabel(x, t)}
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
            <Select
              value={o.audioIndex === undefined ? FOLLOW : String(o.audioIndex)}
              wide
              onChange={(v) => (v === FOLLOW ? set({}, ['audioIndex']) : set({ audioIndex: Number(v) }))}
            >
              {followOption}
              {info.audioStreams.map((x) => (
                <option key={x.audioIndex} value={x.audioIndex}>
                  {audioTrackLabel(x, t)}
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
          <Select
            value={o.language ?? FOLLOW}
            onChange={(v) => (v === FOLLOW ? set({}, ['language']) : set({ language: v }))}
          >
            {followOption}
            {SOURCE_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.key)}
              </option>
            ))}
          </Select>
          <span className="lang-arrow">→</span>
          <Select
            value={targetValue}
            onChange={(v) => {
              if (v === FOLLOW) set({}, ['translate', 'targetLanguage', 'content'])
              else if (v === 'none') set({ translate: false }, ['targetLanguage'])
              else set({ translate: true, targetLanguage: v })
            }}
          >
            {followOption}
            {TARGET_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {targetLanguageLabel(l.value, locale, t)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {o.translate !== false && (
        <div className="row">
          <div className="row-label">
            <strong>{t('home.service')}</strong>
            <span>{t('home.service.hint')}</span>
          </div>
          <div className="row-control">
            <Select
              value={serviceValue}
              wide
              onChange={(v) => {
                if (v === FOLLOW) set({}, ['engine', 'providerId'])
                else if (v === 'local') set({ engine: 'local' }, ['providerId'])
                else set({ engine: 'api', providerId: v.slice(4) })
              }}
            >
              {followOption}
              <optgroup label={t('home.service.localGroup')}>
                <option value="local">{t('home.service.localModel')}</option>
              </optgroup>
              {providers.length > 0 && (
                <optgroup label={t('home.service.cloudGroup')}>
                  {providers.map((x) => (
                    <option key={x.id} value={`api:${x.id}`}>
                      {x.name}
                      {x.hasApiKey ? '' : t('home.service.missingKey')}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>
        </div>
      )}

      {o.translate !== false && (
        <div className="row">
          <div className="row-label">
            <strong>{t('home.content')}</strong>
          </div>
          <div className="row-control">
            <Select
              value={o.content ?? FOLLOW}
              onChange={(v) =>
                v === FOLLOW ? set({}, ['content']) : set({ content: v as ExportContent })
              }
            >
              {followOption}
              <option value="translated">{t('home.content.translated')}</option>
              <option value="bilingual">{t('home.content.bilingual')}</option>
            </Select>
          </div>
        </div>
      )}

      <div className="row">
        <div className="row-label">
          <strong>{t('home.format')}</strong>
        </div>
        <div className="row-control">
          <Select
            value={o.format ?? FOLLOW}
            onChange={(v) => (v === FOLLOW ? set({}, ['format']) : set({ format: v as ExportFormat }))}
          >
            {followOption}
            <option value="srt">SRT</option>
            <option value="ass">ASS</option>
          </Select>
        </div>
      </div>

      {entry.override && (
        <div className="row">
          <span className="spacer" />
          <button className="btn btn-quiet link-btn" onClick={() => onChange(undefined)}>
            {t('batch.perFile.reset')}
          </button>
        </div>
      )}
    </div>
  )
}

export function BatchView(props: Props): React.JSX.Element {
  const { settings, overview, entries, running, stopping, onAdd, onRemove, onClear } = props
  const { onOverride, onEdit, onStart, onStop, onCancelCurrent, updateSettings, goModels } = props
  const { t, locale } = useI18n()

  const [dragOver, setDragOver] = useState(false)
  const [skipped, setSkipped] = useState(0)
  /** 同时只展开一项：一次调一个文件，展开一片反而找不到自己在改哪个 */
  const [openId, setOpenId] = useState<string | null>(null)
  const [sourceLang, setSourceLang] = useState('auto')
  const [targetLang, setTargetLang] = useState('zh')
  /** 'local' 或 'api:<服务 id>'，和单文件页保持一致 */
  const [service, setService] = useState('local')
  const [content, setContent] = useState<ExportContent>('translated')
  const [format, setFormat] = useState<ExportFormat>('srt')
  const runningEntry = entries.find((e) => e.status === 'running')
  const eta = useStageEta(runningEntry?.progress ?? null)

  // 首次拿到设置时，用上次用过的偏好填一遍
  useEffect(() => {
    if (!settings) return
    setTargetLang(settings.translateEnabled ? settings.translation.targetLanguage : 'none')
    const active = settings.translation.activeProviderId
    setService(settings.translation.engine === 'api' && active ? `api:${active}` : 'local')
    setContent(settings.export.content === 'original' ? 'translated' : settings.export.content)
    setFormat(settings.export.format)
  }, [settings])

  const translating = targetLang !== 'none'
  const providers = settings?.translation.providers ?? []
  const useLocal = service === 'local'
  const providerId = useLocal ? undefined : service.slice(4)
  const activeProvider = providers.find((p) => p.id === providerId)
  const installedLlm = overview?.llmModels.filter((m) => m.installed) ?? []

  const needApiKey =
    translating && !useLocal && activeProvider !== undefined && !activeProvider.hasApiKey
  const needLlmModel = translating && useLocal && overview !== null && installedLlm.length === 0

  const add = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return
      setSkipped(onAdd(paths))
    },
    [onAdd]
  )

  const pick = useCallback(async () => {
    add(await window.waveSubs.pickVideos())
  }, [add])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      add(Array.from(event.dataTransfer.files).map((f) => window.waveSubs.pathForFile(f)))
    },
    [add]
  )

  const start = useCallback(() => {
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
    onStart({
      language: sourceLang,
      translate: translating,
      targetLanguage: translating ? targetLang : undefined,
      engine: translating ? (useLocal ? 'local' : 'api') : undefined,
      providerId: translating && !useLocal ? providerId : undefined,
      format,
      content: translating ? content : 'original'
    })
  }, [
    translating, targetLang, useLocal, providerId, format, content, sourceLang,
    updateSettings, onStart
  ])

  const waiting = entries.filter((e) => e.status === 'waiting').length
  const done = entries.filter((e) => e.status === 'done').length
  const failed = entries.filter((e) => e.status === 'failed').length
  const blocked = needApiKey || needLlmModel

  return (
    <div
      className="rise batch-page"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      /* dragleave 会从每个子元素冒泡上来，光标在卡片之间移动就会灭一下。
         只有真正离开整个页面才熄灭高亮 */
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <div className="section">
        <div className="section-title">{t('batch.settings')}</div>
        <div className="card">
          <div className="row">
            <div className="row-label">
              <strong>{t('home.language')}</strong>
              <span>{t('home.language.hintAsr')}</span>
            </div>
            <div className="row-control lang-flow">
              <Select value={sourceLang} onChange={setSourceLang} disabled={running}>
                {SOURCE_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {t(l.key)}
                  </option>
                ))}
              </Select>
              <span className="lang-arrow">→</span>
              <Select value={targetLang} onChange={setTargetLang} disabled={running}>
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {targetLanguageLabel(l.value, locale, t)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {translating && (
            <div className="row">
              <div className="row-label">
                <strong>{t('home.service')}</strong>
                <span>{t('home.service.hint')}</span>
              </div>
              <div className="row-control">
                <Select value={service} onChange={setService} disabled={running} wide>
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
          )}

          {translating && (
            <div className="row">
              <div className="row-label">
                <strong>{t('home.content')}</strong>
              </div>
              <div className="row-control">
                <div className="segmented">
                  <button
                    className={content === 'translated' ? 'segmented-on' : ''}
                    disabled={running}
                    onClick={() => setContent('translated')}
                  >
                    {t('home.content.translated')}
                  </button>
                  <button
                    className={content === 'bilingual' ? 'segmented-on' : ''}
                    disabled={running}
                    onClick={() => setContent('bilingual')}
                  >
                    {t('home.content.bilingual')}
                  </button>
                </div>
              </div>
            </div>
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
                  disabled={running}
                  onClick={() => setFormat('srt')}
                >
                  SRT
                </button>
                <button
                  className={format === 'ass' ? 'segmented-on' : ''}
                  disabled={running}
                  onClick={() => setFormat('ass')}
                >
                  ASS
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="section-note">
          {t('batch.settingsHint')}
          <br />
          {t('batch.sourceAuto')}
          <br />
          {t('batch.perFile.hint')}
        </p>
      </div>

      <div className="section">
        <div className="queue-head">
          <div className="section-title">
            {t('batch.queue')}
            {entries.length > 0 && <span className="subnav-count">{entries.length}</span>}
          </div>
          <div className="queue-actions">
            {entries.length > 0 && (
              <span className="queue-summary">
                {t('batch.summary', { done, failed, total: entries.length })}
                <button className="btn btn-quiet link-btn" onClick={onClear}>
                  {t('batch.clear')}
                </button>
              </span>
            )}
            <button className="btn" onClick={() => void pick()}>
              <Icon name="plus" size={13} />
              {t('batch.addFiles')}
            </button>
          </div>
        </div>

        {skipped > 0 && <p className="section-note">{t('batch.duplicates', { n: skipped })}</p>}

        {/* 拖放区没了，但整页仍然接收拖放——高亮卡片是唯一的落点提示 */}
        <div className={`card queue-card ${dragOver ? 'card-dropping' : ''}`}>
          {entries.length === 0 ? (
            <p className="queue-empty">{t('batch.empty')}</p>
          ) : (
            entries.map((e) => {
              const open = openId === e.id
              const summary = sourceSummary(e, t)
              return (
                <div
                  key={e.id}
                  className={`model-row model-row-stack queue-row queue-${e.status} ${
                    open ? 'model-row-open' : ''
                  }`}
                >
                  <div className="model-row-head">
                    <div className="model-main">
                      <div className="model-name">
                        <strong>{e.name}</strong>
                        {e.status === 'waiting' && (
                          <span className="tag tag-quiet">{t('batch.status.waiting')}</span>
                        )}
                        {e.status === 'done' && (
                          <span className="tag tag-green">{t('batch.status.done')}</span>
                        )}
                        {/* 质检只在有话要说时占位：全绿的批量列表刷一排「通过」是噪音 */}
                        {e.status === 'done' && e.result?.qc && e.result.qc.level !== 'good' && (
                          <span className={`tag ${QC_TAG[e.result.qc.level].tone}`}>
                            {t(QC_TAG[e.result.qc.level].key)}
                          </span>
                        )}
                        {e.status === 'failed' && (
                          <span className="tag tag-red">{t('batch.status.failed')}</span>
                        )}
                        {e.override && (
                          <span className="tag tag-orange">{t('batch.perFile.tag')}</span>
                        )}
                      </div>

                      {/* 折叠时也报一下这个文件会走哪条路，省得开跑了才发现走错 */}
                      {e.status === 'waiting' && summary && (
                        <div className="model-meta">
                          <span>{summary}</span>
                        </div>
                      )}

                      {e.status === 'running' && e.progress && (
                        <>
                          <div className="track queue-track">
                            <div
                              className="track-fill"
                              style={{ width: `${e.progress.percent}%` }}
                            />
                          </div>
                          <div className="model-meta">
                            <span>
                              {t(e.progress.messageKey ?? `stage.${e.progress.stage}`)} ·{' '}
                              {e.progress.percent}%
                              {eta !== null && ` · ${t('job.eta', { time: formatDuration(eta) })}`}
                            </span>
                          </div>
                        </>
                      )}

                      {e.status === 'done' && e.result && (
                        <p className="model-detail">
                          {t('file.cueCount', { n: e.result.cueCount })}
                          {e.result.translated &&
                            t('home.result.translated', {
                              n: e.result.translatedCount ?? e.result.cueCount
                            })}
                          {cacheNote(e.result, t) && ` · ${cacheNote(e.result, t)}`}
                          {e.result.qc && e.result.qc.findings.length > 0 &&
                            ` · ${qcFindingText(e.result.qc.findings[0], t)}`}
                        </p>
                      )}

                      {e.status === 'failed' && e.error && (
                        <p className="model-detail queue-error">{e.error}</p>
                      )}
                    </div>

                    <div className="model-side">
                      {/* 只有还没轮到的才让调——正在跑或跑完了再改也没用 */}
                      {e.status === 'waiting' && (
                        <button
                          className={open ? 'btn btn-on' : 'btn'}
                          onClick={() => setOpenId(open ? null : e.id)}
                        >
                          {t('batch.perFile')}
                        </button>
                      )}
                      {e.status === 'done' && e.result && (
                        <>
                          <button
                            className="btn"
                            title={t('editor.open')}
                            onClick={() => onEdit(e.path)}
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="btn"
                            onClick={() => window.waveSubs.revealInFinder(e.result!.outputPath)}
                          >
                            <Icon name="reveal" size={14} />
                          </button>
                        </>
                      )}
                      {e.status === 'running' && (
                        <button className="btn btn-quiet" onClick={onCancelCurrent}>
                          {t('common.cancel')}
                        </button>
                      )}
                      {e.status !== 'running' && (
                        <button
                          className="btn btn-quiet btn-danger"
                          title={t('batch.remove')}
                          onClick={() => onRemove(e.id)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {open && e.status === 'waiting' && (
                    <EntryConfig
                      entry={e}
                      providers={providers}
                      t={t}
                      onChange={(next) => onOverride(e.id, next)}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {needApiKey && (
        <div className="notice notice-warn">
          <Icon name="warning" />
          <p>{t('home.notice.needKey', { name: activeProvider?.name ?? '' })}</p>
          <button className="btn" onClick={goModels}>
            {t('home.notice.goConfigure')}
          </button>
        </div>
      )}
      {needLlmModel && (
        <div className="notice notice-warn">
          <Icon name="warning" />
          <p>{t('home.notice.needLlm')}</p>
          <button className="btn" onClick={goModels}>
            {t('home.notice.goDownload')}
          </button>
        </div>
      )}

      <div className="job-actions">
        <span className="spacer" />
        {running ? (
          <button className="btn btn-lg" disabled={stopping} onClick={onStop}>
            {stopping ? t('batch.stopping') : t('batch.stop')}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-lg"
            disabled={waiting === 0 || blocked}
            onClick={start}
          >
            {t('batch.start')}
          </button>
        )}
      </div>
    </div>
  )
}
