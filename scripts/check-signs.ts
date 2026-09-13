/**
 * 画面文字模块自检：几何与统计规则（分组 / 跟踪 / 名单时段 / 烧录字幕带）、判别对齐锚、排版取舍、写出格式。
 * 全部用合成数据，不跑 OCR 也不跑模型；判别用假 chat 模拟 8B 的串行毛病。
 */
import { buildSignBlocks, creditWindows, dialogueLinesAt, dialogueSafeBottom, groupLines, judgeSigns, leftoverScript, measureText, signsToCues, trackBlocks, textSimilarity, wrapToWidth } from '../src/main/core/signs'
import type { OcrBox, OcrFrame, SignBlock, SignJudgement } from '../src/main/core/signs'
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
  {
    // 片尾名单：两段职位词之间夹 10 秒只有演员名的帧，应并成一段而不是留出缝
    const roll: OcrFrame[] = []
    for (let i = 0; i < 20; i += 1) roll.push({ i, boxes: [box('監督 山田太郎', 0.3, 0.4, 0.4, 0.05)] })
    for (let i = 20; i < 30; i += 1) roll.push({ i, boxes: [box('Sergei Mezentsev', 0.3, 0.4, 0.4, 0.05)] })
    for (let i = 30; i < 50; i += 1) roll.push({ i, boxes: [box('音楽 田中一郎', 0.3, 0.4, 0.4, 0.05)] })
    const w = creditWindows(roll, 1)
    eq('名单中间只有演员名的一段不会把时段切开', w.length, 1)
  }
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
  function mk(id: number, text: string, y: number, h: number, start = 0, end = 5, w = 0.3): SignBlock {
    return { id, text, startSec: start, endSec: end, frames: 5, conf: 0.9, box: { x: 0.35, y, w, h } }
  }
  function sign(id: number, tr: string, importance = 2): SignJudgement {
    return { id, category: 'sign', importance, fixed: '', tr }
  }

  // 单行小招牌：贴在原文正下方
  {
    const cues = signsToCues([mk(1, '営業中', 0.3, 0.04)], [sign(1, '营业中')])
    eq('单行贴下方', [cues[0].layout, cues[0].anchor!.y > 0.34 && cues[0].anchor!.y < 0.42], ['below', true])
  }
  // 原文占一大块（整屏界面）：盖在原文上
  {
    const cues = signsToCues([mk(1, 'ルール\n守ろう', 0.15, 0.5, 0, 5, 0.5)], [sign(1, '规则\n要遵守')])
    eq('占满一大块才盖字', cues[0].layout, 'box')
  }
  // 同样是多行，但只占一小块：贴在旁边，不遮原文
  {
    const cues = signsToCues([mk(1, 'ルール\n守ろう', 0.3, 0.12)], [sign(1, '规则\n要遵守')])
    eq('小块多行不盖字，贴在旁边', cues[0].layout, 'below')
  }
  // 读不完的不出：一段几秒的画面配上百来字的译文，观众来不及读，还糊满画面
  {
    const long = '这是一段非常长的译文用来模拟整版报纸被逐段译出来的情况观众根本读不完也会把画面糊住所以不应该出片'
    eq('几秒钟配上百字的译文不出', signsToCues([mk(1, 'x', 0.3, 0.05, 0, 3)], [sign(1, long)]).length, 0)
    eq('同样长度给足时间就出', signsToCues([mk(1, 'x', 0.2, 0.05, 0, 20)], [sign(1, long)]).length, 1)
  }
  // 贴字时绕开画面上别处的原文
  {
    const blocks = [mk(1, 'あ', 0.30, 0.04), mk(2, 'い', 0.36, 0.06)]
    const cues = signsToCues(blocks, [sign(1, '甲'), sign(2, '乙')])
    const first = cues.find((c) => c.text === 'あ')!
    const m = measureText(first.translation!, first.fontSize!)
    const top = first.anchor!.y - m.h / 2
    const bottom = first.anchor!.y + m.h / 2
    eq('译文不落在另一段原文的框里', top >= 0.42 || bottom <= 0.36 + 1e-6, true)
  }

  // 同一时刻两处原文译法相同：只出一条
  {
    const cues = signsToCues([mk(1, 'ABC', 0.2, 0.05), mk(2, 'ABCD', 0.5, 0.05)], [sign(1, '相同译文'), sign(2, '相同译文')])
    eq('同屏重复的译文只出一条', cues.length, 1)
  }
  // 译文和原文一样：不出这一条
  {
    eq('英文照抄的不出', signsToCues([mk(1, 'OUTDOOR COOKING', 0.3, 0.05)], [sign(1, 'OUTDOOR COOKING')]).length, 0)
    eq('压根没翻的不出', signsToCues([mk(1, '営業中', 0.3, 0.05)], [sign(1, '')]).length, 0)
  }
  // 底部的招牌 + 同时有两行对白：必须避开对白占用的高度
  {
    const speech = [{ startMs: 0, endMs: 5000, text: '', translation: '这是一句相当长的对白，长到在一行里放不下，必须折成两行才显示得完的那种程度' }]
    const cues = signsToCues([mk(1, 'あちら', 0.86, 0.05)], [sign(1, '在那边')], { speech })
    const safe = dialogueSafeBottom(dialogueLinesAt(speech, 0, 5000))
    const bottom = cues[0].anchor!.y + measureText('在那边', cues[0].fontSize!).h / 2
    eq('对白占两行', dialogueLinesAt(speech, 0, 5000), 2)
    eq('底部的画面文字挪开、不进对白区', [cues[0].layout, bottom <= safe + 1e-6], ['top', true])
  }
  // 同样位置、同一时刻没有对白：就地贴下方即可，不必挪走
  {
    const cues = signsToCues([mk(1, 'あちら', 0.78, 0.05)], [sign(1, '在那边')])
    eq('没有对白时下方还放得下就不挪', cues[0].layout, 'below')
  }
  // 盖字时原文框窄、译文长：缩字号而不是把底框撑到旁边
  {
    const cues = signsToCues([mk(1, '和\n和\n和', 0.2, 0.6, 0, 5, 0.3)], [sign(1, '这是一句很长很长的译文占满了整行')])
    eq('确实走了盖字', cues[0].layout, 'box')
    const size = measureText(cues[0].translation!, cues[0].fontSize!)
    eq('底框不超过原文框的 1.25 倍宽（或到下限字号为止）', size.w <= Math.max(0.3 * 1.25, 0.18) + 1e-6 || cues[0].fontSize === 22, true)
  }
  // 同屏多条：不许互相叠
  {
    const blocks = [mk(1, 'A', 0.80, 0.05), mk(2, 'B', 0.83, 0.05), mk(3, 'C', 0.86, 0.05)]
    const judged = [sign(1, '甲', 3), sign(2, '乙', 3), sign(3, '丙', 3)]
    const speech = [{ startMs: 0, endMs: 5000, text: '', translation: '一句对白' }]
    const cues = signsToCues(blocks, judged, { speech })
    const rects = cues.map((c) => {
      const m = measureText(c.translation!, c.fontSize!)
      return { x: c.anchor!.x - m.w / 2, y: c.anchor!.y - m.h / 2, w: m.w, h: m.h }
    })
    const hit = rects.some((a, i) => rects.some((b, k) => k > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h))
    eq('同屏三条互不重叠', hit, false)
    const safe = dialogueSafeBottom(1)
    eq('三条都不进对白区', rects.every((r) => r.y + r.h <= safe + 1e-6), true)
  }
  // 取舍仍然生效
  {
    const blocks = [mk(1, 'A', 0.1, 0.04), mk(2, 'B', 0.2, 0.04), mk(3, 'C', 0.3, 0.04), mk(4, 'D', 0.4, 0.08), mk(5, 'E', 0.5, 0.04, 10, 12)]
    const judged = [sign(1, '译1'), sign(2, '译2'), sign(3, '译3'), sign(4, '译4', 3), sign(5, '译5', 1)]
    const cues = signsToCues(blocks, judged, { startIndex: 100 })
    eq('同屏最多 3 条', cues.filter((c) => c.startMs === 0).length, 3)
    eq('重要度 1 的默认不出', cues.some((c) => c.text === 'E'), false)
    eq('index 从指定值接续、带 kind/pos/anchor/fontSize', [cues[0].index, cues[0].kind, typeof cues[0].anchor?.x, typeof cues[0].fontSize], [100, 'sign', 'number', 'number'])
  }
}

{
  // 一整段中日韩文字里夹着空格时，整段会变成一个断不开的「词」——必须能逐字切
  const long = '95); ' + '中心经济政策研究所所长他于1983年创立以及巴黎高等社会科学研究学院自1978年起的主任研究员他是一位罗德学者'
  const wrapped = wrapToWidth(long, 22, 0.6)
  const widest = Math.max(...wrapped.split('\n').map((l) => measureText(l, 22).w))
  eq('超长的无空格段落会被逐字折行', widest <= 0.6 + 1e-6, true)
}

console.log('\n写出：')
{
  const cues: Cue[] = [
    { index: 1, startMs: 5000, endMs: 7000, text: 'こんにちは', translation: '你好' },
    { index: 2, startMs: 1000, endMs: 3000, text: '営業中', translation: '营业中', kind: 'sign', pos: { x: 0.6, y: 0.3, w: 0.2, h: 0.05 }, layout: 'below', anchor: { x: 0.7, y: 0.38 }, fontSize: 40, importance: 2 },
    { index: 3, startMs: 2000, endMs: 4000, text: 'ルール\n守ろう', translation: '规则\n要遵守', kind: 'sign', pos: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, layout: 'box', anchor: { x: 0.25, y: 0.25 }, fontSize: 44, importance: 3 }
  ]
  const ass = cuesToAss(cues, 'translated')
  eq('ASS 有 Sign / SignBox 两个样式', [ass.includes('Style: Sign,'), ass.includes('Style: SignBox,')], [true, true])
  eq('画面文字按时间排在对白前面、用 \\pos 定位', ass.indexOf('营业中') < ass.indexOf('你好') && /\\pos\(\d+,\d+\)/.test(ass), true)
  eq('盖字用 SignBox、多行换成 \\N', ass.includes('SignBox,,0,0,0,,{\\an5') && ass.includes('规则\\N要遵守'), true)
  eq('用排好的 anchor/fontSize 定位', ass.includes('\\pos(1344,410)\\fs40') && ass.includes('\\pos(480,270)\\fs44'), true)
  const srt = cuesToSrt(cues, (c) => c.translation ?? c.text)
  eq('SRT 画面文字放顶部（{\\an8}），并按时间重新编号', srt.startsWith('1\n00:00:01,000 --> 00:00:03,000\n{\\an8}营业中'), true)
  const original = cuesToAss(cues, 'original')
  eq('导出原文时画面文字出 OCR 原文', original.includes('営業中'), true)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 项不符`)
process.exit(bad === 0 ? 0 : 1)
