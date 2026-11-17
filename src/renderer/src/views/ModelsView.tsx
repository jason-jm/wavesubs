import type {
  ModelDownloadProgress,
  ModelInfo,
  ModelKind,
  ModelsOverview,
  SettingsView
} from '../../../shared/types'
import { ModelFolder, modelErrorText } from '../components/ModelFolder'
import { sizeLabel } from '../lib/models'
import type { TranslationKey, Translate } from '../../../shared/i18n'
import { useState } from 'react'
import type { ModelError, ModelTab } from '../App'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { CloudPane } from './CloudPane'
import { GlossaryPane } from './GlossaryPane'

interface Props {
  onRefresh: () => Promise<void>
  tab: ModelTab
  overview: ModelsOverview | null
  settings: SettingsView | null
  downloads: Record<string, ModelDownloadProgress>
  error: ModelError | null
  onDownload: (kind: ModelKind, file: string) => void
  onCancel: (kind: ModelKind, file: string) => void
  onDelete: (kind: ModelKind, file: string) => void
  onSettingsChanged: (next: SettingsView) => void
}

/** 直接说这台机器跑不跑得动，不用「推荐」这种带主观倾向的词 */
const FITNESS: Record<ModelInfo['fitness'], { key: TranslationKey; tone: string }> = {
  great: { key: 'models.fitness.fit', tone: 'tag-green' },
  ok: { key: 'models.fitness.fit', tone: 'tag-green' },
  slow: { key: 'models.fitness.slow', tone: 'tag-orange' },
  unfit: { key: 'models.fitness.unfit', tone: 'tag-red' }
}

/**
 * 「按语言选模型」：目录里各模型带三组语言的意思保留率（见 catalog.ts 的实测说明），
 * 这里只负责把百分比翻成一眼能读的档位。阈值取自实测分布：Turbo 三种语言都在 85 以上，
 * Small 的英语 92、德语 81、日语 66，Tiny 的日语 37——四档正好把它们分开。
 */
type LangGroup = 'en' | 'eu' | 'ea'
const LANG_GROUPS: LangGroup[] = ['en', 'eu', 'ea']
const LANG_LABEL: Record<LangGroup, TranslationKey> = {
  en: 'models.lang.en',
  eu: 'models.lang.eu',
  ea: 'models.lang.ea'
}
function langLevel(percent: number): { key: TranslationKey; tone: string } {
  if (percent >= 85) return { key: 'models.lang.great', tone: 'tag-green' }
  if (percent >= 75) return { key: 'models.lang.ok', tone: 'tag-accent' }
  if (percent >= 60) return { key: 'models.lang.weak', tone: 'tag-orange' }
  return { key: 'models.lang.bad', tone: 'tag-red' }
}

function Meter({ value }: { value: number }): React.JSX.Element {
  return (
    <span className="meter">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= Math.round(value) ? 'on' : ''} />
      ))}
    </span>
  )
}

function ModelRow(props: {
  model: ModelInfo
  selected: boolean
  busy: boolean
  use: () => void
  relink: () => void
  forget: () => void
  kind: ModelKind
  dl?: ModelDownloadProgress
  t: Translate
  onDownload: Props['onDownload']
  onCancel: Props['onCancel']
  onDelete: Props['onDelete']
}): React.JSX.Element {
  const { model, kind, dl, t, onDownload, onCancel, onDelete } = props
  if (model.local) {
    const { origin, status, path } = model.local
    return (
      <div className="model-row model-local">
        <div className="model-main">
          <div className="model-name"><strong dir="auto">{model.name}</strong>
            <span className={status === 'ready' ? 'tag tag-green' : 'tag tag-orange'}>{t(status === 'ready' ? (props.selected ? 'library.current' : 'models.installed') : status === 'missing' ? 'library.missing' : 'library.verify')}</span>
          </div>
          <p className="model-detail library-path" dir="auto">{path}</p>
          <div className="model-meta">{t(origin === 'external' ? 'library.linked' : 'library.folder')} · {sizeLabel(model.sizeMB)}</div>
        </div>
        <div className="model-side library-buttons">
          {status !== 'missing' && (!props.selected || status !== 'ready') && <button className="btn" disabled={props.busy} onClick={props.use}>{t(status === 'verify' ? 'library.testUse' : 'library.use')}</button>}
          {origin === 'external' && <>
            {status === 'missing' && <button className="btn" disabled={props.busy} onClick={props.relink}>{t('library.relink')}</button>}
            <button className="btn btn-quiet" disabled={props.busy} onClick={props.forget}>{t('library.forget')}</button>
          </>}
          {model.local.canDelete && <button className="btn btn-quiet" disabled={props.busy}
            onClick={() => onDelete(kind, model.file)}>{t('models.deleteTitle')}</button>}
        </div>
      </div>
    )
  }
  const fit = FITNESS[model.fitness]
  return (
    <div className={`model-row ${model.fitness === 'unfit' ? 'model-row-dim' : ''}`}>
      <div className="model-main">
        <div className="model-name">
          <strong>{model.name}</strong>
          <span className={`tag ${fit.tone}`}>{t(fit.key)}</span>
        </div>
        <p className="model-detail">{model.detail}</p>
        {model.languages && (
          <div className="model-langs" title={t('models.lang.legend')}>
            {LANG_GROUPS.map((g) => {
              const percent = model.languages![g]
              const level = langLevel(percent)
              return (
                <span key={g} className={`tag ${level.tone}`}>
                  {t(LANG_LABEL[g])} <b dir="ltr">{percent}%</b> · {t(level.key)}
                </span>
              )
            })}
          </div>
        )}
        <div className="model-meta">
          {/* 数字+单位在 RTL 下会被 bidi 反转，锁成 ltr */}
          <span dir="ltr">{sizeLabel(model.sizeMB)}</span>
          <span>
            {kind === 'asr' ? t('models.accuracy') : t('models.quality')}{' '}
            <Meter value={model.quality} />
          </span>
          <span>
            {t('models.speed')} <Meter value={model.speed} />
          </span>
          <span>{model.requirement}</span>
        </div>
      </div>

      <div className="model-side">
        {dl ? (
          <div className="dl-wrap">
            <div className={dl.phase === 'connecting' ? 'track indeterminate' : 'track'} style={{ width: '100%' }}>
              <div
                className="track-fill"
                style={{ width: dl.phase === 'connecting' ? '40%' : `${Math.max(0, dl.percent)}%` }}
              />
            </div>
            <div className="dl-foot">
              {dl.phase === 'connecting' ? (
                <span className="dl-label">{t('models.connecting')}</span>
              ) : (
                <span className="dl-label" dir="ltr">
                  {dl.percent >= 0 ? `${dl.percent}% · ` : ''}
                  {dl.receivedMB}
                  {dl.totalMB > 0 ? ` / ${dl.totalMB}` : ''} MB
                </span>
              )}
              <button className="btn btn-quiet" onClick={() => onCancel(kind, model.file)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : model.installed ? (
          <>
            {!props.selected && <button className="btn btn-quiet" disabled={props.busy} onClick={props.use}>{t('library.use')}</button>}
            <span className="installed">
              <Icon name="check" size={12} />
              {t(props.selected ? 'library.current' : 'models.installed')}
            </span>
            <button
              className="btn btn-quiet btn-danger"
              title={t('models.deleteTitle')}
              onClick={() => onDelete(kind, model.file)}
            >
              <Icon name="trash" size={14} />
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary"
            disabled={model.fitness === 'unfit'}
            onClick={() => onDownload(kind, model.file)}
          >
            <Icon name="download" size={14} />
            <span dir="ltr">{sizeLabel(model.sizeMB)}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function ModelsView(props: Props): React.JSX.Element {
  const { tab, overview, settings, downloads, error, onDownload, onCancel, onDelete } = props
  const t = useT()
  const [copied, setCopied] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [workLabel, setWorkLabel] = useState('')
  async function act(action: () => Promise<unknown>, label = ''): Promise<void> {
    setBusy(true); setLocalError(''); setWorkLabel(label)
    try { await action(); await props.onRefresh() } catch (e) { setLocalError(modelErrorText(e)) }
    finally { setBusy(false); setWorkLabel('') }
  }

  if (!overview) return <p className="loading">{t('common.loadingModels')}</p>

  const list = tab === 'asr' ? overview.models : overview.llmModels
  const dir = tab === 'asr' ? overview.dir : overview.llmDir
  // 下载失败时把这个模型的全部来源地址列出来：程序连不上的，用户的浏览器或
  // 下载工具（走系统代理、能断点续传）往往能下，下完放进模型文件夹就能用
  const failed = error
    ? [...overview.models, ...overview.llmModels].find((m) => m.file === error.file)
    : undefined
  const failedDir = error?.kind === 'asr' ? overview.dir : overview.llmDir
  // Windows 上没有访达，硬件那一行也不该叫「这台 Mac」
  const isMac = overview.hardware.platform === 'darwin'
  const copy = (url: string): void => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(url)
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500)
    })
  }

  return (
    <div className="rise" key={tab}>
      {error && (
        <div className="notice notice-error">
          <Icon name="warning" />
          <div className="notice-body">
            <p>{error.message}</p>
            {failed && failed.downloadUrls.length > 0 && (
              <>
                <p>{t('models.manualDownload')}</p>
                <ul className="url-list">
                  {failed.downloadUrls.map((u) => (
                    <li key={u}>
                      <code>{u}</code>
                      <button className="btn" onClick={() => copy(u)}>
                        {copied === u ? t('common.copied') : t('common.copyLink')}
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="btn" onClick={() => window.waveSubs.openPath(failedDir)}>
                  {t(isMac ? 'models.openFinder' : 'models.openExplorer')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'glossary' ? (
        <GlossaryPane settings={settings} onSettingsChanged={props.onSettingsChanged} />
      ) : tab === 'cloud' ? (
        <CloudPane settings={settings} onChanged={props.onSettingsChanged} />
      ) : (
        <>
          <div className="hw-strip">
            <Icon name="mac" />
            <span>
              {t(isMac ? 'models.hardware' : 'models.hardwarePc', {
                chip: overview.hardware.chip,
                mem: overview.hardware.memGB
              })}
            </span>
          </div>

          <ModelFolder overview={overview} onRefresh={props.onRefresh} />
          <div className="library-toolbar">
            <button className="btn btn-primary" disabled={busy} onClick={() => void act(() => window.waveSubs.linkModel(tab), t('library.testing'))}><Icon name="plus" size={14} />{t('library.add')}</button>
            <button className="btn" disabled={busy} onClick={() => void act(props.onRefresh)}>{t('library.refresh')}</button>
            <span>{workLabel || t('library.linkHint')}</span>
          </div>
          {localError && <div className="notice notice-error" role="alert"><Icon name="warning" /><p>{localError}</p></div>}
          {tab === 'asr' && (
            <p className="models-lang-guide">
              {t('models.lang.guide')}
              <br />
              {t('models.lang.legend')}
            </p>
          )}

          <div className="card">
            {list.map((m) => (
              <ModelRow
                key={m.file}
                model={m}
                kind={tab === 'asr' ? 'asr' : 'llm'}
                selected={m.file === (tab === 'asr' ? overview.selected : overview.llmSelected)}
                busy={busy}
                use={() => void act(() => m.local?.status === 'verify' ? window.waveSubs.verifyModel(tab, m.file) : window.waveSubs.selectModel(tab, m.file), m.local?.status === 'verify' ? t('library.testing') : '')}
                relink={() => void act(() => window.waveSubs.linkModel(tab, m.file), t('library.testing'))}
                forget={() => void act(() => window.waveSubs.forgetModel(tab, m.file))}
                dl={downloads[m.file]}
                t={t}
                onDownload={onDownload}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            ))}
          </div>

          <p className="section-note">
            {t('models.location', { dir })}
            <button
              className="btn btn-quiet link-btn"
              onClick={() => window.waveSubs.openPath(dir)}
            >
              {t(isMac ? 'models.openFinder' : 'models.openExplorer')}
            </button>
            <br />
            {t('models.manualHint', { pattern: tab === 'asr' ? '*.bin' : '*.gguf' })}
          </p>
        </>
      )}
    </div>
  )
}
