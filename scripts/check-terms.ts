/** 译名统一自检：该统一的统一，不该动的一个字不动。全部用合成数据。 */
import { nearMiss, unifyTerms } from '../src/main/core/translate/terms'
import type { Cue } from '../src/main/core/subtitle/types'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { console.log(`  ✓ ${name}`); return }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}
const cue = (i: number, text: string, translation: string): Cue => ({ index: i, startMs: i * 2000, endMs: i * 2000 + 1800, text, translation })

console.log('差一个字：')
eq('换一个字', nearMiss('莎拉', '莎蕾'), true)
eq('多一个字', nearMiss('莎蕾', '莎蕾伊'), true)
eq('一模一样不算', nearMiss('莎蕾', '莎蕾'), false)
eq('差两个字不算', nearMiss('莎拉', '夏蕾'), false)

console.log('\n统一译名：')
{
  // 片假名专名反复出现，多数译成「莎蕾」，个别译成「莎拉」
  const cues = [
    cue(1, 'シャーレイは元気か', '莎蕾还好吗'),
    cue(2, 'シャーレイと話した', '和莎蕾说过话'),
    cue(3, 'シャーレイの家へ', '去莎蕾家'),
    cue(4, 'シャーレイを待つ', '等莎拉'),
    cue(5, 'シャーレイが来た', '莎蕾来了')
  ]
  const fixes = unifyTerms(cues)
  eq('少数写法改成多数写法', [cues[3].translation, fixes.length], ['等莎蕾', 1])
}
{
  // 句首大写的常用词不是人名：「什么」不许被改成「怎么」
  const cues = [
    cue(1, 'What is this', '这是什么'),
    cue(2, 'What do you mean', '你什么意思'),
    cue(3, 'What happened', '发生了什么'),
    cue(4, 'What now', '现在怎么办'),
    cue(5, 'What a day', '什么日子')
  ]
  eq('句首大写的常用词不当人名', unifyTerms(cues).length, 0)
}
{
  // 实词之差是两种意思，不是笔误
  const cues = [
    cue(1, 'アメリカへ行く', '去美国'),
    cue(2, 'アメリカの映画', '美国的电影'),
    cue(3, 'アメリカに住む', '住在美国'),
    cue(4, 'アメリカ軍が来た', '美军来了'),
    cue(5, 'アメリカを出た', '离开美国')
  ]
  eq('实词之差不动', unifyTerms(cues).length, 0)
}
{
  // 「林顿」是「克林顿」的一截，不许被改成「林斯」
  const cues = [
    cue(1, 'Alan Greenspan said', '艾伦格林斯潘说'),
    cue(2, 'about Greenspan and', '关于格林斯潘'),
    cue(3, 'when Greenspan left', '格林斯潘离开时'),
    cue(4, 'and Greenspan told', '克林顿告诉'),
    cue(5, 'to Greenspan again', '再次对格林斯潘'),
    cue(6, 'Bill Clinton said', '比尔克林顿说'),
    cue(7, 'Bill Clinton again', '比尔克林顿又说'),
    cue(8, 'Clinton and Gore', '克林顿和戈尔')
  ]
  const before = cues.map((c) => c.translation)
  unifyTerms(cues)
  eq('别的词里的一截不动', cues.map((c) => c.translation), before)
}
{
  // 改得太多说明判据跑偏了，整片退回去
  const cues = Array.from({ length: 10 }, (_, i) =>
    cue(i + 1, 'スレッタが来た', i < 4 ? '斯雷塔来了' : '斯莱塔来了')
  )
  const before = cues.map((c) => c.translation)
  unifyTerms(cues)
  eq('少数写法占到三成以上就不动', cues.map((c) => c.translation), before)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 项不符`)
if (bad > 0) process.exit(1)
