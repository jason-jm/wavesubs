/**
 * 编辑器操作的自检矩阵：时间解析、合并拼接、译文过期标记、撤销栈。
 *
 * 这些操作直接改用户的成品字幕，错一处就是静默数据损坏（比如合并把 CJK
 * 文本拼出空格、删除后编号断档），必须逐条钉死。
 */
import {
  deleteAt,
  formatTimeMs,
  insertAfter,
  joinText,
  mergeWithNext,
  parseTimeMs,
  pushUndo,
  UNDO_LIMIT,
  updateCue
} from '../src/renderer/src/lib/editorOps'
import type { EditorCue } from '../src/renderer/src/lib/editorOps'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${name}`)
    return
  }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

console.log('时间解析（parseTimeMs）：')
eq('mm:ss.mmm', parseTimeMs('1:23.456'), 83456)
eq('h:mm:ss', parseTimeMs('01:02:03.450'), 3723450)
eq('纯秒', parseTimeMs('83.4'), 83400)
eq('中文逗号当小数点（输入法顺手打出来的）', parseTimeMs('12，5'), 12500)
eq('乱输入 → null（调用方回退原值）', parseTimeMs('abc'), null)
eq('负数不收', parseTimeMs('-3'), null)
eq('四段拒收', parseTimeMs('1:2:3:4'), null)

console.log('\n时间格式化（formatTimeMs）：')
eq('分钟级', formatTimeMs(83456), '1:23.456')
eq('小时级', formatTimeMs(3723450), '1:02:03.450')
eq('解析↔格式化往返', parseTimeMs(formatTimeMs(5025678)), 5025678)

console.log('\n文本拼接（joinText）：')
eq('拉丁语加空格', joinText('Hello', 'world'), 'Hello world')
eq('CJK 不加空格', joinText('你好', '世界'), '你好世界')
eq('混合以交界处为准', joinText('Hello', '世界'), 'Hello世界')
eq('空侧直接取另一侧', joinText('', 'abc'), 'abc')

const CUES: EditorCue[] = [
  { index: 1, startMs: 0, endMs: 1000, text: 'A', translation: '甲' },
  { index: 2, startMs: 1500, endMs: 2500, text: 'B', translation: '乙' },
  { index: 3, startMs: 3000, endMs: 4000, text: 'C' }
]

console.log('\n编辑（updateCue）：')
{
  const next = updateCue(CUES, 0, { text: 'A2' })
  eq('改原文且有译文 → 标记译文过期', next[0].srcEdited, true)
  eq('不影响别的条', next[1].srcEdited, undefined)
  const fixed = updateCue(next, 0, { translation: '甲二' })
  eq('手动改译文 → 过期标记解除（视为已核对）', fixed[0].srcEdited, undefined)
  const noTrans = updateCue(CUES, 2, { text: 'C2' })
  eq('没有译文的条改原文不标过期', noTrans[2].srcEdited, undefined)
  eq('原数组不被改动（不可变）', CUES[0].text, 'A')
}

console.log('\n插入（insertAfter）：')
{
  const next = insertAfter(CUES, 0)
  eq('条数 +1、编号连续', next.map((c) => c.index), [1, 2, 3, 4])
  eq('起点接上一条终点', next[1].startMs, 1000)
  eq('终点不越过下一条起点', next[1].endMs <= 1500, true)
  eq('新条标记待翻译', next[1].srcEdited, true)
}

console.log('\n删除（deleteAt）：')
{
  const next = deleteAt(CUES, 1)
  eq('条数 -1、编号重排', next.map((c) => c.index), [1, 2])
  eq('删的是中间那条', next.map((c) => c.text), ['A', 'C'])
}

console.log('\n合并（mergeWithNext）：')
{
  const next = mergeWithNext(CUES, 0)
  eq('时间取并集', { s: next[0].startMs, e: next[0].endMs }, { s: 0, e: 2500 })
  eq('原文拼接', next[0].text, 'A B')
  eq('两边都有译文 → 译文拼接', next[0].translation, '甲乙')
  eq('编号重排', next.map((c) => c.index), [1, 2])

  const half = mergeWithNext(
    [
      { index: 1, startMs: 0, endMs: 1000, text: 'A', translation: '甲' },
      { index: 2, startMs: 1500, endMs: 2500, text: 'B' }
    ],
    0
  )
  eq('只有一边有译文 → 保留那份但标过期', { t: half[0].translation, stale: half[0].srcEdited }, { t: '甲', stale: true })
  eq('末条合并是空操作', mergeWithNext(CUES, 2), CUES)
}

console.log('\n撤销栈（pushUndo）：')
{
  let stack: EditorCue[][] = []
  for (let i = 0; i < UNDO_LIMIT + 10; i += 1) stack = pushUndo(stack, CUES)
  eq(`容量封顶在 ${UNDO_LIMIT}`, stack.length, UNDO_LIMIT)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
