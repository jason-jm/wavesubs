/**
 * 批量翻译往返格式的自检：对齐锚 k 的核对规则。
 *
 * 背景：模型偶尔把第 n 条的译文写到 n+1 条上（评测里「意思弄反」的一大来源），按 i 回填时无人察觉。
 * 现在要求每行先照抄原文开头 ANCHOR_CHARS 个字，对不上的行丢掉走重试。
 */
import { ANCHOR_CHARS, buildSystemPrompt, parseBatchResponse } from '../src/main/core/translate/prompt'
import { translateCues } from '../src/main/core/translate/translateCues'
import type { BatchItem, TranslateContext, TranslationProvider } from '../src/main/core/translate/types'
import type { Cue } from '../src/main/core/subtitle/types'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  console.log(`  ${g === w ? '✓' : '✗'} ${name}${g === w ? '' : `\n      得到 ${g}\n      期望 ${w}`}`)
  if (g !== w) bad += 1
}

const sources = new Map([[1, 'これ以上成長することはないが'], [2, 'すごいな'], [3, 'Hello there, General Kenobi']])
console.log('锚核对：')
eq('锚正确的行保留', [...parseBatchResponse('[{"i":1,"k":"これ以上","t":"不会再成长了"}]', sources).entries()], [[1, '不会再成长了']])
eq('锚对不上的行丢掉（错位）', [...parseBatchResponse('[{"i":2,"k":"これ以上","t":"不会再成长了"},{"i":1,"k":"これ以上","t":"不会再成长了"}]', sources).entries()], [[1, '不会再成长了']])
eq('没有 k 的行照常接受（云端模型可能不理会格式）', [...parseBatchResponse('[{"i":2,"t":"好厉害"}]', sources).entries()], [[2, '好厉害']])
eq('全角/空白差异不算锚不匹配', [...parseBatchResponse('[{"i":3,"k":"hell","t":"你好"}]', sources).entries()], [[3, '你好']])
eq('锚比原文还短（原文只有 4 字以内）也能过', [...parseBatchResponse('[{"i":2,"k":"すご","t":"好厉害"}]', sources).entries()], [[2, '好厉害']])
eq('单条批次不核对锚（兜底轮）', [...parseBatchResponse('[{"i":2,"k":"完全不对","t":"好厉害"}]', new Map([[2, 'すごいな']])).entries()], [[2, '好厉害']])
eq('不传 sources 时不核对', [...parseBatchResponse('[{"i":1,"k":"完全不对","t":"x"}]').entries()], [[1, 'x']])
eq('代码围栏与思考块照旧剥掉', [...parseBatchResponse('<think>嗯</think>```json\n[{"i":1,"k":"これ以上","t":"不会再成长了"}]\n```', sources).entries()], [[1, '不会再成长了']])
console.log('小模型的各种走样输出：')
const src20 = new Map([[1, '今日明日の2日間は'], [2, '変貌する'], [3, '世界の工場']])
eq('一行一个数组（1.7B 实测形态）全部收到', [...parseBatchResponse('</think>\n\n[{"i":1,"k":"今日明日","t":"今明两天"}]\n[{"i":2,"k":"変貌する","t":"变化"}]\n[{"i":3,"k":"世界の工場","t":"世界工厂"}]', src20).entries()], [[1, '今明两天'], [2, '变化'], [3, '世界工厂']])
eq('JSONL（没有方括号）也收', [...parseBatchResponse('{"i":1,"k":"今日明日","t":"今明两天"}\n{"i":2,"k":"変貌する","t":"变化"}', src20).entries()], [[1, '今明两天'], [2, '变化']])
eq('尾巴被截断时前面完整的救回来', [...parseBatchResponse('[{"i":1,"k":"今日明日","t":"今明两天"},{"i":2,"k":"変貌する","t":"变化"},{"i":3,"k":"世界の工場","t":"世界工', src20).entries()], [[1, '今明两天'], [2, '变化']])
eq('逐个抠时锚照样核对', [...parseBatchResponse('[{"i":1,"k":"変貌する","t":"变化"}]\n[{"i":2,"k":"変貌する","t":"变化"}]', src20).entries()], [[2, '变化']])
eq('编号给成字符串也认', [...parseBatchResponse('[{"i":"2","k":"変貌する","t":"变化"}]', src20).entries()], [[2, '变化']])
eq('译文里的花括号不干扰抠对象', [...parseBatchResponse('[{"i":2,"k":"変貌する","t":"变化{很大}"}]\n[{"i":3,"k":"世界の工場","t":"世界\\"工厂\\""}]', src20).entries()], [[2, '变化{很大}'], [3, '世界"工厂"']])
eq('单条兜底轮只回 ["译文"] 也收', [...parseBatchResponse('</think>\n["变貌"]', new Map([[2, '変貌する']])).entries()], [[2, '变貌']])
eq('多条批次回光秃秃的字符串数组不乱配', [...parseBatchResponse('["变貌","世界工厂"]', src20).entries()], [])
let threw = false
try { parseBatchResponse('抱歉，我无法翻译。', src20) } catch (e) { threw = e instanceof Error && e.message.includes('JSON') }
eq('完全没有 JSON 才报解析错', threw, true)
console.log('提示词：')
const prompt = buildSystemPrompt({ targetLanguage: 'zh', sourceLanguage: 'ja' })
eq('系统提示要求输出锚 k', prompt.includes('"k"') && prompt.includes(String(ANCHOR_CHARS)), true)
eq('系统提示禁止错位', prompt.includes('相邻编号'), true)
eq('日→中：强调里点明原文是日语、译成简体中文', prompt.includes('原文是日语，t 必须译成简体中文') && prompt.includes('绝不能把原文照抄'), true)
eq('日→中：示例输入是日语、输出是简体中文，锚按 ANCHOR_CHARS 截', prompt.includes(`{"i":7,"k":"${'今日は本当にありがとうございました'.slice(0, ANCHOR_CHARS)}","t":"今天真的太感谢你了"}`) && prompt.includes('{"i":7,"t":"今日は本当にありがとうございました"}'), true)
const enJa = buildSystemPrompt({ targetLanguage: 'ja', sourceLanguage: 'en' })
eq('英→日：示例输入英语、输出日语', enJa.includes('"t":"Thank you so much for today."') && enJa.includes('"t":"今日は本当にありがとうございました"'), true)
const unknownJa = buildSystemPrompt({ targetLanguage: 'ja' })
eq('源语言未知、目标日语：示例输入用英语，强调里不点源语言', unknownJa.includes('"t":"Thank you so much for today."') && unknownJa.includes('注意：t 必须译成日语'), true)
const jaJa = buildSystemPrompt({ targetLanguage: 'ja', sourceLanguage: 'ja' })
eq('源=目标（都是日语）：示例输入不重复用日语', jaJa.includes('"t":"Thank you so much for today."'), true)
const zhHant = buildSystemPrompt({ targetLanguage: 'zh-Hant', sourceLanguage: 'ja' })
eq('繁体目标：示例输出是繁体', zhHant.includes('"t":"今天真的太感謝你了"'), true)
const glossaryPrompt = buildSystemPrompt({ targetLanguage: 'zh', sourceLanguage: 'ja', glossary: [{ from: '胡錦濤', to: '胡锦涛' }] })
eq('术语表段仍在示例之前', glossaryPrompt.indexOf('术语对照') < glossaryPrompt.indexOf('示例——输入'), true)


console.log('\n每一轮都不收抄原文的译文：')
{
  // 第一轮把 1 号照抄原文、2 号正常译；小批重试那轮 1 号又抄；单条兜底那轮才译对
  let calls = 0
  const provider: TranslationProvider = {
    name: 'stub',
    async chat() { return '' },
    async translateBatch(items: BatchItem[], _ctx: TranslateContext) {
      calls += 1
      const out = new Map<number, string>()
      for (const it of items) {
        if (it.index === 2) out.set(2, '好厉害')
        else out.set(1, calls >= 3 ? '不会再成长了' : it.text)
      }
      return out
    }
  }
  const cues: Cue[] = [
    { index: 1, startMs: 0, endMs: 1000, text: 'これ以上は成長しない' },
    { index: 2, startMs: 1000, endMs: 2000, text: 'すごいな' }
  ]
  const r = await translateCues(cues, provider, { sourceLanguage: 'ja', targetLanguage: 'zh' })
  eq('抄原文的两轮都被挡掉，第三轮才收', cues[0].translation, '不会再成长了')
  eq('正常的第一轮就收', cues[1].translation, '好厉害')
  eq('统计不把抄原文的算成译出', [r.translatedCount, r.missingCount], [2, 0])
  // 三轮都抄：宁可留空
  const stubborn: TranslationProvider = { name: 'stub', async chat() { return '' }, async translateBatch(items) { return new Map(items.map((it) => [it.index, it.text])) } }
  const cues2: Cue[] = [{ index: 1, startMs: 0, endMs: 1000, text: 'これ以上は成長しない' }]
  const r2 = await translateCues(cues2, stubborn, { sourceLanguage: 'ja', targetLanguage: 'zh' })
  eq('三轮都抄原文就留空，不把原文当译文', [cues2[0].translation, r2.missingCount], [undefined, 1])
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
