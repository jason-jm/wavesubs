import { useState } from 'react'
import type { ModelFolderPlan, ModelsOverview } from '../../../shared/types'
import { useT } from '../i18n'
import { sizeLabel } from '../lib/models'
import { useModelWork } from './ModelWork'
import { Icon } from './Icon'

export const modelErrorText = (e: unknown): string => String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')

export function ModelFolder({ overview, onRefresh }: { overview: ModelsOverview; onRefresh: () => Promise<void> }): React.JSX.Element {
  const t = useT()
  const [plan, setPlan] = useState<ModelFolderPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const work = useModelWork()
  const { moving: move, progress } = work
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function choose(): Promise<void> {
    setBusy(true); setError(''); setMessage('')
    try { setPlan(await window.waveSubs.pickModelFolder()) }
    catch (e) { setError(modelErrorText(e)) }
    finally { setBusy(false) }
  }
  async function change(migrate: boolean): Promise<void> {
    if (!plan) return
    setBusy(true); setError('')
    if (migrate) work.start()
    try {
      const result = await window.waveSubs.changeModelFolder(plan.dir, migrate)
      await onRefresh()
      setPlan(null)
      if (result.retained) setMessage(t('library.retained', { n: result.retained }))
    } catch (e) { setError(modelErrorText(e)); await onRefresh() }
    finally { setBusy(false); if (migrate) work.finish() }
  }
  return (
    <section className="card library-folder" aria-label={t('library.folder')}>
      <div className="library-heading">
        <div><h3>{t('library.folder')}</h3><p className="library-path" dir="auto">{overview.dir}</p></div>
        <button className="btn" disabled={busy || move} onClick={choose}>{t('library.change')}</button>
      </div>
      {!overview.folderOnline && <p className="library-alert" role="status">{t('library.offline', { path: overview.dir })}</p>}
      {(plan || move) && <div className="library-plan">
        {plan && <p className="library-path"><b dir="ltr">→ </b><bdi>{plan.dir}</bdi></p>}
        {plan && <p>{t('library.plan', { n: plan.count, size: sizeLabel(Math.round(plan.bytes / 1048576)) })}</p>}
        {move && <div role="status" className="library-progress"><span>{progress?.file || t('common.loadingModels')}</span>
          <progress max={progress?.total || 1} value={progress?.done} /></div>}
        <div className="library-buttons">
          {move ? <button className="btn" onClick={() => void window.waveSubs.cancelModelMove()}>{t('common.cancel')}</button> : <>
            {plan?.sourceOnline && plan.count > 0 && <button className="btn btn-primary" disabled={busy} onClick={() => void change(true)}>{t('library.move')}</button>}
            <button className="btn" disabled={busy} onClick={() => void change(false)}>{t('library.switch')}</button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => { setPlan(null); setError('') }}>{t('common.cancel')}</button>
          </>}
        </div>
      </div>}
      {error && <p className="library-alert" role="alert"><Icon name="warning" size={14} /> {error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
