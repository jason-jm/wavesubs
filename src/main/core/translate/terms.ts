/**
 * 译名统一：同一个专有名词在一部片里被译成两种写法，观众会以为是两个人。
 *
 * 8B 逐批翻译，批与批之间没有记忆，「ウェイバー」这一批译成「韦伯」、下一批译成「威伯」，
 * 「アインツベルン」在同一部片里出现过「艾因茨贝伦」「艾因兹贝伦」两种。实测 70 部里有 38 部中招。
 *
 * 做法完全是确定性的，不再过模型：拿源文里反复出现的专名（片假名连写、西文大写词）把译文分组，
 * 在这一组译文里找出现得最广的那串汉字当准译名，再把只差一个字的写法改成它。只改这一处，
 * 句子的其余部分一个字不动。
 */
import type { Cue } from '../subtitle/types'

/**
 * 源文里的专名候选：四个字以上的片假名连写，或者**句中**出现的西文大写词。
 * 句首的大写词不算——"What" "They" "Your" 这些常用词也是大写开头，当成人名统一
 * 会把「怎么」改成「什么」，那就不是统一译名而是改意思了。
 */
const KATAKANA_RUN = /[ァ-ヺー]{4,}/g
const LATIN_MIDSENTENCE = /(?<=[a-z,]\s)[A-Z][A-Za-z]{3,}\b/g
/** 译名只认汉字串：夹了标点、数字、假名的都不是一个名字 */
const HAN_RUN = /[一-鿿]{2,8}/g
/**
 * 音译常用字。两种写法只有在**差的那个字两边都是音译字**时才算笔误：
 * 「莎拉／莎蕾」「盖茨纳／盖特纳」是同一个名字的两种写法，
 * 「美军／美国」「单元／单位」「机体／机动」差的是实词，那是两种意思，不能动。
 */
const TRANSLIT = new Set(
  '阿埃艾爱安奥澳巴芭伯柏布策查茨达戴丹道德得蒂迪狄多朵恩尔法菲费佛弗夫盖格戈哥古哈海赫亨侯霍基吉加贾杰洁金卡凯凯科克库拉莱兰朗劳勒雷蕾里莉利列林琳卢鲁伦罗洛马迈曼梅蒙米密莫姆穆娜奈耐内妮尼宁诺欧帕佩皮普齐乔切琼萨塞瑟森莎沙山圣施舒斯司苏索塔泰坦特提汀廷托陀瓦万威韦维魏沃乌西希夏谢辛欣休雅亚扬耶伊因英尤尹约泽扎詹珍朱兹戎喀昂贝波菈黛茜妲玛露丝妮堡登顿姜昆兰梵潘乔诗史泰坦图瓦韦文沃西谢逊亚耶尤宙泽'
)
const isTranslitPair = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i] && !(TRANSLIT.has(a[i]) && TRANSLIT.has(b[i]))) return false
  }
  return true
}
/**
 * 这一处的「林顿」其实是「克林顿」的一截吗？
 * 把跨过它两端的三字窗口拿去数：全片里反复出现的（「克林顿」），说明它属于另一个词，别动。
 */
function partOfCommonWord(text: string, word: string, freq3: Map<string, number>): boolean {
  const han = /^[一-鿿]+$/
  for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) {
    for (let s = Math.max(0, i - 2); s <= i + word.length - 1; s += 1) {
      const win = text.slice(s, s + 3)
      if (win.length < 3 || !han.test(win)) continue
      // 只看真的跨出去的窗口
      if (s >= i && s + 3 <= i + word.length) continue
      if ((freq3.get(win) ?? 0) >= 3) return true
    }
  }
  return false
}

/** 一个专名至少要出现这么多条才值得统一：偶尔出现两次的，少数写法可能才是对的 */
const MIN_CUES = 4
/**
 * 准译名至少要在这么大比例的译文里出现。压得高是关键：真正的译名几乎每一条提到它的译文里都在，
 * 只在一半译文里出现的那串字多半是别的词的一截，拿它去替换会改坏句子。
 */
const MIN_SHARE = 0.8
/** 少数写法只能是少数：占到三成以上说明这是两种都在用的译法，不是笔误 */
const MAX_VARIANT_SHARE = 0.3
const MAX_LEN = 8
/** 一部片里改动超过这个比例就整片不改：说明判据在这部片上跑偏了 */
const MAX_FIX_SHARE = 0.02

function substrings(text: string): Set<string> {
  const out = new Set<string>()
  for (const run of text.match(HAN_RUN) ?? []) {
    for (let len = 2; len <= Math.min(MAX_LEN, run.length); len += 1) {
      for (let i = 0; i + len <= run.length; i += 1) out.add(run.slice(i, i + len))
    }
  }
  return out
}

/** 差一个字：改一个、多一个、少一个 */
export function nearMiss(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    let diff = 0
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff += 1
    return diff === 1
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  for (let i = 0; i < long.length; i += 1) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true
  }
  return false
}

interface Fix {
  /** 源文里的专名，只用来说明这条改动是从哪来的 */
  term: string
  from: string
  to: string
}

/**
 * 把译文里同一专名的少数写法改成多数写法。返回改动清单（诊断用），cues 原地改。
 */
export function unifyTerms(cues: Cue[]): Fix[] {
  const byTerm = new Map<string, Cue[]>()
  for (const c of cues) {
    const tr = c.translation?.trim()
    if (!tr) continue
    const terms = new Set([...(c.text.match(KATAKANA_RUN) ?? []), ...(c.text.match(LATIN_MIDSENTENCE) ?? [])])
    for (const t of terms) {
      const list = byTerm.get(t) ?? []
      list.push(c)
      byTerm.set(t, list)
    }
  }

  // 全片译文里每个三字窗口出现多少次：用来认出「林顿」其实是「克林顿」的一截
  const freq3 = new Map<string, number>()
  for (const c of cues) {
    const tr = c.translation ?? ''
    for (const run of tr.match(HAN_RUN) ?? []) {
      for (let i = 0; i + 3 <= run.length; i += 1) {
        const w = run.slice(i, i + 3)
        freq3.set(w, (freq3.get(w) ?? 0) + 1)
      }
    }
  }

  const before = cues.map((c) => c.translation)
  const fixes: Fix[] = []
  for (const [term, list] of byTerm) {
    if (list.length < MIN_CUES) continue
    // 这串汉字在多少条译文里出现过
    const df = new Map<string, number>()
    for (const c of list) {
      for (const s of substrings(c.translation ?? '')) df.set(s, (df.get(s) ?? 0) + 1)
    }
    // 出现得最广的那串；再往长了取——「贝伦」和「艾因茨贝伦」出现得一样广时要后者
    const maxDf = Math.max(0, ...df.values())
    let canonical = ''
    for (const [s, n] of df) {
      if (n >= maxDf * 0.9 && s.length > canonical.length) canonical = s
    }
    if (canonical.length < 2 || maxDf < Math.max(3, Math.ceil(list.length * MIN_SHARE))) continue

    const pending: Array<{ cue: Cue; variant: string }> = []
    for (const c of list) {
      const tr = c.translation ?? ''
      if (tr.includes(canonical)) continue
      // 这条译文里有没有一个只差一个字的写法
      let variant = ''
      for (const s of substrings(tr)) {
        if (!nearMiss(s, canonical) || s.length <= variant.length) continue
        // 只改音译写法；实词之差是两种意思，不动
        if (!isTranslitPair(s, canonical)) continue
        // 这一处要是另一个常见词的一截就别动，不然「克林顿」会被改成「克林斯」
        if (partOfCommonWord(tr, s, freq3)) continue
        variant = s
      }
      // 画面文字的位置、字号、折行是按当时那份译文算好存在字幕条上的：
      // 换成多一个字的写法会撑破算好的框，所以这一类只接受等长替换
      if (!variant) continue
      if (c.kind === 'sign' && variant.length !== canonical.length) continue
      pending.push({ cue: c, variant })
    }
    // 少数写法得真的是少数
    if (pending.length > list.length * MAX_VARIANT_SHARE) continue
    for (const { cue, variant } of pending) {
      cue.translation = (cue.translation ?? '').split(variant).join(canonical)
      fixes.push({ term, from: variant, to: canonical })
    }
  }
  // 改得太多说明判据在这部片上跑偏了，整片退回去（条数少的片子不设下限没意义，给个 5 条的底）
  if (fixes.length > Math.max(5, cues.length * MAX_FIX_SHARE)) {
    for (const [i, c] of cues.entries()) if (before[i] !== undefined) c.translation = before[i]
    return []
  }
  return fixes
}
