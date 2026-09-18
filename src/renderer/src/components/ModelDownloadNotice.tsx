import type { ModelDownloadProgress, ModelInfo, ModelKind } from '../../../shared/types'
import type { ModelError } from '../App'
import { useI18n } from '../i18n'
import { recommendModel, sizeLabel } from '../lib/models'
import { Icon } from './Icon'

interface Props {
  kind: ModelKind
  models: ModelInfo[]
  downloads: Record<string, ModelDownloadProgress>
  error: ModelError | null
  onDownload: (kind: ModelKind, file: string) => void
  onCancel: (kind: ModelKind, file: string) => void
  goModels: () => void
}

/**
 * 一个模型都没有时，就地把推荐的那个下下来：文件留在原地，下完直接开始。
 * 之前是一条「去下载」跳到模型页——回来时拖进来的文件已经没了，得再拖一遍，
 * 而且模型页一屏五六个模型，第一次用的人不知道该点哪个。
 * 推荐哪个由 recommendModel 按这台机器定；想换别的仍可去模型页。
 */
export function ModelDownloadNotice(props: Props): React.JSX.Element {
  const { t } = useI18n()
  const { kind, models, downloads, error, onDownload, onCancel, goModels } = props

  // 正在下的那个（不一定是我们推荐的：用户可能已经在模型页点了别的）
  const active = models.find((m) => downloads[m.file])
  if (active) {
    const dl = downloads[active.file]
    return (
      <div className="notice notice-warn">
        <Icon name="download" />
        <div className="notice-body">
          <p>{t('home.needModel.downloading', { name: active.name })}</p>
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
              <button className="btn btn-quiet" onClick={() => onCancel(kind, active.file)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const pick = recommendModel(models)
  const failed = error !== null && error.kind === kind
  // 刚才下载失败、或者这台机器一个都跑不动：去模型页，那里列着能手动下载的地址
  if (failed || !pick) {
    return (
      <div className={failed ? 'notice notice-error' : 'notice notice-warn'}>
        <Icon name="warning" />
        <p>{failed ? error.message : t(kind === 'asr' ? 'home.notice.needAsr' : 'home.notice.needLlm')}</p>
        <button className="btn" onClick={goModels}>
          {t('home.notice.goDownload')}
        </button>
      </div>
    )
  }

  return (
    <div className="notice notice-warn">
      <Icon name="warning" />
      <p>{t(kind === 'asr' ? 'home.needModel.asr' : 'home.needModel.llm', { name: pick.name, size: sizeLabel(pick.sizeMB) })}</p>
      <button className="btn btn-quiet" onClick={goModels}>
        {t('home.needModel.other')}
      </button>
      <button className="btn btn-primary" onClick={() => onDownload(kind, pick.file)}>
        <Icon name="download" size={14} />
        {t('home.needModel.download')}
      </button>
    </div>
  )
}
