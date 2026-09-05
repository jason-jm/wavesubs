import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement as h } from 'react'
import { BatchView } from './views/BatchView'
import { I18nProvider } from './i18n'
import type { BatchEntry } from './App'

const css = readFileSync('/Users/bytedance/Documents/subtitle/src/renderer/src/App.css', 'utf8')

const settings = {
  appearance: 'system', language: 'system', resolvedLanguage: 'zh-Hans', systemLanguage: 'zh-Hans',
  translateEnabled: true,
  translation: { engine: 'local', targetLanguage: 'zh', localModel: null,
    providers: [{ id: '1', name: '火山方舟', protocol: 'openai', baseUrl: 'x', model: 'm', hasApiKey: true }],
    activeProviderId: '1' },
  export: { format: 'srt', content: 'translated' }
}
const overview = { dir: '/m', llmDir: '/m/llm', hardware: { chip: 'M2', memGB: 16, appleSilicon: true },
  selected: 'a.bin', llmSelected: 'b.gguf', models: [], llmModels: [{ file: 'b.gguf', name: 'Qwen3 8B', sizeMB: 5030, ramGB: 6, quality: 4, speed: 3, requirement: 'x', detail: 'y', installed: true, downloading: false, fitness: 'great' }] }

const entries: BatchEntry[] = [
  { id: '1', path: '/v/Archimedes.mkv', name: 'The Great War of Archimedes.mkv', status: 'done',
    result: { outputPath: '/v/a.srt', language: 'ja', cueCount: 1203, translated: true, translatedCount: 1203 } },
  { id: '2', path: '/v/Downfall.mkv', name: 'Downfall.2004.1080p.mkv', status: 'running',
    progress: { stage: 'translate', percent: 46, messageKey: 'progress.translating' } },
  { id: '3', path: '/v/F1.mp4', name: 'F1 The Movie.mp4', status: 'waiting' },
  { id: '4', path: '/v/broken.srt', name: 'broken-subtitle.srt', status: 'failed',
    error: '这个字幕文件里没有解析出任何字幕条目（可能是不支持的格式或图形字幕）' },
  { id: '5', path: '/v/MI.mkv', name: 'Mission Impossible.mkv', status: 'waiting' }
]

const noop = (): void => {}
const view = (locale: string, es: BatchEntry[], running: boolean) =>
  renderToStaticMarkup(h(I18nProvider, { locale, children:
    h(BatchView, { settings, overview, entries: es, running, stopping: false,
      onAdd: () => 0, onRemove: noop, onClear: noop, onStart: noop, onStop: noop,
      updateSettings: async () => {}, goModels: noop } as never) } as never))

const panel = (title: string, locale: string, es: BatchEntry[], running = false, dir = 'ltr') => `
<div style="margin:0 20px 24px 0;width:760px">
  <div style="font:11px -apple-system;color:#8a8a90;margin-bottom:6px">${title}</div>
  <div dir="${dir}" style="border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.14)">
    <div class="app" style="height:auto"><div class="sidebar" style="display:none"></div>
      <main class="content"><div class="scroll" style="overflow:visible">${view(locale, es, running)}</div></main>
    </div>
  </div>
</div>`

const html = `<!doctype html><meta charset="utf-8"><title>批量页</title><style>
body{background:#141416;margin:0;padding:22px;font-family:-apple-system,system-ui;display:flex;flex-wrap:wrap}
.app{grid-template-columns:1fr !important}
</style><style>${css}</style>
${panel('中文 · 队列进行中', 'zh-Hans', entries, true)}
${panel('中文 · 空队列', 'zh-Hans', [])}
${panel('English', 'en', entries, true)}
${panel('العربية (RTL)', 'ar', entries, true, 'rtl')}`

createServer((_q,s)=>{s.setHeader('content-type','text/html; charset=utf-8');s.end(html)}).listen(8793,'127.0.0.1',()=>console.log('ready'))
