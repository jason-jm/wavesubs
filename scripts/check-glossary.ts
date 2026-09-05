/**
 * 术语表的注入与过滤逻辑自检。
 *
 * 两条底线：
 * 1. 没配术语表的用户，提示词必须与旧版**逐字节相同**——这是 PROMPT_REV 不升版的
 *    前提；破坏它等于让全体用户的译文缓存静默失效。
 * 2. 只注入「这批文本里真出现的」条目——全量注入会让模型把没出现的人名带进译文。
 */
import { applicableGlossary, buildSystemPrompt, buildUserContent } from '../src/main/core/translate/prompt'

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

console.log('命中过滤（applicableGlossary）：')
const ENTRIES = [
  { from: 'Lena', to: '蕾娜' },
  { from: 'Shin', to: '辛' },
  { from: 'ギアーデ', to: '基亚德' }
]
eq(
  '只保留文本里出现的条目',
  applicableGlossary(ENTRIES, ['Where is Lena now?']),
  [{ from: 'Lena', to: '蕾娜' }]
)
eq(
  '拉丁词不区分大小写（句首大写、全大写都算命中）',
  applicableGlossary([{ from: 'lena', to: '蕾娜' }], ['LENA!']),
  [{ from: 'lena', to: '蕾娜' }]
)
eq(
  'CJK 子串命中',
  applicableGlossary(ENTRIES, ['ギアーデ帝国の軍だ']),
  [{ from: 'ギアーデ', to: '基亚德' }]
)
eq('都没出现 → 空', applicableGlossary(ENTRIES, ['Nothing related here']), [])
eq('空表 → 空', applicableGlossary([], ['Lena']), [])
eq('无文本 → 空', applicableGlossary(ENTRIES, []), [])
{
  const many = Array.from({ length: 60 }, (_, i) => ({ from: `term${i}`, to: `译${i}` }))
  const texts = [many.map((e) => e.from).join(' ')]
  eq('全命中时按上限截断到 40 条', applicableGlossary(many, texts).length, 40)
}

console.log('\n提示词注入（buildSystemPrompt）：')
const bare = buildSystemPrompt({ sourceLanguage: 'ja', targetLanguage: 'zh' })
const withEmpty = buildSystemPrompt({ sourceLanguage: 'ja', targetLanguage: 'zh', glossary: [] })
const withTerms = buildSystemPrompt({
  sourceLanguage: 'ja',
  targetLanguage: 'zh',
  glossary: [{ from: 'ギギ', to: '吉吉' }]
})
eq('空表提示词与不传完全一致（PROMPT_REV 不升版的前提）', withEmpty, bare)
eq('不带术语表时无注入段', bare.includes('术语对照'), false)
eq('带术语表时包含指定译法', withTerms.includes('「ギギ」必须译为「吉吉」'), true)
eq(
  '用户内容不受术语表影响（注入只发生在系统提示词）',
  buildUserContent([{ index: 1, text: 'こんにちは' }], {
    targetLanguage: 'zh',
    glossary: [{ from: 'ギギ', to: '吉吉' }]
  }),
  buildUserContent([{ index: 1, text: 'こんにちは' }], { targetLanguage: 'zh' })
)

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
