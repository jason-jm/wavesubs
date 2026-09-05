import { useEffect, useState } from 'react'
import type { GlossaryEntry, SettingsView } from '../../../shared/types'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'

interface Props {
  settings: SettingsView | null
  onSettingsChanged: (next: SettingsView) => void
}

/** 行内草稿：允许出现半填状态（只填了原文还没填译文），保存时才过滤掉残缺行 */
interface DraftRow {
  from: string
  to: string
}

/**
 * 术语表：把人名、地名、术语固定成指定译法。
 *
 * 生效范围是整条翻译管线——单文件和批量走的是同一个提示词构建器，所以两边
 * 自动都有。批量翻一季动画时角色名各集不一致，就是这里解决的。
 *
 * 保存时机取「行完成」而不是每击键：每敲一个字都写设置文件太吵，攒到失焦/增删
 * 再提交；主进程会做同样的清洗（去重、截断），以返回的清洗结果为准回填界面。
 */
export function GlossaryPane(props: Props): React.JSX.Element {
  const { settings, onSettingsChanged } = props
  const t = useT()
  const saved = settings?.translation.glossary ?? []
  const [rows, setRows] = useState<DraftRow[]>(saved)

  // 设置在别处变化（迁移、清洗回填）时同步草稿；正在编辑的半填行不受影响是可接受的取舍
  useEffect(() => {
    setRows(settings?.translation.glossary ?? [])
  }, [settings])

  const persist = (next: DraftRow[]): void => {
    setRows(next)
    const cleaned: GlossaryEntry[] = next
      .map((r) => ({ from: r.from.trim(), to: r.to.trim() }))
      .filter((r) => r.from && r.to)
    // 内容与已存的一致就不写盘——onBlur 每次都会触发，不做这个判断会连环写设置
    const same =
      cleaned.length === saved.length &&
      cleaned.every((r, i) => r.from === saved[i].from && r.to === saved[i].to)
    if (same) return
    void window.waveSubs
      .updateSettings({ translation: { glossary: cleaned } })
      .then(onSettingsChanged)
  }

  const update = (at: number, patch: Partial<DraftRow>): void => {
    setRows(rows.map((r, i) => (i === at ? { ...r, ...patch } : r)))
  }

  return (
    <div className="section rise">
      <div className="section-title">{t('tab.glossary')}</div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="queue-empty">{t('glossary.empty')}</p>
        ) : (
          rows.map((row, i) => (
            <div key={i} className="model-row glossary-row">
              <input
                className="input"
                value={row.from}
                placeholder={t('glossary.from')}
                onChange={(e) => update(i, { from: e.target.value })}
                onBlur={() => persist(rows)}
              />
              <span className="lang-arrow">→</span>
              <input
                className="input"
                value={row.to}
                placeholder={t('glossary.to')}
                onChange={(e) => update(i, { to: e.target.value })}
                onBlur={() => persist(rows)}
              />
              <button
                className="btn btn-quiet btn-danger"
                title={t('glossary.remove')}
                onClick={() => persist(rows.filter((_, j) => j !== i))}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="glossary-actions">
        <button className="btn" onClick={() => setRows([...rows, { from: '', to: '' }])}>
          <Icon name="plus" size={13} />
          {t('glossary.add')}
        </button>
      </div>
      <p className="section-note">
        {t('glossary.hint')}
        <br />
        {t('glossary.cacheHint')}
      </p>
    </div>
  )
}
