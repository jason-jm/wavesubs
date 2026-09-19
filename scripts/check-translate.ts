/**
 * 批量翻译往返格式的自检：对齐锚 k 的核对规则。
 *
 * 背景：模型偶尔把第 n 条的译文写到 n+1 条上（评测里「意思弄反」的一大来源），按 i 回填时无人察觉。
 * 现在要求每行先照抄原文开头 ANCHOR_CHARS 个字，对不上的行丢掉走重试。
 */
import { ANCHOR_CHARS, buildSystemPrompt, looksCutShort, parseBatchResponse } from '../src/main/core/translate/prompt'

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
console.log('\n只译了开头一截：')
{
  const long = new Map([[1, 'ことし6月東北地方の大連市で海外の高級人材を招く一大イベントが開かれました'], [2, 'すごいな']])
  eq('小模型把 k 那几个字当成整条来译（今年6月）→ 丢掉', [...parseBatchResponse('[{"i":1,"k":"ことし6月","t":"今年6月"}]', long).entries()], [])
  eq('单条批次也不收半截译文', [...parseBatchResponse('[{"i":1,"k":"ことし6月","t":"今年6月"}]', new Map([[1, long.get(1)!]])).entries()], [])
  eq('译完整条的照收', [...parseBatchResponse('[{"i":1,"k":"ことし6月","t":"今年6月，东北地区的大连市举办了一场招揽海外高级人才的大型活动"}]', long).entries()].length, 1)
  eq('短原文不设这道门（すごいな → 好厉害）', [...parseBatchResponse('[{"i":2,"k":"すごい","t":"好厉害"}]', long).entries()], [[2, '好厉害']])
  eq('西文原文按词数比：一句 12 个词译成 3 个字算没译完', looksCutShort('I really think we should talk about this before it is too late', '我们谈谈'), true)
  eq('西文正常译文过得去', looksCutShort('I really think we should talk about this before it is too late', '我真的觉得趁还来得及，我们该谈谈这件事'), false)
  eq('日文正常的精简译文过得去（比值约 0.5）', looksCutShort('招待されたのは28の国と地域で活躍する1,100人のエリートたち、', '受邀的是活跃在28个国家和地区的1100名精英'), false)
}

eq('代码围栏与思考块照旧剥掉', [...parseBatchResponse('<think>嗯</think>```json\n[{"i":1,"k":"これ以上","t":"不会再成长了"}]\n```', sources).entries()], [[1, '不会再成长了']])
console.log('提示词：')
const prompt = buildSystemPrompt({ targetLanguage: 'zh', sourceLanguage: 'ja' })
eq('系统提示要求输出锚 k', prompt.includes('"k"') && prompt.includes(String(ANCHOR_CHARS)), true)
eq('系统提示禁止错位', prompt.includes('相邻编号'), true)

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
