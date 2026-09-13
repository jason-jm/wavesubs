/**
 * 把逐帧的 OCR 文本框整理成「一段画面文字」：同帧按行分组 → 跨帧跟踪 → 启发式过滤。
 *
 * 全部是几何和统计，不碰模型。三件事必须在这里做而不能交给模型：
 * 1. 片头片尾名单：8B 模型曾把片尾赞助名单 30 条全判成画面文字；职位词密度一扫就干净。
 * 2. 烧录字幕：模型判不准（曾把 37 条聊天气泡当字幕），而烧录字幕在几何上极其规整——
 *    全片固定在下半屏同一条带里、水平居中、与人声重叠。两部真烧录片实测占比 38%/39%，
 *    无烧录的片最高 8%。
 * 3. 置信度与闪现：多帧持续出现本身就是「真有字」的证据，手写体艺术字置信度常年 0.3。
 */
import type { SpeechRegion } from '../asr/vad'
import type { OcrBox, OcrFrame, SignBlock, SignBlocksResult } from './types'

const norm = (s: string): string => s.normalize('NFKC').replace(/[\s　]+/g, '').toLowerCase()

/** 字符二元组 Dice 相似度：短文本够用，比编辑距离快 */
export function textSimilarity(a: string, b: string): number {
  const na = norm(a)
  const nb = norm(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const grams = (s: string): Map<string, number> => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const ga = grams(na)
  const gb = grams(nb)
  let inter = 0
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0)
  return (2 * inter) / (na.length - 1 + nb.length - 1)
}

/** 至少要有一个字母/汉字/假名：纯数字、纯符号（「60」「¥980」「100%」）不值得单独出一条 */
const HAS_TEXT = /\p{L}/u
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u

/** 同一帧里上下相邻（间距 < 0.8 倍行高）且水平重叠的框并成多行一块：一张便签、一段告示只算一条 */
export function groupLines(boxes: OcrBox[]): OcrBox[] {
  // 注音（振り仮名）：只有假名、字高不到旁边汉字行六成、紧贴在它上方的小字。读出来只会变成「斯克的」这种音译，先剔掉
  const isFurigana = (b: OcrBox): boolean =>
    KANA_ONLY.test(b.t.trim()) &&
    boxes.some((o) => {
      if (o === b || b.h >= 0.6 * o.h) return false
      const xOverlap = Math.min(o.x + o.w, b.x + b.w) - Math.max(o.x, b.x)
      const gap = o.y - (b.y + b.h)
      return xOverlap > 0.3 * Math.min(o.w, b.w) && gap > -0.3 * o.h && gap < 0.5 * o.h
    })
  const sorted = boxes.filter((b) => !isFurigana(b)).sort((a, b) => a.y - b.y)
  const groups: OcrBox[][] = []
  for (const b of sorted) {
    const g = groups.find((grp) => {
      const last = grp[grp.length - 1]
      const gap = b.y - (last.y + last.h)
      const xOverlap = Math.min(last.x + last.w, b.x + b.w) - Math.max(last.x, b.x)
      const hRatio = Math.max(b.h, last.h) / Math.max(0.001, Math.min(b.h, last.h))
      return gap > -0.3 * last.h && gap < 0.8 * Math.max(b.h, last.h) && xOverlap > 0.3 * Math.min(b.w, last.w) && hRatio < 2.2
    })
    if (g) g.push(b)
    else groups.push([b])
  }
  return groups.map((g) => {
    if (g.length === 1) return g[0]
    const x = Math.min(...g.map((b) => b.x))
    const y = Math.min(...g.map((b) => b.y))
    const x2 = Math.max(...g.map((b) => b.x + b.w))
    const y2 = Math.max(...g.map((b) => b.y + b.h))
    return { t: g.map((b) => b.t).join('\n'), c: g.reduce((n, b) => n + b.c, 0) / g.length, x, y, w: x2 - x, h: y2 - y }
  })
}

/** 职位词：只有它们算名单信号。全大写、罗马字姓名单独出现时也可能是杂志封面、商标，只用来扩边 */
const CREDIT_VOCAB = /監督|演出|作画|撮影|制作|製作|協力|プロデュース|プロデューサー|脚本|音楽|編集|美術|色彩|原作|音響|録音|効果|仕上|背景|設計|デザイン|キャラクター|アニメーション|主題歌|挿入歌|作詞|作曲|編曲|出演|配給|宣伝|著作|©(?=.{4,})|株式会社|Co\.,? ?Ltd|Inc\.|Executive|Producer|Produced|Director|Animation|Studio|Design|Music|Editor|Photography|Sound|Written|Created|Presents|Production|Cast|Starring|Copyright|Screenplay|Composer|Supervis|Opening Theme|Ending Theme|Theme Song|Lyrics|Arrangement|Vocal|Performed|Original Story|Script|Key Animation|Background Art|Color Design|Recording|Mixing|Assistant|Chief|导演|监制|编剧|摄影|剪辑|美术|配乐|制片|出品|发行|主演|领衔主演|友情出演|演员表|감독|각본|촬영|편집|음악|제작|출연/i
const LATIN_NAME = /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/
const ALLCAPS = /^[A-Z][A-Z .'&-]{3,}$/
/** 日文/中文/韩文的人名写法：姓和名之间留一个空格（「高橋 聰」「入野 自由」），名单里一整排都长这样 */
const CJK_NAME = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}ー]{1,5}[ 　]+[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}ー]{1,5}$/u
/**
 * 光秃秃一个名字的样子，没有数字、没有标点（「→」是 OCR 把「一」读坏的常客）。
 * 中日韩名字两到五个字，十二字足够；西文全名带姓氏和连字符能到二十几
 *（「Anamaria VARTOLOMEI」19 字），所以纯西文的放宽到 24。
 */
const BARE_NAME_CJK = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}\p{Script=Hangul}\p{Script=Latin}ー・·→←\-–—.　 ]{2,12}$/u
const BARE_NAME_LATIN = /^[\p{Script=Latin}·→←\-–—.' ]{2,24}$/u
const BARE_NAME = { test: (t: string): boolean => BARE_NAME_LATIN.test(t) || BARE_NAME_CJK.test(t) }
/**
 * 助词、虚词、句末标点：有这些就是一句话，不是名字。
 * 中文那几个是后补的——「贴底的一行字幕」没有日文助词也没有标点，
 * 光看「短、全汉字」会被当成人名吸进名单时段。
 */
const SENTENCE =
  /(の|は|を|が|に|へ|と|で|も|から|まで|って|です|ます|した)|(的|了|着|吗|呢|吧|把|被|让|从|向|对|给|我|你|他|她|们|这|那|就|很)|[。！？、「」『』…]/
const isNameLine = (t: string): boolean => {
  const s = t.trim()
  return s !== '' && BARE_NAME.test(s) && !SENTENCE.test(s)
}

/**
 * 名单时段：10 秒滑窗里「含职位词的帧」≥40% 的时段整段算名单（片头名单一次只出一两个名字，
 * 逐帧看很稀疏，得看密度），再把前后只剩姓名的帧吸进来。
 */
export function creditWindows(frames: OcrFrame[], fps: number): Array<[number, number]> {
  if (frames.length === 0) return []
  const roleFrame = new Map<number, boolean>()
  const nameFrame = new Map<number, boolean>()
  for (const f of frames) {
    roleFrame.set(f.i, f.boxes.some((b) => CREDIT_VOCAB.test(b.t)))
    nameFrame.set(
      f.i,
      f.boxes.some((b) => LATIN_NAME.test(b.t.trim()) || ALLCAPS.test(b.t.trim()) || CJK_NAME.test(b.t.trim()))
    )
  }
  const maxI = Math.max(...frames.map((f) => f.i))
  const win = Math.max(1, Math.round(10 * fps))
  const dense = new Set<number>()
  for (let i = 0; i <= maxI; i += 1) {
    let c = 0
    for (let k = i; k < i + win && k <= maxI; k += 1) if (roleFrame.get(k)) c += 1
    if (c >= 0.3 * win) for (let k = i; k < i + win && k <= maxI; k += 1) dense.add(k)
  }
  // 一次往外长一帧，长到相邻帧不再是人名为止。名单滚动时职位词会有十几秒的空档（一整屏都是演员名），
  // 只长三帧的话缝里的名字会被当成画面文字译出来
  for (let pass = 0; pass < 40; pass += 1) {
    for (const i of [...dense]) {
      for (const k of [i - 1, i + 1]) if (k >= 0 && k <= maxI && !dense.has(k) && nameFrame.get(k)) dense.add(k)
    }
  }
  /**
   * 声優表：片尾里「角色名／声優名」成排出现的那一段，一个职位词都没有，密度规则看不见它。
   * 从已经认出来的名单时段往外一秒一秒长，整帧每一行都是光秃秃的名字才继续。
   * 名单和声優表之间常常空着几秒（名单在换页），所以按「整段」吸收而不是逐帧往外长：
   * 整段每一行都是名字、而且离已认出的名单时段不到 30 秒，就并进去。
   * 带助词或标点的行不算名字——「次回 正義の在処」「第2回「佐殿の腹」」是要给观众看的预告标题。
   *
   * 只在片头片尾一成五的范围内扩：纪录片的人物名牌写着「Chief Economist」「Managing Director」，
   * 职位词密度规则本来就会在片中误判出一堆名单时段，再往外扩就会把名牌本身吃掉
   *（《监守自盗》实测覆盖从 1941 秒涨到 2476 秒，保留块数 1254 → 953）。
   */
  const lineOf = new Map<number, string[]>()
  for (const f of frames) lineOf.set(f.i, f.boxes.flatMap((b) => b.t.split('\n')))
  /** 整帧每一行都是名字 */
  const castFrame = (i: number): boolean => {
    const lines = lineOf.get(i) ?? []
    return lines.length > 0 && lines.every(isNameLine)
  }
  // 紧邻才吸收：30 秒的口子太大，会把片头名单之前的招牌也吃进去
  //（《摇曳露营》1:11 的社团招牌离片头名单 21 秒）。声優表和制作名单之间通常只空几秒。
  const GAP = 10
  const MIN_RUN = 3
  const HEAD_TAIL = 0.15
  const nearEdge = (i: number): boolean => i <= maxI * HEAD_TAIL || i >= maxI * (1 - HEAD_TAIL)

  // 把「整帧都是名字」的帧切成一段段，整段整段地吸收：逐帧往外长对空档长度太敏感
  //（Fate/Zero 的声優表和制作名单之间空了 9 秒，按帧扩就停在那儿了）。
  // 判据和「相隔不到 30 秒的两段名单并成一段」是同一条。
  const runs: Array<[number, number]> = []
  for (let i = 0; i <= maxI; i += 1) {
    if (!castFrame(i) || dense.has(i)) continue
    const start = i
    while (i + 1 <= maxI && castFrame(i + 1)) i += 1
    runs.push([start, i])
  }
  // 只吸收一轮，拿吸收前的时段做判据：允许链式的话，一段吸进来变成名单、
  // 又把下一段拉进来，《星之声》的片尾时段会从 24:01 一路吃到 21:13，丢掉两分钟正文
  const before = new Set(dense)
  for (const [a, b] of runs) {
    if (b - a + 1 < MIN_RUN) continue
    if (!nearEdge(a) || !nearEdge(b)) continue
    let touches = false
    for (let k = Math.max(0, a - GAP); k <= Math.min(maxI, b + GAP) && !touches; k += 1) {
      if (before.has(k)) touches = true
    }
    if (!touches) continue
    for (let k = a; k <= b; k += 1) dense.add(k)
  }

  const windows: Array<[number, number]> = []
  let start = -1
  for (let i = 0; i <= maxI + 1; i += 1) {
    if (dense.has(i)) {
      if (start < 0) start = i
    } else if (start >= 0) {
      windows.push([start / fps, i / fps])
      start = -1
    }
  }
  // 相隔不到 30 秒的两段并成一段：片尾名单是连续滚动的，中间几秒只出演员名（没有职位词）会把它切开，
  // 缝里的名字就会被当成画面文字译出来
  const merged: Array<[number, number]> = []
  for (const w of windows) {
    const last = merged[merged.length - 1]
    if (last && w[0] - last[1] <= 30) last[1] = w[1]
    else merged.push([...w] as [number, number])
  }
  return merged
}

interface Live extends SignBlock {
  lastFrame: number
  occ: OcrBox[]
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * 跨帧跟踪：文本相似（≥0.6）且位置相近的框接到同一块上，两帧没再出现就收工。
 * 文本取「置信度加权出现最多」的写法，框取各维中位数。
 */
export function trackBlocks(frames: OcrFrame[], fps: number): SignBlock[] {
  const live: Live[] = []
  const done: Live[] = []
  let nextId = 1
  for (const fr of frames) {
    const t = fr.i / fps
    const used = new Set<Live>()
    for (const b of fr.boxes) {
      let best: Live | null = null
      let bestScore = 0
      for (const L of live) {
        if (used.has(L) || fr.i - L.lastFrame > 2) continue
        const sim = textSimilarity(L.text, b.t)
        if (sim < 0.6) continue
        const dx = Math.abs(L.box.x + L.box.w / 2 - (b.x + b.w / 2))
        const dy = Math.abs(L.box.y + L.box.h / 2 - (b.y + b.h / 2))
        if (dx > Math.max(0.08, L.box.w) || dy > Math.max(0.05, L.box.h * 2)) continue
        const score = sim - (dx + dy) / 4
        if (score > bestScore) {
          best = L
          bestScore = score
        }
      }
      if (best) {
        best.lastFrame = fr.i
        best.endSec = t + 1 / fps
        best.frames += 1
        best.occ.push(b)
        used.add(best)
      } else {
        const L: Live = {
          id: nextId++, text: b.t, startSec: t, endSec: t + 1 / fps, frames: 1, conf: b.c,
          box: { x: b.x, y: b.y, w: b.w, h: b.h }, lastFrame: fr.i, occ: [b]
        }
        live.push(L)
        used.add(L)
      }
    }
    for (let i = live.length - 1; i >= 0; i -= 1) {
      if (fr.i - live[i].lastFrame > 2) {
        done.push(live[i])
        live.splice(i, 1)
      }
    }
  }
  done.push(...live)
  return mergeJitter(done.sort((a, b) => a.startSec - b.startSec).map((L) => {
    const tally = new Map<string, number>()
    for (const o of L.occ) tally.set(o.t, (tally.get(o.t) ?? 0) + o.c)
    const text = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
    return {
      id: L.id, text, startSec: L.startSec, endSec: L.endSec, frames: L.frames,
      conf: L.occ.reduce((n, o) => n + o.c, 0) / L.occ.length,
      box: { x: median(L.occ.map((o) => o.x)), y: median(L.occ.map((o) => o.y)), w: median(L.occ.map((o) => o.w)), h: median(L.occ.map((o) => o.h)) }
    }
  }))
}

/**
 * 同一块字被 OCR 每帧读得不太一样（「СКОРАЯ МЕДИЦИНСКАЯ」一会儿少一个词、招牌被人挡住半秒），
 * 跟踪时按文本相似度 0.6 卡不住，就被拆成好几块：观众看到的是同一块招牌的译名一跳一跳地换。
 * 收尾再并一次：位置基本重合、前后挨着、文字八成像，就当同一块，留读得更稳的那份文本。
 */
function mergeJitter(blocks: SignBlock[]): SignBlock[] {
  const out: SignBlock[] = []
  for (const b of blocks) {
    const prev = out.find((m) => {
      if (b.startSec - m.endSec > 2 || b.startSec < m.startSec) return false
      const ix = Math.max(0, Math.min(m.box.x + m.box.w, b.box.x + b.box.w) - Math.max(m.box.x, b.box.x))
      const iy = Math.max(0, Math.min(m.box.y + m.box.h, b.box.y + b.box.h) - Math.max(m.box.y, b.box.y))
      const inter = ix * iy
      const union = m.box.w * m.box.h + b.box.w * b.box.h - inter
      if (union <= 0 || inter / union < 0.5) return false
      return textSimilarity(m.text, b.text) >= 0.75
    })
    if (!prev) {
      out.push(b)
      continue
    }
    // 读到的帧数多的那份文本更可信
    if (b.frames > prev.frames) {
      prev.text = b.text
      prev.box = b.box
    }
    prev.endSec = Math.max(prev.endSec, b.endSec)
    prev.frames += b.frames
    prev.conf = Math.max(prev.conf, b.conf)
  }
  return out
}

/** 整条流水线：分组 → 跟踪 → 名单/置信度/闪现 → 人声重叠 → 烧录字幕带 */
/**
 * 去掉颜文字。短信、聊天气泡里的 (´ｪ｀)、(*´ｪ｀)ノシ 被 OCR 读成一串怪符号，
 * 模型会当成人名硬译出来（「艾莉」「艾莉诺诗」），还带出一堆不配对的括号。
 * 认括号里带颜文字专用符号的短串——(FOB13)、(金) 这种不带符号的正常括号不动。
 */
const KAOMOJI_MARK = /[*＊´｀'’”"^＾~〜ωДд・･ﾟ゚°_;；∀☆★＞＜><\\\/|｜]/
export function stripKaomoji(text: string): string {
  const out = text
    .replace(/[(（][^()（）\n]{0,12}[)）][ノシﾉｼっッ~〜ー\s]*/g, (m) => (KAOMOJI_MARK.test(m) ? '' : m))
    // 括号压根没闭合、后面只剩一小截：OCR 把颜文字读坏了，整截去掉（「（エリ？」「（*”エリノシ」）
    .replace(/[(（]([^()（）\n]{0,8})$/gm, (m, inner: string) => (KAOMOJI_MARK.test(m) || inner.length <= 5 ? '' : m))
    .replace(/[ \t]{2,}/g, ' ')
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, a) => l !== '' || (i > 0 && i < a.length - 1))
    .join('\n')
    .trim()
}

export function buildSignBlocks(
  frames: OcrFrame[],
  fps: number,
  regions: SpeechRegion[] | null
): SignBlocksResult {
  const credits = creditWindows(frames, fps)
  // 颜文字要在跟踪之前去掉：同一个 (*´ｪ｀)ノシ 每帧被 OCR 读坏的样子都不一样，
  // 留着的话同一条聊天气泡会被拆成三四块，译文跟着一跳一跳
  const cleaned = frames.map((f) => ({ i: f.i, boxes: f.boxes.map((b) => ({ ...b, t: stripKaomoji(b.t) })).filter((b) => b.t !== '') }))
  const grouped = cleaned.map((f) => ({ i: f.i, boxes: groupLines(f.boxes) }))
  const blocks = trackBlocks(grouped, fps)

  for (const b of blocks) {
    const clean = norm(b.text)
    const dur = b.endSec - b.startSec
    const inCredits = credits.some(([s, e]) => Math.min(b.endSec, e) - Math.max(b.startSec, s) >= 0.7 * dur)
    if (!HAS_TEXT.test(clean)) b.drop = 'no-letters'
    else if (inCredits) b.drop = 'credits'
    else if (b.conf < 0.35 && b.frames < 3) b.drop = 'low-conf'
    else if (b.box.h < 0.012) b.drop = 'tiny'
    else if (b.frames === 1 && b.conf < 0.7) b.drop = 'flash'
    else if (clean.length === 1 && !CJK.test(clean)) b.drop = 'single-char'
  }

  // 密集小字：军用地图上的番号、书架上的一排书脊、报纸版面里的零碎小字——
  // 一屏上二十来块、块块都很小，那是画面的纹理，不是给观众逐条读的。
  // 只丢掉和周围一样小的；明显比周围大的那一两块留着（杂物堆里真有一块招牌时不至于连它一起丢）。
  // 实测：军用地图 29 块 / 中位面积 0.3%，书架 16 块 / 0.9%；
  // 手机界面 8 块 / 2.4%、菜谱封面 7 块 / 1.9%、聊天气泡都在这条线以上。
  const CLUTTER_MIN = 10
  const CLUTTER_AREA = 0.01
  {
    const area = (b: SignBlock): number => b.box.w * b.box.h
    const live = blocks.filter((b) => !b.drop)
    const times = new Set<number>()
    for (const b of live) for (let t = Math.floor(b.startSec); t < b.endSec; t += 1) times.add(t)
    // 先把该丢的都圈出来再统一丢：边算边丢的话，前一秒丢掉十几块会让后一秒的块数掉到门槛以下，
    // 同一张地图上晚出现的那几块就漏网了
    const clutter = new Set<SignBlock>()
    for (const t of times) {
      const on = live.filter((b) => b.startSec <= t && t < b.endSec)
      if (on.length < CLUTTER_MIN) continue
      const sorted = on.map(area).sort((x, y) => x - y)
      const median = sorted[Math.floor(sorted.length / 2)]
      if (median >= CLUTTER_AREA) continue
      for (const b of on) if (area(b) < median * 3) clutter.add(b)
    }
    for (const b of clutter) b.drop = 'clutter'
  }

  // 布景道具：同一块门牌在不同场景里反复入镜（《帝国的毁灭》地堡走廊的「NOTAUSGANG」
  // 在 2.5 小时里出现五次，相隔 4～32 分钟）。第一次之后观众已经知道那是什么了，
  // 再翻五遍只是占地方。台标规则按位置做键，摄影机换角度就拦不住，所以这里只看文字。
  //
  // 只算「相隔很远的独立出现」：同一块字随手持镜头移动会被拆成好几条紧挨着的块
  //（《硬核亨利》的「HENRY」五条间隔 0～2 秒），那是连续的一行字，不能动。
  //
  // 而且只管「路过的门牌」：同屏还有两块以上别的字时不算布景——那是一屏文件里的一行
  //（《摇曳露营》片尾须知卡角上的社团名），不是走廊里反复入镜的告示。
  const PROP_GAP = 30
  const PROP_TIMES = 4
  const PROP_KEEP = 2
  {
    const byText = new Map<string, SignBlock[]>()
    for (const b of blocks) {
      if (b.drop) continue
      const k = norm(b.text).slice(0, 6)
      if (k.length < 2) continue
      byText.set(k, [...(byText.get(k) ?? []), b])
    }
    for (const group of byText.values()) {
      group.sort((a, b) => a.startSec - b.startSec)
      // 切成一次次独立出现
      const runs: SignBlock[][] = []
      for (const b of group) {
        const last = runs[runs.length - 1]
        if (last && b.startSec - last[last.length - 1].endSec <= PROP_GAP) last.push(b)
        else runs.push([b])
      }
      // 独立出现里，只有「孤零零挂在那儿」的才算布景
      const lonely = runs.filter((run) =>
        run.every((b) => {
          const mid = (b.startSec + b.endSec) / 2
          const others = blocks.filter((o) => o !== b && !o.drop && o.startSec <= mid && mid < o.endSec)
          return others.length < 2
        })
      )
      if (lonely.length < PROP_TIMES) continue
      for (const run of lonely.slice(PROP_KEEP)) for (const b of run) b.drop = 'prop'
    }
  }

  // 台标/水印：同一段字在同一位置累计出现太久（≥ 2 分钟且 ≥ 全片 8%）——电视台 logo、频道水印、播放器 UI
  const filmSec = Math.max(1, ...frames.map((f) => (f.i + 1) / fps))
  const total = new Map<string, number>()
  // 只取文本开头 4 个字做键：台标常被 OCR 读成「WOWOW」「WOWOW シネマ」两种写法
  const keyOf = (b: SignBlock): string => `${norm(b.text).slice(0, 4)}@${Math.round((b.box.x + b.box.w / 2) * 20)},${Math.round((b.box.y + b.box.h / 2) * 20)}`
  for (const b of blocks) total.set(keyOf(b), (total.get(keyOf(b)) ?? 0) + (b.endSec - b.startSec))
  for (const b of blocks) {
    if (!b.drop && (total.get(keyOf(b)) ?? 0) >= Math.max(120, 0.08 * filmSec)) b.drop = 'watermark'
  }

  if (regions) {
    const rs = regions.map((r) => ({ s: r.startMs / 1000, e: r.endMs / 1000 }))
    for (const b of blocks) {
      let overlap = 0
      for (const r of rs) overlap += Math.max(0, Math.min(b.endSec, r.e) - Math.max(b.startSec, r.s))
      b.speech = Math.min(1, overlap / Math.max(0.5, b.endSec - b.startSec))
    }
  }

  // 烧录字幕带：0.1 高的滑窗在下半屏找「居中文字出现占比」最高的一段；单行/双行高度不同，固定格子会把它劈成两半
  const centered = blocks.filter((b) => Math.abs(b.box.x + b.box.w / 2 - 0.5) < 0.15)
  const totalFrames = blocks.reduce((n, b) => n + b.frames, 0)
  let band: number[] = []
  let bandShare = 0
  for (let y0 = 0.7; y0 <= 0.92; y0 += 0.01) {
    const share = centered
      .filter((b) => { const cy = b.box.y + b.box.h / 2; return cy >= y0 && cy < y0 + 0.1 })
      .reduce((n, b) => n + b.frames, 0) / Math.max(1, totalFrames)
    if (share > bandShare) {
      bandShare = share
      band = [Number(y0.toFixed(2)), Number((y0 + 0.1).toFixed(2))]
    }
  }
  if (bandShare < 0.2) band = []
  // 带一旦判定，带内居中的块一律算烧录字幕。不再要求与人声重叠：枪战片里 Silero VAD 只认出 10% 的人声，
  // 《硬核亨利》263 条英文烧录字幕就是靠这个条件漏进来的；带本身（≥20%，正常片 ≤8%）已经是足够强的证据
  if (band.length) {
    // 带贴着画面底边时，上界放开：Vision 给的框会略微超出 1.0，贴底的字幕中心能到 1.01
    const upper = band[1] + 0.02 >= 0.99 ? 1.2 : band[1] + 0.02
    for (const b of blocks) {
      const cy = b.box.y + b.box.h / 2
      if (!b.drop && cy >= band[0] - 0.02 && cy < upper && Math.abs(b.box.x + b.box.w / 2 - 0.5) < 0.15) {
        b.drop = 'subtitle-band'
      }
    }
  }
  return { blocks, band, credits }
}
