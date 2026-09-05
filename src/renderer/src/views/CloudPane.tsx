import { useState } from 'react'
import type { TranslationKey } from '../../../shared/i18n'
import type {
  CloudProtocol,
  CloudProviderView,
  SettingsView,
  TranslationTestResult
} from '../../../shared/types'
import { useT } from '../i18n'
import { Icon } from '../components/Icon'

interface Props {
  settings: SettingsView | null
  onChanged: (next: SettingsView) => void
}

interface Draft {
  id?: string
  name: string
  protocol: CloudProtocol
  baseUrl: string
  model: string
  apiKey: string
  hasApiKey: boolean
}

/**
 * 常用服务的地址和示例模型，省得用户翻文档。选了之后所有字段都还能改。
 *
 * label 是品牌名，属于专有名词，任何语言下都不翻译。
 * 但中文品牌在非中文界面下没人认得，所以并列官方拉丁名——
 * 这不是翻译，是这些厂商本来就有的两个正式名字。
 * suffixKey 用来放品牌名之外的说明性文字（目前只有「本地」）。
 */
interface Preset {
  label: string
  suffixKey?: TranslationKey
  protocol: CloudProtocol
  baseUrl: string
  model: string
}

const PRESETS: Preset[] = [
  { label: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  {
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-opus-5'
  },
  {
    label: 'Volcano Ark 火山方舟',
    protocol: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-1-pro-260628'
  },
  {
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  {
    label: 'Qwen 通义千问',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  },
  {
    label: 'Zhipu GLM 智谱',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-plus'
  },
  {
    label: 'Moonshot',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k'
  },
  {
    label: 'SiliconFlow 硅基流动',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct'
  },
  {
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini'
  },
  {
    label: 'Google Gemini',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash'
  },
  {
    label: 'Azure OpenAI',
    protocol: 'azure',
    baseUrl: '',
    model: ''
  },
  {
    label: 'Ollama',
    suffixKey: 'home.service.localGroup',
    protocol: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b'
  }
]

const PROTOCOL_LABEL: Record<CloudProtocol, TranslationKey> = {
  openai: 'cloud.protocol.openai',
  anthropic: 'cloud.protocol.anthropic',
  azure: 'cloud.protocol.azure'
}

/** 三种协议的地址、模型标识、Key 写法都不一样，提示要跟着变。
    Azure 的三项含自然语言，走翻译键；其余是固定示例值，不翻译 */
const PROTOCOL_HINTS: Record<
  CloudProtocol,
  { modelLabelKey: TranslationKey; baseUrl?: string; model?: string; apiKey?: string }
> = {
  openai: {
    modelLabelKey: 'cloud.field.model',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: 'sk-…'
  },
  anthropic: {
    modelLabelKey: 'cloud.field.model',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-opus-5',
    apiKey: 'sk-ant-…'
  },
  azure: { modelLabelKey: 'cloud.field.deployment' }
}

const EMPTY: Draft = {
  name: '',
  protocol: 'openai',
  baseUrl: '',
  model: '',
  apiKey: '',
  hasApiKey: false
}

function toDraft(p: CloudProviderView): Draft {
  return {
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    model: p.model,
    apiKey: '',
    hasApiKey: p.hasApiKey
  }
}

/**
 * 服务标识。一排云端服务只有文字名的话，扫一眼分不出谁是谁；
 * 给每个服务按名字算一个稳定的色相，配上首字母，就有了识别锚点。
 *
 * 色相取自名字的哈希而不是随机——同一个服务每次打开必须是同一个颜色，
 * 否则这个标识就失去了意义。
 */
function ServiceMark({ name }: { name: string }): React.JSX.Element {
  const trimmed = name.trim()
  let h = 0
  for (let i = 0; i < trimmed.length; i += 1) h = (h * 31 + trimmed.charCodeAt(i)) >>> 0
  const hue = h % 360
  const initial = [...trimmed][0]?.toUpperCase() ?? '·'
  return (
    <span
      className="service-mark"
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 72% 62%), hsl(${(hue + 38) % 360} 68% 48%))`
      }}
    >
      {initial}
    </span>
  )
}

export function CloudPane({ settings, onChanged }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, TranslationTestResult>>({})
  const t = useT()

  if (!settings) return <p className="loading">{t('common.loadingConfig')}</p>
  const providers = settings.translation.providers
  const addingNew = draft !== null && draft.id === undefined

  const set = (k: keyof Draft, v: string): void => setDraft((d) => (d ? { ...d, [k]: v } : d))

  /** 套用预设：只覆盖地址相关字段，用户已经填的名字和 Key 保留 */
  const applyPreset = (label: string): void => {
    const preset = PRESETS.find((p) => p.label === label)
    if (!preset) return
    setDraft((d) =>
      d
        ? {
            ...d,
            protocol: preset.protocol,
            baseUrl: preset.baseUrl,
            model: preset.model,
            name: d.name.trim() ? d.name : preset.label
          }
        : d
    )
  }

  const save = (): void => {
    if (!draft) return
    void window.waveSubs
      .saveCloudProvider({
        id: draft.id,
        name: draft.name,
        protocol: draft.protocol,
        baseUrl: draft.baseUrl,
        model: draft.model,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {})
      })
      .then((next) => {
        onChanged(next)
        setDraft(null)
      })
  }

  const remove = (id: string): void => {
    void window.waveSubs.removeCloudProvider(id).then(onChanged)
    setResults((r) => {
      const next = { ...r }
      delete next[id]
      return next
    })
  }

  const test = (id: string): void => {
    setTesting(id)
    setResults((r) => {
      const next = { ...r }
      delete next[id]
      return next
    })
    void window.waveSubs
      .testCloudProvider(id)
      .then((res) => setResults((r) => ({ ...r, [id]: res })))
      .finally(() => setTesting(null))
  }

  const canSave = draft !== null && draft.baseUrl.trim() !== '' && draft.model.trim() !== ''
  const proto = draft?.protocol ?? 'openai'
  const hints = PROTOCOL_HINTS[proto]
  const ph =
    proto === 'azure'
      ? {
          baseUrl: t('cloud.azure.baseUrlPlaceholder'),
          model: t('cloud.azure.modelPlaceholder'),
          apiKey: t('cloud.azure.apiKeyPlaceholder')
        }
      : { baseUrl: hints.baseUrl ?? '', model: hints.model ?? '', apiKey: hints.apiKey ?? '' }

  /** 编辑态：这一行本身展开成表单，不另起卡片 */
  const editForm = (): React.JSX.Element => (
    <div className="row-editing">
      <div className="preset-row">
        <span className="field-label">{t('cloud.preset')}</span>
        <label className="select">
          <select value="" onChange={(e) => applyPreset(e.target.value)}>
            <option value="">{t('cloud.preset.placeholder')}</option>
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.suffixKey ? `${p.label} · ${t(p.suffixKey)}` : p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="edit-grid">
        <label className="field">
          <span className="field-label">{t('cloud.field.name')}</span>
          <input
            className="input"
            value={draft?.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('cloud.field.namePlaceholder')}
            spellCheck={false}
            autoFocus
          />
        </label>
        <div className="field">
          <span className="field-label">{t('cloud.field.protocol')}</span>
          <label className="select">
            <select
              value={draft?.protocol ?? 'openai'}
              onChange={(e) => set('protocol', e.target.value)}
            >
              {(Object.keys(PROTOCOL_LABEL) as CloudProtocol[]).map((k) => (
                <option key={k} value={k}>
                  {t(PROTOCOL_LABEL[k])}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field field-full">
          <span className="field-label">{t('cloud.field.baseUrl')}</span>
          <input
            className="input"
            value={draft?.baseUrl ?? ''}
            onChange={(e) => set('baseUrl', e.target.value)}
            placeholder={ph.baseUrl}
            spellCheck={false}
          />
        </label>
        <label className="field field-full">
          <span className="field-label">{t(hints.modelLabelKey)}</span>
          <input
            className="input"
            value={draft?.model ?? ''}
            onChange={(e) => set('model', e.target.value)}
            placeholder={ph.model}
            spellCheck={false}
          />
        </label>
        <label className="field field-full">
          <span className="field-label">
            {t('cloud.field.apiKey')}
            {draft?.hasApiKey && (
              <span className="tag tag-green">
                <Icon name="check" size={9} />
                {t('cloud.apiKey.saved')}
              </span>
            )}
          </span>
          <input
            className="input"
            type="password"
            value={draft?.apiKey ?? ''}
            onChange={(e) => set('apiKey', e.target.value)}
            placeholder={draft?.hasApiKey ? t('cloud.apiKey.keep') : ph.apiKey}
            spellCheck={false}
          />
        </label>
      </div>
      <div className="edit-actions">
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>
          {draft?.id ? t('common.save') : t('common.add')}
        </button>
        <button className="btn btn-quiet" onClick={() => setDraft(null)}>
          {t('common.cancel')}
        </button>
        <span className="spacer" />
        {draft?.id && (
          <button className="btn btn-quiet btn-danger" onClick={() => remove(draft.id as string)}>
            <Icon name="trash" size={14} />
            {t('cloud.deleteService')}
          </button>
        )}
      </div>
    </div>
  )

  if (providers.length === 0 && !draft) {
    return (
      <>
        <div className="empty-pane">
          <span className="empty-glyph">
            <Icon name="cloud" size={24} />
          </span>
          <h3>{t('cloud.empty.title')}</h3>
          <p>{t('cloud.empty.body')}</p>
          <button className="btn btn-primary" onClick={() => setDraft({ ...EMPTY })}>
            {t('cloud.addService')}
          </button>
        </div>
        <p className="section-note">{t('cloud.hint')}</p>
      </>
    )
  }

  return (
    <>
      <div className="card">
        {providers.map((p) => {
          const isEditing = draft?.id === p.id
          return (
            <div
              key={p.id}
              className={`model-row model-row-stack ${isEditing ? 'model-row-open' : ''}`}
            >
              <div className="model-row-head">
                <ServiceMark name={isEditing ? draft.name || p.name : p.name} />
                <div className="model-main">
                  <div className="model-name">
                    <strong>{isEditing ? draft.name || p.name : p.name}</strong>
                    {p.protocol !== 'openai' && (
                      <span className="tag">{t(PROTOCOL_LABEL[p.protocol])}</span>
                    )}
                    {p.hasApiKey ? (
                      <span className="tag tag-green">{t('cloud.hasKey')}</span>
                    ) : (
                      <span className="tag tag-orange">{t('cloud.noKey')}</span>
                    )}
                  </div>
                  {!isEditing && (
                    <>
                      <p className="model-detail">{p.model}</p>
                      <div className="model-meta">
                        <span>{p.baseUrl}</span>
                      </div>
                    </>
                  )}
                  {!isEditing && results[p.id] && (
                    <p className={`test-inline ${results[p.id].ok ? 'save-ok' : 'save-fail'}`}>
                      {results[p.id].ok ? '✓ ' : '✗ '}
                      {results[p.id].message}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <div className="model-side">
                    <button className="btn" disabled={testing === p.id} onClick={() => test(p.id)}>
                      {testing === p.id ? t('cloud.testing') : t('cloud.test')}
                    </button>
                    <button className="btn" onClick={() => setDraft(toDraft(p))}>
                      {t('common.edit')}
                    </button>
                  </div>
                )}
              </div>
              {isEditing && editForm()}
            </div>
          )
        })}

        {addingNew && (
          <div className="model-row model-row-stack model-row-open">
            <div className="model-row-head">
              <ServiceMark name={draft.name || '·'} />
              <div className="model-main">
                <div className="model-name">
                  <strong>{draft.name || t('cloud.newService')}</strong>
                </div>
              </div>
            </div>
            {editForm()}
          </div>
        )}
      </div>

      {!draft && (
        <button className="btn add-btn" onClick={() => setDraft({ ...EMPTY })}>
          <Icon name="plus" size={14} />
          {t('cloud.addService')}
        </button>
      )}

      <p className="section-note">{t('cloud.hint')}</p>
    </>
  )
}
