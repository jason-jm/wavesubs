import { useEffect, useState } from 'react'
import type { AppInfo, Appearance, SettingsUpdate, SettingsView } from '../../../shared/types'
import { APP_STORE_REVIEW_URL, DISCUSSIONS_URL, feedbackUrl } from '../../../shared/feedback'
import type { TranslationKey } from '../../../shared/i18n'
import { AVAILABLE_LOCALES, localeMeta } from '../../../shared/i18n'
import { DEFAULT_THEME, PALETTES, type ThemeSetting } from '../../../shared/palettes'
import { gradientCss } from '../theme'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'

interface Props {
  settings: SettingsView | null
  updateSettings: (patch: SettingsUpdate) => Promise<void>
}

const APPEARANCES: Array<{ id: Appearance; labelKey: TranslationKey; hintKey: TranslationKey }> = [
  {
    id: 'system',
    labelKey: 'settings.appearance.system',
    hintKey: 'settings.appearance.systemHint'
  },
  { id: 'light', labelKey: 'settings.appearance.light', hintKey: 'settings.appearance.lightHint' },
  { id: 'dark', labelKey: 'settings.appearance.dark', hintKey: 'settings.appearance.darkHint' }
]

function MiniWindow({ tone }: { tone: 'light' | 'dark' }): React.JSX.Element {
  return (
    <span className={`ap-window ap-${tone}`}>
      <span className="ap-side" />
      <span className="ap-body">
        <span className="ap-bar" />
        <span className="ap-bar ap-bar-short" />
        <span className="ap-bar ap-bar-mid" />
      </span>
    </span>
  )
}

/** 迷你窗口示意图，和 macOS 系统设置里的外观选择器一个思路 */
function AppearancePreview({ mode }: { mode: Appearance }): React.JSX.Element {
  if (mode !== 'system') {
    return (
      <span className="ap-preview">
        <MiniWindow tone={mode} />
      </span>
    )
  }
  // 跟随系统：画两个完整的窗口叠起来，再把上层沿对角线裁掉一半。
  // 整窗一起裁，对角线才能连贯地穿过侧栏和横条
  return (
    <span className="ap-preview ap-split">
      <MiniWindow tone="light" />
      <MiniWindow tone="dark" />
    </span>
  )
}

/**
 * 渐变主题选择。
 *
 * 色板只画渐变本身、不写名字：颜色叫什么无所谓，用户要看的是"选完长这样"。
 * 这也免掉了给 32 种语言各翻十个色名。
 */
function ThemePicker({
  theme,
  updateSettings
}: {
  theme: ThemeSetting
  updateSettings: (patch: SettingsUpdate) => Promise<void>
}): React.JSX.Element {
  const t = useT()
  // 色板预览按当前系统明暗画，跟实际生效的那一组保持一致
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (): void => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const custom = theme.custom ?? { from: '#F6A5C0', to: '#7C6BE8', angle: 155 }
  const patchCustom = (p: Partial<typeof custom>): void => {
    void updateSettings({ theme: { paletteId: 'custom', custom: { ...custom, ...p } } })
  }

  return (
    <div className="section">
      <div className="section-title">{t('settings.theme')}</div>
      <div className="card">
        <div className="theme-grid">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className={`theme-swatch ${theme.paletteId === p.id ? 'theme-swatch-on' : ''}`}
              title={p.id}
              onClick={() => void updateSettings({ theme: { paletteId: p.id } })}
            >
              <i style={{ background: gradientCss({ ...theme, paletteId: p.id }, dark) }} />
            </button>
          ))}
          <button
            className={`theme-swatch theme-swatch-custom ${theme.paletteId === 'custom' ? 'theme-swatch-on' : ''}`}
            title={t('settings.theme.custom')}
            onClick={() => void updateSettings({ theme: { paletteId: 'custom', custom } })}
          >
            <i style={{ background: gradientCss({ ...theme, paletteId: 'custom', custom }, dark) }} />
          </button>
        </div>

        {theme.paletteId === 'custom' && (
          <div className="row">
            <div className="row-label">
              <strong>{t('settings.theme.custom')}</strong>
              <span>{t('settings.theme.customHint')}</span>
            </div>
            <div className="row-control theme-custom">
              <input
                type="color"
                className="theme-color"
                value={custom.from}
                onChange={(e) => patchCustom({ from: e.target.value })}
              />
              <input
                type="color"
                className="theme-color"
                value={custom.to}
                onChange={(e) => patchCustom({ to: e.target.value })}
              />
              <input
                type="range"
                className="theme-slider"
                min={0}
                max={360}
                step={5}
                value={custom.angle}
                onChange={(e) => patchCustom({ angle: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        <div className="row">
          <div className="row-label">
            <strong>{t('settings.theme.intensity')}</strong>
            <span>{t('settings.theme.intensityHint')}</span>
          </div>
          <div className="row-control theme-custom">
            <input
              type="range"
              className="theme-slider"
              min={0}
              max={1}
              step={0.05}
              value={theme.intensity}
              onChange={(e) => void updateSettings({ theme: { intensity: Number(e.target.value) } })}
            />
          </div>
        </div>

        <div className="row">
          <div className="row-label">
            <strong>{t('settings.theme.grain')}</strong>
            <span>{t('settings.theme.grainHint')}</span>
          </div>
          <div className="row-control theme-custom">
            <input
              type="range"
              className="theme-slider"
              min={0}
              max={1}
              step={0.05}
              value={theme.grain}
              onChange={(e) => void updateSettings({ theme: { grain: Number(e.target.value) } })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPage({ settings, updateSettings }: Props): React.JSX.Element {
  const t = useT()
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.waveSubs.appInfo().then(setInfo)
  }, [])
  if (!settings) return <p className="loading">{t('common.loadingSettings')}</p>

  const systemName = localeMeta(settings.systemLanguage).native

  return (
    <div className="rise">
      <div className="section">
        <div className="section-title">{t('settings.appearance')}</div>
        <div className="card">
          <div className="appearance-row">
            {APPEARANCES.map((a) => (
              <button
                key={a.id}
                className={`appearance-card ${settings.appearance === a.id ? 'appearance-on' : ''}`}
                onClick={() => void updateSettings({ appearance: a.id })}
              >
                <AppearancePreview mode={a.id} />
                <span className="appearance-label">
                  {t(a.labelKey)}
                  {settings.appearance === a.id && <Icon name="check" size={11} />}
                </span>
                <span className="appearance-hint">{t(a.hintKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ThemePicker theme={settings.theme ?? DEFAULT_THEME} updateSettings={updateSettings} />

      <div className="section">
        <div className="section-title">{t('settings.language')}</div>
        <div className="card">
          <div className="row">
            <div className="row-label">
              <strong>{t('settings.language')}</strong>
              <span>{t('settings.language.hint')}</span>
            </div>
            <div className="row-control">
              <span className="select select-wide">
                <select
                  value={settings.language ?? 'system'}
                  onChange={(e) => void updateSettings({ language: e.target.value })}
                >
                  {/* 每种语言用它自己的名字显示——用户找得到自己的语言才有意义 */}
                  <option value="system">
                    {t('settings.language.systemCurrent', { name: systemName })}
                  </option>
                  {AVAILABLE_LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
        </div>
        <p className="section-note">
          {t('settings.language.detected', { tags: (settings.systemLanguageTags ?? []).join(', ') })}
        </p>
      </div>

      <div className="section">
        <div className="section-title">{t('settings.about')}</div>
        <div className="card">
          <div className="row">
            <div className="row-label">
              <strong>Wave Subs</strong>
              <span>{t('app.tagline')}</span>
            </div>
            <div className="row-control">
              <span className="tag tag-quiet">{info?.version ?? ''}</span>
            </div>
          </div>
          <div className="row">
            <div className="row-label">
              <strong>{t('settings.about.privacy')}</strong>
              <span>{t('settings.about.privacyHint')}</span>
            </div>
          </div>
          <div className="row">
            <div className="row-label">
              <strong>{t('settings.about.deps')}</strong>
              <span>{t('settings.about.depsHint')}</span>
            </div>
          </div>
          <div className="row">
            <div className="row-label">
              <strong>{t('settings.about.feedback')}</strong>
              <span>{t('settings.about.feedbackHint')}</span>
            </div>
            <div className="row-control about-links">
              <button
                type="button"
                className="btn"
                onClick={() => window.waveSubs.openExternal(feedbackUrl(info?.version ?? '', info?.platform ?? '', info?.locale ?? ''))}
              >
                {t('help.feedback')}
              </button>
              <button type="button" className="btn" onClick={() => window.waveSubs.openExternal(DISCUSSIONS_URL)}>
                {t('help.discussions')}
              </button>
              {info?.mas && (
                <button type="button" className="btn" onClick={() => window.waveSubs.openExternal(APP_STORE_REVIEW_URL)}>
                  {t('help.rate')}
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="section-note">{t('settings.about.note')}</p>
      </div>
    </div>
  )
}
