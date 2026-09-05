import type {
  ModelDownloadProgress,
  ModelInfo,
  ModelKind,
  ModelsOverview,
  SettingsView
} from '../../../shared/types'
import type { TranslationKey, Translate } from '../../../shared/i18n'
import type { ModelTab } from '../App'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'
import { CloudPane } from './CloudPane'
import { GlossaryPane } from './GlossaryPane'

interface Props {
  tab: ModelTab
  overview: ModelsOverview | null
  settings: SettingsView | null
  downloads: Record<string, ModelDownloadProgress>
  error: string | null
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

function sizeLabel(mb: number): string {
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
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
  kind: ModelKind
  dl?: ModelDownloadProgress
  t: Translate
  onDownload: Props['onDownload']
  onCancel: Props['onCancel']
  onDelete: Props['onDelete']
}): React.JSX.Element {
  const { model, kind, dl, t, onDownload, onCancel, onDelete } = props
  const fit = FITNESS[model.fitness]
  return (
    <div className={`model-row ${model.fitness === 'unfit' ? 'model-row-dim' : ''}`}>
      <div className="model-main">
        <div className="model-name">
          <strong>{model.name}</strong>
          <span className={`tag ${fit.tone}`}>{t(fit.key)}</span>
        </div>
        <p className="model-detail">{model.detail}</p>
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
            <div className="track" style={{ width: '100%' }}>
              <div className="track-fill" style={{ width: `${Math.max(0, dl.percent)}%` }} />
            </div>
            <div className="dl-foot">
              <span className="dl-label" dir="ltr">
                {dl.percent >= 0 ? `${dl.percent}% · ` : ''}
                {dl.receivedMB}
                {dl.totalMB > 0 ? ` / ${dl.totalMB}` : ''} MB
              </span>
              <button className="btn btn-quiet" onClick={() => onCancel(kind, model.file)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : model.installed ? (
          <>
            <span className="installed">
              <Icon name="check" size={12} />
              {t('models.installed')}
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

  if (!overview) return <p className="loading">{t('common.loadingModels')}</p>

  const list = tab === 'asr' ? overview.models : overview.llmModels
  const dir = tab === 'asr' ? overview.dir : overview.llmDir

  return (
    <div className="rise" key={tab}>
      {error && (
        <div className="notice notice-error">
          <Icon name="warning" />
          <p>{error}</p>
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
              {t('models.hardware', {
                chip: overview.hardware.chip,
                mem: overview.hardware.memGB
              })}
            </span>
          </div>

          <div className="card">
            {list.map((m) => (
              <ModelRow
                key={m.file}
                model={m}
                kind={tab === 'asr' ? 'asr' : 'llm'}
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
              {t('models.openFinder')}
            </button>
            <br />
            {t('models.manualHint', { pattern: tab === 'asr' ? 'ggml-*.bin' : '*.gguf' })}
          </p>
        </>
      )}
    </div>
  )
}
