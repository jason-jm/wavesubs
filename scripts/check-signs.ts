/**
 * 画面文字模块自检：几何与统计规则（分组 / 跟踪 / 名单时段 / 烧录字幕带）、判别对齐锚、排版取舍、写出格式。
 * 全部用合成数据，不跑 OCR 也不跑模型；判别用假 chat 模拟 8B 的串行毛病。
 */
import { buildSignBlocks, creditWindows, groupLines, judgeSigns, layoutOf, leftoverScript, signsToCues, trackBlocks, textSimilarity } from '../src/main/core/signs'
import type { OcrBox, OcrFrame, SignBlock } from '../src/main/core/signs'
import { cuesToAss } from '../src/main/core/subtitle/ass'
import { cuesToSrt } from '../src/main/core/subtitle/srt'
import type { Cue } from '../src/main/core/subtitle/types'
import { pickDetectionWindows } from '../src/main/core/asr/whisperCpp'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { console.log(`  ✓ ${name}`); return }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}
const box = (t: string, x: number, y: number, w: number, h: number, c = 0.9): OcrBox => ({ t, c, x, y, w, h })

console.log('同帧分行：')
{
  const g = groupLines([box('第一行', 0.1, 0.10, 0.3, 0.04), box('第二行', 0.1, 0.15, 0.28, 0.04), box('远处', 0.7, 0.5, 0.1, 0.04)])
  eq('上下相邻且水平重叠的并成一块（换行连接）', g.map((b) => b.t), ['第一行\n第二行', '远处'])
  eq('合并块的框包住两行', [g[0].y, Number((g[0].h).toFixed(2))], [0.1, 0.09])
  const furi = groupLines([box('すけどの', 0.3, 0.40, 0.12, 0.02), box('佐殿', 0.3, 0.43, 0.14, 0.06)])
  eq('汉字上方的小字注音被去掉', furi.map((b) => b.t), ['佐殿'])
}

console.log('\n跨帧跟踪：')
{
  const frames: OcrFrame[] = [0, 1, 2].map((i) => ({ i, boxes: [box('野外活動サークル', 0.2, 0.2, 0.3, 0.05), box(`${i}`, 0.9, 0.9, 0.02, 0.02, 0.4)] }))
  frames.push({ i: 3, boxes: [] }, { i: 4, boxes: [] }, { i: 5, boxes: [] })
  const blocks = trackBlocks(frames, 1)
  const main = blocks.find((b) => b.text === '野外活動サークル')!
  eq('同文本同位置连续三帧合成一块', [main.frames, main.startSec, main.endSec], [3, 0, 3])
  eq('相似度：小差异仍算同一块', textSimilarity('ポール補修用パイプ', 'ポール補修用バイプ') > 0.6, true)
}

console.log('\n名单时段与烧录字幕带：')
{
  // 0–14s 职员表（职位词每帧都有），15–40s 正片：底部居中一直有"字幕"、中部偶尔有招牌
  const frames: OcrFrame[] = []
  for (let i = 0; i < 15; i += 1) frames.push({ i, boxes: [box('監督 山田太郎', 0.3, 0.4, 0.4, 0.05), box('Taro Yamada', 0.3, 0.5, 0.3, 0.04)] })
  for (let i = 15; i < 40; i += 1) {
    const boxes = [box(`台词第${i}句话`, 0.3, 0.9, 0.4, 0.05)]
    if (i >= 20 && i < 24) boxes.push(box('業務管理室', 0.6, 0.3, 0.2, 0.05))
    frames.push({ i, boxes })
  }
  const credits = creditWindows(frames, 1)
  eq('职位词密集的开头判为名单时段', credits.length === 1 && credits[0][0] === 0 && credits[0][1] >= 14, true)
  const regions = [{ startMs: 15000, endMs: 40000 }]
  const { blocks, band } = buildSignBlocks(frames, 1, regions)
  eq('底部居中、与人声重叠的带判为烧录字幕', band.length === 2 && band[0] >= 0.8, true)
  const dropped = blocks.filter((b) => b.drop === 'subtitle-band').length
  eq('带内的块都被剔掉', dropped > 0 && blocks.filter((b) => b.text.startsWith('台词') && !b.drop).length, 0)
  eq('名单块被剔掉', blocks.filter((b) => b.text.includes('監督') && b.drop === 'credits').length > 0, true)
  const sign = blocks.find((b) => b.text === '業務管理室')!
  eq('中部的招牌保留送判别', sign.drop, undefined)
  // 贴底的字幕：框中心略超 1.0（Vision 的归一化框会溢出一点）也要算在带内
  const edge = buildSignBlocks([...frames, ...[40, 41, 42].map((i) => ({ i, boxes: [box('贴底的一行字幕', 0.3, 0.965, 0.4, 0.06)] }))], 1, regions)
  eq('中心略超画面底边的字幕行也剔掉', edge.blocks.find((b) => b.text === '贴底的一行字幕')?.drop, 'subtitle-band')
  eq('人声重叠比例已算出', typeof sign.speech, 'number')
}

console.log('\n语种采样窗口：')
{
  // 开头 60 秒是片头音乐（无人声），之后每分钟有 40 秒对白
  const regions: Array<{ startMs: number; endMs: number }> = []
  for (let m = 1; m < 60; m += 1) regions.push({ startMs: m * 60000, endMs: m * 60000 + 40000 })
  const starts = pickDetectionWindows(regions, 3600)
  eq('不会选在片头无人声段', starts.every((s) => s >= 60), true)
  eq('最多 5 个窗口且彼此隔开 ≥2 分钟', starts.length === 5 && starts.every((s, i) => i === 0 || s - starts[i - 1] >= 120), true)
  eq('没有人声就没有窗口', pickDetectionWindows([], 3600).length, 0)
}

console.log('\n台标/水印：')
{
  // 30 分钟的片，右上角 WOWOW 一直在（断断续续 20 分钟），中间偶尔有招牌
  const frames: OcrFrame[] = []
  for (let i = 0; i < 1800; i += 1) {
    const boxes: OcrBox[] = []
    if (i % 3 !== 2) boxes.push(box('WOWOW', 0.9, 0.03, 0.06, 0.03))
    if (i >= 600 && i < 605) boxes.push(box('営業中', 0.4, 0.4, 0.2, 0.05))
    frames.push({ i, boxes })
  }
  const { blocks } = buildSignBlocks(frames, 1, null)
  eq('长期停留同一位置的台标全部剔掉', blocks.filter((b) => b.text === 'WOWOW' && b.drop !== 'watermark').length, 0)
  eq('短暂出现的招牌不受影响', blocks.find((b) => b.text === '営業中')?.drop, undefined)
}

console.log('\n判别对齐锚与念读兜底：')
{
  const mk = (id: number, text: string, y = 0.3): SignBlock => ({ id, text, startSec: 10, endSec: 13, frames: 3, conf: 0.9, box: { x: 0.3, y, w: 0.3, h: 0.05 } })
  const blocks = [mk(1, '業務管理室'), mk(2, 'SOLO'), mk(3, 'かんたんレシピ'), mk(4, '犬どもに昼メシにされそうになった')]
  // 模拟 8B：答案整体往后串一位，但 src 照抄了原文，能对回去；第 4 条被判成 noise
  const chat = async (): Promise<string> =>
    JSON.stringify([
      { id: 2, src: '業務管理室', category: 'sign', importance: 2, fixed: '', tr: '业务管理室' },
      { id: 3, src: 'SOLO', category: 'noise', importance: 1, fixed: '', tr: '' },
      { id: 4, src: 'かんたんレシピ', category: 'sign', importance: 2, fixed: '', tr: '简易食谱' },
      { id: 1, src: '犬どもに昼メシ', category: 'noise', importance: 1, fixed: '', tr: '' }
    ])
  const cues: Cue[] = [{ index: 1, startMs: 9000, endMs: 12000, text: '犬どもに昼メシにされそうになったり' }]
  const judged = await judgeSigns(blocks, { chat, cues, sourceLanguageName: 'Japanese', targetLanguageName: 'Simplified Chinese' })
  const byId = new Map(judged.map((j) => [j.id, j]))
  eq('按 src 对齐：業務管理室 拿到自己的译文', byId.get(1)?.tr, '业务管理室')
  eq('SOLO 判 noise', byId.get(2)?.category, 'noise')
  eq('念出来的画面文字即使模型判 noise 也改回 sign、重要度 3', [byId.get(4)?.category, byId.get(4)?.importance], ['sign', 3])
}

console.log('\n译文残留判定：')
eq('整句照抄的日文算没翻', leftoverScript('リン 今週はどこ行ってんの', 'Simplified Chinese'), true)
eq('带片假名专名的中文译文是对的', leftoverScript('欢迎来到野クル！', 'Simplified Chinese'), false)
eq('目标是日语时不判', leftoverScript('ようこそ', 'Japanese'), false)

console.log('\n排版与取舍：')
{
  const mk = (id: number, text: string, y: number, h: number, start = 0, end = 5): SignBlock => ({ id, text, startSec: start, endSec: end, frames: 5, conf: 0.9, box: { x: 0.3, y, w: 0.3, h } })
  eq('多行盖字', layoutOf(mk(1, 'a\nb', 0.3, 0.1), 'x'), 'box')
  eq('底部单行放顶部', layoutOf(mk(1, 'a', 0.85, 0.04), 'x'), 'top')
  eq('中部单行贴下方', layoutOf(mk(1, 'a', 0.3, 0.04), 'x'), 'below')
  const blocks = [mk(1, 'A', 0.1, 0.04), mk(2, 'B', 0.2, 0.04), mk(3, 'C', 0.3, 0.04), mk(4, 'D', 0.4, 0.08), mk(5, 'E', 0.5, 0.04, 10, 12)]
  const judged = [1, 2, 3, 4, 5].map((id) => ({ id, category: 'sign' as const, importance: id === 4 ? 3 : id === 5 ? 1 : 2, fixed: '', tr: `译${id}` }))
  const cues = signsToCues(blocks, judged, { startIndex: 100 })
  eq('同屏最多 3 条，重要度高的优先（D 进，A/B/C 里挤掉一条）', cues.filter((c) => c.startMs === 0).length, 3)
  eq('重要度 1 的默认不出', cues.some((c) => c.text === 'E'), false)
  eq('index 从指定值接续、带 kind/pos/layout', [cues[0].index, cues[0].kind, typeof cues[0].pos?.x, cues[0].layout], [100, 'sign', 'number', 'below'])
}

console.log('\n写出：')
{
  const cues: Cue[] = [
    { index: 1, startMs: 5000, endMs: 7000, text: 'こんにちは', translation: '你好' },
    { index: 2, startMs: 1000, endMs: 3000, text: '営業中', translation: '营业中', kind: 'sign', pos: { x: 0.6, y: 0.3, w: 0.2, h: 0.05 }, layout: 'below', importance: 2 },
    { index: 3, startMs: 2000, endMs: 4000, text: 'ルール\n守ろう', translation: '规则\n要遵守', kind: 'sign', pos: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, layout: 'box', importance: 3 }
  ]
  const ass = cuesToAss(cues, 'translated')
  eq('ASS 有 Sign / SignBox 两个样式', [ass.includes('Style: Sign,'), ass.includes('Style: SignBox,')], [true, true])
  eq('画面文字按时间排在对白前面、用 \\pos 定位', ass.indexOf('营业中') < ass.indexOf('你好') && /\\pos\(\d+,\d+\)/.test(ass), true)
  eq('盖字用 SignBox、多行换成 \\N', ass.includes('SignBox,,0,0,0,,{\\an5') && ass.includes('规则\\N要遵守'), true)
  const srt = cuesToSrt(cues, (c) => c.translation ?? c.text)
  eq('SRT 画面文字放顶部（{\\an8}），并按时间重新编号', srt.startsWith('1\n00:00:01,000 --> 00:00:03,000\n{\\an8}营业中'), true)
  const original = cuesToAss(cues, 'original')
  eq('导出原文时画面文字出 OCR 原文', original.includes('営業中'), true)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 项不符`)
process.exit(bad === 0 ? 0 : 1)
