/**
 * 批量翻译往返格式的自检：对齐锚 k 的核对规则。
 *
 * 背景：模型偶尔把第 n 条的译文写到 n+1 条上（评测里「意思弄反」的一大来源），按 i 回填时无人察觉。
 * 现在要求每行先照抄原文开头 ANCHOR_CHARS 个字，对不上的行丢掉走重试。
 */
import { ANCHOR_CHARS, buildSystemPrompt, parseBatchResponse } from '../src/main/core/translate/prompt'

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
eq('代码围栏与思考块照旧剥掉', [...parseBatchResponse('<think>嗯</think>```json\n[{"i":1,"k":"これ以上","t":"a"}]\n```', sources).entries()], [[1, 'a']])
console.log('提示词：')
const prompt = buildSystemPrompt({ targetLanguage: 'zh', sourceLanguage: 'ja' })
eq('系统提示要求输出锚 k', prompt.includes('"k"') && prompt.includes(String(ANCHOR_CHARS)), true)
eq('系统提示禁止错位', prompt.includes('相邻编号'), true)

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
