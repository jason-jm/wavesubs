import { createReadStream } from 'node:fs'
import type { SpeechRegion } from '../asr/vad'
import type { Cue } from './types'

/**
 * 时间轴后处理链的版本号。任何会改变 refineAsrCues 输出的改动（调参、换算法）
 * 都要 +1：任务缓存里存着旧版精修结果，靠它判断「重新用缓存的原始转写再精修一遍」，
 * 否则时间轴的改进永远到不了已缓存的文件上。
 */
export const TIMING_REV = 2

const MIN_CUE_MS = 200

/**
 * 收敛 Whisper 的退化重复：同一个字连着刷屏（おおおおおお…）、
 * 同一个词连说三遍以上。正常的拉长音（あーー、Nooo）只有两三个字符，不受影响。
 */
export function collapseRepetitions(text: string): string {
  return (
    text
      .replace(/(.)\1{4,}/gu, '$1$1')
      /**
       * 空白/顿号分隔的同一片段连读 ≥3 次 → 留一次。
       * 原来用 \b 判词界，而 \b 在 CJK 旁边永远不成立，所以「ヤバイ ヤバイ ヤバイ …」这种
       * 关掉温度回退后最典型的复读（一条里刷了一百多个）从来没被收过。改用显式分隔符。
       */
      .replace(/(^|[\s、,，。.!?！？])([^\s、,，。.!?！？]{1,12})(?:[\s、,，]+\2){2,}(?=$|[\s、,，。.!?！？])/giu, '$1$2')
      /** 无分隔的短语连读 ≥3 次（やばいやばいやばい / 次は次は次は）→ 留两次，保留一点口语感 */
      .replace(/([^\s]{2,8}?)\1{2,}/gu, '$1$1')
      .trim()
  )
}

/**
 * 转写结果预清理：去掉近零时长的碎片、收敛退化重复，并把「复读循环」产生的
 * 连续同文本字幕折叠成第一条（Whisper 在无人声/音乐段的经典幻觉）。
 */
export function cleanupCues(cues: Cue[]): Cue[] {
  const kept: Cue[] = []
  for (const cue of cues) {
    if (cue.endMs - cue.startMs < MIN_CUE_MS) continue
    cue.text = collapseRepetitions(cue.text)
    if (!cue.text) continue
    const prev = kept[kept.length - 1]
    if (prev && prev.text.trim() === cue.text.trim()) continue
    kept.push(cue)
  }
  kept.forEach((cue, i) => {
    cue.index = i + 1
  })
  return kept
}

/**
 * 收尾去重：前面的删除/收缩会让原本不相邻的两条同文本字幕挨到一起，
 * 所以所有处理结束后再扫一遍。
 */
export function dedupeAdjacent(cues: Cue[]): Cue[] {
  const kept: Cue[] = []
  for (const cue of cues) {
    const prev = kept[kept.length - 1]
    if (prev && prev.text.trim() === cue.text.trim() && cue.startMs - prev.endMs < 2000) {
      prev.endMs = Math.max(prev.endMs, cue.endMs)
      continue
    }
    kept.push(cue)
  }
  kept.forEach((cue, i) => {
    cue.index = i + 1
  })
  return kept
}

const OVERLAP_MARGIN_MS = 250
const MIN_END_SHRINK_MS = 300

/**
 * 可调的时间轴参数。抽成参数而不是写死常量，是为了能对着真实语料扫描取值——
 * 这些数原本都是拍脑袋定的，扫出来才知道差多远（比如尾部留白原来 250ms，
 * 实测人工字幕要宽得多）。默认值即线上取值。
 */
export interface TimingOptions {
  /** 句首相对语音区间起点提前多少（字幕先于人声出现是行业惯例） */
  regionPadStartMs: number
  /**
   * 起点位移小于这个幅度就不动。
   *
   * 本意是「别为几十毫秒的抖动改写时间」，但六部整片上扫下来，**0 才是最好的**
   * （起点 F1 +0.3，六部无一回退）。原因是这里的位移不是抖动：它是往
   * Silero 认定的语音起点上贴，贴多少都比不贴准。留着这个参数只是为了能扫。
   */
  minStartShiftMs: number
  /** 允许把起点**往前**挪多少：修「字幕比人声晚」的情况 */
  maxStartAdvanceMs: number
  /** 句尾在最后一段语音之后额外保留多久 */
  regionPadEndMs: number
  /** 每秒至少几个「音节单位」——低于它认为字幕挂太久了 */
  minRatePerSec: number
  /** 字幕最短显示时长 */
  minDisplayMs: number
  /** 相邻两条空隙小于它就连上 */
  bridgeMaxGapMs: number
  /** 句中静音超过它才断句 */
  resegMinGapMs: number
  /**
   * 日文找不到标点时，允许在「假名→汉字/片假名」的书写体系交界处切分。
   * 日语 Whisper 输出的标点极稀（实测每 35 字才一个可切点），不开这个的话
   * 一半以上的真实静音间隙都因为「文本上没有落点」而切不动。
   */
  cjkScriptBreak: boolean
  /**
   * 一条字幕里出现句末标点、且时长不短于这个值时，即使没超字数上限也拆开。
   * 0 表示关闭（只在超长时才拆）。
   *
   * **实测不划算，默认关闭**，这里留着是为了记下结论、别再走一遍：
   * 出发点是「四分之三的条里 VAD 只看到一个连续语音区间，resegmentAtSilence
   * 对它们无能为力」，想用标点补上。三部整片上扫 1200~4000ms，起点召回只涨
   * 0.2~0.3 个点，精确率掉得更多，起点 F1 净 -0.1~-0.3。原因是拆出来的时间
   * 按字数比例分配，而两句话的语速本来就不一样，新起点落不准——白多切一刀。
   */
  sentenceSplitMinMs: number
  /**
   * 切分后任何一段的语速超过这个值（音节单位/秒）就撤销整次切分。
   *
   * 文本按字数比例分配、时间按语音时长比例分配，两边对不齐时会切出
   * 「17 个字挤在 0.7 秒」+「1 个字挂 3 秒」这种条——平均指标看不出来，
   * 屏幕上一眼就是坏的。官方字幕的语速 p95 在 9~10 之间，超出很多就说明
   * 这一刀切错了位置，宁可退回合并态。
   */
  resegMaxRate: number
  /**
   * 切出来的每一段至少要有这么多「音节单位」（中日韩按字数，拉丁按词数×2.5）。
   *
   * 没有它就会切出「L'altra」/「volta solo cannolicchi.」这种——把固定搭配
   * 从中间劈开。窗口里没标点时会退回按空格切，而空格在拉丁语里到处都是，
   * 光靠「优先标点」拦不住。语速护栏也拦不住：单个词 2.5 单位配 0.5 秒，
   * 语速看着很正常。
   *
   * **只作用于空格/假名交界这两档，不管标点档**：一刀切地拦所有档次实测
   * 会掉 0.2 个点、MAE 涨 22ms，因为标点处的短条（「Boh,」）本来就该单独成条。
   */
  resegMinUnits: number
  /**
   * 允许把起点**往后**挪多少：修「Whisper 把起点标在几秒前的静音里」。
   *
   * 往后挪只会挪到 VAD 认定的第一段语音上，本质是「删掉开头那段没人说话的时间」，
   * 挪多远都不会挪到别人的台词上，所以这个上限可以给得很松。
   * 原来写死 10 秒，结果空档超过 10 秒的条一律不修——实测有字幕在人开口前
   * 整整挂了 25 秒。
   */
  maxStartShiftMs: number
  /**
   * 能用来当「起点锚」的语音区间至少要有这么长。
   *
   * Silero 在 0.35 阈值下会把配乐重音、关门声这类瞬态也标成语音区间。
   * 挑起点时如果撞上这种一百来毫秒的碎区间，字幕就会被钉在那儿，
   * 人真正开口是在几秒之后——>6s 长条剩下的那批基本都是这么来的。
   * 定尾巴不受影响：末尾多一小段声响本来就该让字幕多挂一会儿。
   */
  startAnchorMinMs: number
}

export const DEFAULT_TIMING: TimingOptions = {
  /**
   * 字幕比人声提前多少出现。对着四部整片扫出来的，**取的是稳健值不是最优值**。
   *
   * 各片最优点差得很远，因为字幕流派本身的习惯就不同：
   *   官方/电视台字幕（哈萨维 日、C'è ancora domani 意）为了好读会提前 130~160ms，最优在 180~220
   *   跨语种官方字幕（Mussolini 英译意）提前得更多（GT 比人声早 288ms），一路到 260 还在涨
   *   字幕组作品（攻壳 中译日）是对着波形卡在开口瞬间的，最优 ≤100，到 220 直接崩到 34.5%
   * 140 是四部平均起点 F1 的最高点（57.4%），且没有任何一部塌掉，中位偏移 -12ms 基本居中。
   *
   * 记一笔教训：只有前三部时这个值扫出来是 200，把攻壳加进来才发现那是过拟合——
   * 平均值会把「某一部反着走」完全抹平。扫参一定要看分片（nasvariants.mts --perfilm）。
   */
  regionPadStartMs: 140,
  minStartShiftMs: 0,
  maxStartAdvanceMs: 1200,
  // 以下四个都是对着 36 部影片 / 107 个片段扫出来的，不是估的。
  // 原值 250/1.5/2000 会让字幕比人工字幕明显短一截：屏上占空比 58.5%（人工 60.9%），
  // 观感是「刚看清就没了」。放宽到这组之后占空比对齐，起点指标不受影响。
  regionPadEndMs: 600,
  minRatePerSec: 0.8,
  minDisplayMs: 2400,
  bridgeMaxGapMs: 1000,
  resegMinGapMs: 300,
  cjkScriptBreak: true,
  sentenceSplitMinMs: 0,
  // 三部整片上扫过 9/11/13/16/20/关闭：指标基本不动（±0.1），
  // 所以这个值不是拿指标挑的，是拿坏样本挑的——16 能拦掉「17 字挤 0.7 秒」
  // 那类切错位的条，又比 GT 自身的语速 p95（9~10）宽出足够余量，不误伤真短句。
  resegMaxRate: 16,
  resegMinUnits: 4,
  // 四部整片上 40s 之后指标不再变化（80s / 无限都一样），留个有限值当安全阀：
  // 万一 VAD 出岔子，也不至于把一条字幕的起点挪走十分钟。
  // 10s→40s 是本轮最大的一处改善：掩码 F1 +1.9，屏上占空比从 48.8% 收到 46.9%（GT 47.4%）。
  maxStartShiftMs: 40000,
  // 六部整片上扫 0/150/250/400/600：250 处处最好且无一回退（掩码 F1 +0.1、
  // 起点 F1 +0.2、占空比 54.8%→54.4% 更贴 GT 的 53.3%）。再往上会开始
  // 漏掉真正的短句（600 时六部里有五部回退）。
  startAnchorMinMs: 250
}

/** 可疑判定：整条几乎没有人声、时间又长、字数还少 */
const HALLUCINATION_MAX_SPEECH_MS = 200
const HALLUCINATION_MIN_DURATION_MS = 4000
const HALLUCINATION_MAX_RATE = 1.2
/**
 * 一级：这些永远不会是台词，出现即删，不附加任何条件。
 * 都是 Whisper 从训练语料（字幕组署名、视频站引流话术）里带出来的。
 */
const NEVER_DIALOGUE =
  /(transcription by|subtitles? by|subtitled by|amara\.org|castingwords|www\.|https?:|\.com\b|\.org\b|\.net\b|字幕製作|字幕提供|字幕組|チャンネル登録|请不吝|点赞|打赏|订阅本频道|關注本頻道|明镜与点点)/i

/**
 * 二级：绝大多数情况是幻觉，但极少数场合可能真被说出口
 * （访谈节目主持人真的会说「ご視聴ありがとうございました」）。
 * 所以要求「整条就是这句话」并且该处几乎没有人声，才删。
 *
 * 之所以要分两级：原来只有一套规则，且必须同时满足「时长≥4s + 几乎无人声 +
 * 语速极低」三条才生效。实测语料里 `ご視聴ありがとうございました` 出现 21 次，
 * 其中 7 次因为条件太严逃过过滤、直接进了成品字幕。
 */
const LIKELY_HALLUCINATION_PHRASE =
  /^[\s"'「『]*(ご視聴ありがとうございました|ご視聴ありがとう|ご覧いただきありがとうございました|次回予告|お疲れ様でした|谢谢观看|感谢观看|感謝觀看|请订阅|請訂閱|thank you for watching)[\s。.!！、,"'」』]*$/i
/** Whisper 偶尔吐出 *Gunshot* / *Sigh* 这类音效描述，从不是真台词 */
const SOUND_EFFECT_ONLY = /^\*[^*]{1,40}\*$/
/**
 * 只有音符的条（♪♪ / ♫）：Whisper 在配乐段落里的「有音乐」标记，不是歌词也不是台词。
 * 40 部整片语料里后处理后仍残留 ♪♪ 这类条，翻译时会被当成一句话送去翻。
 * 带歌词的 ♪ 行（♪ I know that the spades…）不在此列，那是真唱出来的内容，照旧保留。
 */
const MUSIC_MARK_ONLY = /^[\s♪♫♬]+$/
/** 收缩到末尾时按这个语速折算显示时长（单位/秒） */
const TAIL_RATE_PER_SEC = 2.5

const HAS_CJK = /[぀-ヿ㐀-䶿一-鿿]/

/**
 * 把文本折算成可比较的「音节量」：中日韩按字数，拉丁语按词数×2.5
 * （一个英文单词的发音时长大致相当于 2~3 个汉字）
 */
function speakingUnits(text: string): number {
  if (HAS_CJK.test(text)) return text.replace(/\s+/g, '').length
  return text.trim().split(/\s+/).filter(Boolean).length * 2.5
}

function speakingRate(text: string, durationMs: number): number {
  return durationMs > 0 ? speakingUnits(text) / (durationMs / 1000) : Infinity
}

/** 按文字量限制最长显示时长，避免字幕在人早已说完之后还挂着 */
function clampDisplayDuration(cue: Cue, o: TimingOptions): Cue {
  const allowed = Math.max(o.minDisplayMs, (speakingUnits(cue.text) / o.minRatePerSec) * 1000)
  if (cue.endMs - cue.startMs > allowed) cue.endMs = Math.round(cue.startMs + allowed)
  return cue
}

function cueIsQuiet(cue: Cue, profile: EnergyProfile): boolean {
  const { frameMs, frames } = profile
  if (frames.length === 0) return false
  const a = Math.max(0, Math.floor(cue.startMs / frameMs))
  const b = Math.min(frames.length - 1, Math.floor(cue.endMs / frameMs))
  if (b <= a) return false
  const sorted = Array.from(frames.subarray(a, b + 1)).sort((x, y) => x - y)
  return percentileOf(sorted, 0.95) <= -45
}

/**
 * 用 Silero VAD 的说话区间校正字幕：
 * - 样板幻觉分两级剔除（见上面两个正则）：一级无条件删，二级要求整条就是
 *   那句套话且此处几乎无人声；
 * - 其余可疑条：整条几乎无人声 + 时长 ≥4s + 语速低得离谱，三条同时成立才
 *   收缩到尾部。（动作场面里的短促喊叫 VAD 常漏检，所以短条一律保留）
 * - 句首晚于区间起点才开口 → 起点吸附到区间起点前 100ms（解决提前出现）；
 * - 句尾裁掉「最后一段语音之后」的拖尾，再按文字量限制最长显示时长；
 * 一律只收缩、不扩张，且不改动文本。
 */
export function refineCuesWithSpeechRegions(
  cues: Cue[],
  regions: SpeechRegion[],
  energy?: EnergyProfile,
  o: TimingOptions = DEFAULT_TIMING
): Cue[] {
  if (regions.length === 0) return cues
  const kept: Cue[] = []
  for (const cue of cues) {
    const duration = cue.endMs - cue.startMs
    const speechMs = regions.reduce(
      (sum, r) => sum + Math.max(0, Math.min(cue.endMs, r.endMs) - Math.max(cue.startMs, r.startMs)),
      0
    )
    // 一级样板幻觉：无条件删
    if (NEVER_DIALOGUE.test(cue.text)) continue
    // 二级：整条就是那句套话，且此处几乎没人在说话
    if (LIKELY_HALLUCINATION_PHRASE.test(cue.text) && speechMs < duration * 0.5) continue
    if (MUSIC_MARK_ONLY.test(cue.text)) continue
    if (
      speechMs < HALLUCINATION_MAX_SPEECH_MS &&
      duration >= HALLUCINATION_MIN_DURATION_MS &&
      speakingRate(cue.text, duration) < HALLUCINATION_MAX_RATE
    ) {
      // 样板套话与纯音效描述直接丢；其余可能是 VAD 漏检的真台词，不能删
      if (SOUND_EFFECT_ONLY.test(cue.text.trim())) continue
      // 实测这类窗口里真实语音有 8 成落在末尾，把字幕收缩到尾部而不是整条丢掉
      const tail = Math.max(
        o.minDisplayMs,
        (speakingUnits(cue.text) / TAIL_RATE_PER_SEC) * 1000
      )
      cue.startMs = Math.max(cue.startMs, Math.round(cue.endMs - tail))
      kept.push(cue)
      continue
    }

    const nearby = regions.filter(
      (r) => r.endMs > cue.startMs - OVERLAP_MARGIN_MS && r.startMs < cue.endMs + OVERLAP_MARGIN_MS
    )
    /**
     * 只用「实质落在这条字幕里」的区间来定起止。
     * 相邻那句的语音区间常常擦边伸进来一两百毫秒，若把它当成本句的第一段，
     * 起点就会被钉在上一句的位置上，本句真正的迟到就永远修不掉。
     */
    const substantial = nearby.filter((r) => {
      const ov = Math.min(cue.endMs, r.endMs) - Math.max(cue.startMs, r.startMs)
      return ov >= Math.min(300, (r.endMs - r.startMs) * 0.6)
    })
    const overlapping = substantial.length > 0 ? substantial : nearby
    if (overlapping.length === 0) {
      // Silero 偶有漏检，仅当能量也证明无声才丢；否则原样保留
      if (energy && cueIsQuiet(cue, energy)) continue
      // VAD 覆盖不到时改用响度曲线校正起止，否则 Whisper 的过早起点会原样留下
      if (energy) snapCueToEnergy(cue, energy)
      kept.push(clampDisplayDuration(cue, o))
      continue
    }

    // 挑第一段「够长、像真话」的区间当锚；全都很碎就退回第一段
    const first =
      overlapping.find((r) => r.endMs - r.startMs >= o.startAnchorMinMs) ?? overlapping[0]
    const newStart = first.startMs - o.regionPadStartMs
    if (
      newStart > cue.startMs + o.minStartShiftMs &&
      newStart - cue.startMs < o.maxStartShiftMs &&
      // 少了这条会推出 42010→41900 这种负时长字幕：语音区间靠近本条末尾时，
      // 起点会被推到终点之后。播放器遇到这种条要么丢弃要么乱渲染。
      newStart <= cue.endMs - MIN_CUE_MS
    ) {
      cue.startMs = newStart
    } else if (
      // 反向：Whisper 的起点晚于真实开口时也要修。
      // 原来只处理「起太早」，于是「起太晚」那一侧的误差从来没被碰过——
      // 尾部分析里有 248 例预测比人工字幕晚 0.9 秒以上。
      o.maxStartAdvanceMs > 0 &&
      newStart < cue.startMs - o.minStartShiftMs &&
      cue.startMs - newStart <= o.maxStartAdvanceMs &&
      // 不能越过上一条的结尾去抢它的语音
      newStart >= (kept[kept.length - 1]?.endMs ?? 0)
    ) {
      cue.startMs = Math.max(0, newStart)
    }

    const last = overlapping[overlapping.length - 1]
    const newEnd = last.endMs + o.regionPadEndMs
    if (newEnd < cue.endMs - MIN_END_SHRINK_MS) {
      cue.endMs = Math.max(newEnd, cue.startMs + MIN_CUE_MS)
    }
    kept.push(clampDisplayDuration(cue, o))
  }
  kept.forEach((cue, i) => {
    cue.index = i + 1
  })
  return kept
}

/** 16kHz 单声道 PCM WAV 的逐帧响度曲线（dBFS） */
export interface EnergyProfile {
  frameMs: number
  frames: Float32Array
}

const SAMPLE_RATE = 16000
const WAV_HEADER_BYTES = 44
const SILENCE_DB = -100

/** 流式读取管线抽出的 WAV（固定 16kHz/mono/pcm16），计算每 20ms 帧的 RMS 响度 */
export async function analyzeWavEnergy(wavPath: string, frameMs = 20): Promise<EnergyProfile> {
  const samplesPerFrame = Math.round((SAMPLE_RATE * frameMs) / 1000)
  const energies: number[] = []
  let sumSq = 0
  let count = 0
  let skipped = 0
  let carry: Buffer | null = null

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(wavPath)
    stream.on('data', (chunk) => {
      let buf = chunk as Buffer
      if (skipped < WAV_HEADER_BYTES) {
        const skip = Math.min(WAV_HEADER_BYTES - skipped, buf.length)
        skipped += skip
        buf = buf.subarray(skip)
      }
      if (carry) {
        buf = Buffer.concat([carry, buf])
        carry = null
      }
      const usable = buf.length - (buf.length % 2)
      if (usable < buf.length) carry = buf.subarray(usable)
      for (let i = 0; i + 1 < usable; i += 2) {
        const sample = buf.readInt16LE(i) / 32768
        sumSq += sample * sample
        count += 1
        if (count === samplesPerFrame) {
          const rms = Math.sqrt(sumSq / count)
          energies.push(rms > 1e-5 ? 20 * Math.log10(rms) : SILENCE_DB)
          sumSq = 0
          count = 0
        }
      }
    })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  return { frameMs, frames: Float32Array.from(energies) }
}

function percentileOf(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

const PAD_START_MS = 120
const PAD_END_MS = 200
/** 窗内响度起伏低于此值视为无法区分语音与背景，不做调整 */
const MIN_DYNAMICS_DB = 8
const SUSTAIN_FRAMES = 3
const MIN_ADJUST_MS = 200

/**
 * 在每条字幕自己的时间窗内寻找真实语音的起点与终点，把字幕时间收缩过去。
 * 只收缩、不扩张：检测不到明确语音特征时保持 Whisper 原始时间不动。
 */
/** 在单条字幕的时间窗内用响度曲线找真实语音的起止，只收缩不扩张 */
export function snapCueToEnergy(cue: Cue, profile: EnergyProfile): void {
  const { frameMs, frames } = profile
  if (frames.length === 0) return
  const frameAt = (ms: number): number =>
    Math.min(frames.length - 1, Math.max(0, Math.floor(ms / frameMs)))

  const a = frameAt(cue.startMs)
  const b = frameAt(cue.endMs)
  if (b - a < SUSTAIN_FRAMES * 2) return
  const sorted = Array.from(frames.subarray(a, b + 1)).sort((x, y) => x - y)
  const floor = percentileOf(sorted, 0.1)
  const peak = percentileOf(sorted, 0.9)
  if (peak - floor < MIN_DYNAMICS_DB) return
  const threshold = floor + (peak - floor) * 0.4

  const sustainedAt = (i: number, dir: 1 | -1): boolean => {
    for (let j = 0; j < SUSTAIN_FRAMES; j += 1) {
      if (frames[i + j * dir] < threshold) return false
    }
    return true
  }

  for (let i = a; i <= b - SUSTAIN_FRAMES + 1; i += 1) {
    if (sustainedAt(i, 1)) {
      const newStart = i * frameMs - PAD_START_MS
      if (newStart > cue.startMs + MIN_ADJUST_MS) cue.startMs = Math.round(newStart)
      break
    }
  }
  for (let i = b; i >= a + SUSTAIN_FRAMES - 1; i -= 1) {
    if (sustainedAt(i, -1)) {
      const newEnd = (i + 1) * frameMs + PAD_END_MS
      if (newEnd < cue.endMs - MIN_ADJUST_MS) cue.endMs = Math.round(newEnd)
      break
    }
  }
  if (cue.endMs - cue.startMs < 300) cue.startMs = Math.max(0, cue.endMs - 300)
}

export function snapCuesToSpeech(cues: Cue[], profile: EnergyProfile): void {
  for (const cue of cues) snapCueToEnergy(cue, profile)
}

/** 一条字幕的字数上限：中日韩约两行 20 字，拉丁语约两行 42 字符 */
const MAX_CHARS_CJK = 40
const MAX_CHARS_LATIN = 84
/** 拆出来的每一段至少要显示这么久，否则宁可不拆 */
const MIN_SPLIT_PART_MS = 700

const SENTENCE_END = /[.!?。！？…]["'）」』]?\s*/g
const CLAUSE_END = /[,;:，、；：]\s*/g

/** 在靠近中点的位置找一个自然的断句处；找不到返回 -1 */
function findSplitIndex(text: string, limit: number): number {
  const mid = text.length / 2
  for (const pattern of [SENTENCE_END, CLAUSE_END]) {
    let best = -1
    pattern.lastIndex = 0
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      const pos = m.index + m[0].length
      if (pos <= 2 || pos >= text.length - 2) continue
      if (best < 0 || Math.abs(pos - mid) < Math.abs(best - mid)) best = pos
    }
    if (best > 0) return best
  }
  // 没有标点就退而求其次：拉丁语按空格切，CJK 直接按上限切
  if (!HAS_CJK.test(text)) {
    let best = -1
    for (let i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
      if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i
    }
    return best > 2 && best < text.length - 2 ? best + 1 : -1
  }
  return text.length > limit * 1.5 ? Math.round(mid) : -1
}

/** 句末标点出现在中间（而不是收尾）就说明这条塞了不止一句话 */
function hasInternalSentenceEnd(text: string): boolean {
  const trimmed = text.trimEnd()
  SENTENCE_END.lastIndex = 0
  for (let m = SENTENCE_END.exec(trimmed); m; m = SENTENCE_END.exec(trimmed)) {
    const pos = m.index + m[0].length
    if (pos > 2 && pos < trimmed.length - 2) return true
  }
  return false
}

function splitCue(cue: Cue, o: TimingOptions): Cue[] {
  const limit = HAS_CJK.test(cue.text) ? MAX_CHARS_CJK : MAX_CHARS_LATIN
  const duration = cue.endMs - cue.startMs
  const overLimit = cue.text.length > limit
  const multiSentence =
    o.sentenceSplitMinMs > 0 &&
    duration >= o.sentenceSplitMinMs &&
    hasInternalSentenceEnd(cue.text)
  if ((!overLimit && !multiSentence) || duration < MIN_SPLIT_PART_MS * 2) return [cue]

  const at = findSplitIndex(cue.text, limit)
  if (at < 0) return [cue]
  const left = cue.text.slice(0, at).trim()
  const right = cue.text.slice(at).trim()
  if (!left || !right) return [cue]

  // 时间按字数比例分配，近似「说完左半句正好切到右半句」
  const ratio = left.length / (left.length + right.length)
  const mid = Math.round(cue.startMs + duration * ratio)
  if (mid - cue.startMs < MIN_SPLIT_PART_MS || cue.endMs - mid < MIN_SPLIT_PART_MS) return [cue]

  return [
    ...splitCue({ ...cue, text: left, endMs: mid }, o),
    ...splitCue({ ...cue, text: right, startMs: mid }, o)
  ]
}

/**
 * Whisper 常把连续几句话合成一条，一屏塞不下也读不完。
 * 这里按句末标点（其次是逗号、空格）拆开，时间按字数比例分配；拆不动就原样保留。
 */
export function splitLongCues(cues: Cue[], o: TimingOptions = DEFAULT_TIMING): Cue[] {
  const out = cues.flatMap((c) => splitCue(c, o))
  out.forEach((cue, i) => {
    cue.index = i + 1
  })
  return out
}

/**
 * 把短停顿造成的断档连上，避免字幕闪断；不改文本，只延后消失时刻。
 *
 * 为什么需要：人工字幕里近三成的相邻条首尾相接、空隙中位 430ms；而我们逐条
 * 贴着人声收窄之后空隙中位到了 480ms 以上。观感上就是字幕一句一闪——说话人
 * 只是换口气，字却先消失再出现。
 *
 * 阈值 1000ms 是扫出来的，不是套惯例：
 * - 500ms（字幕行业「小于半秒直接闭合」的通行做法）能让占空比和人工字幕
 *   几乎完全对齐（56.5% vs 56.3%），但 F1 只有 75.9%；
 * - 放宽到 1000ms，F1 到 76.9%，精确率只掉 0.7 个点，召回涨 2.7 个点；
 * - 再往上到 1500ms 收益递减，且字幕会在人说完之后明显滞留。
 *
 * 也试过「按上一条自身时长按比例放宽」的自适应规则：在同等占空比下
 * F1 反而略低（76.9 vs 77.1），不值得这份复杂度，已放弃。
 */
export function bridgeShortGaps(cues: Cue[], maxGapMs = DEFAULT_TIMING.bridgeMaxGapMs): Cue[] {
  for (let i = 0; i + 1 < cues.length; i += 1) {
    const gap = cues[i + 1].startMs - cues[i].endMs
    if (gap > 0 && gap <= maxGapMs) cues[i].endMs = cues[i + 1].startMs
  }
  return cues
}

/**
 * Whisper 的 token 级时间戳看起来是定位「真实开口时刻」的好素材，
 * **两代方案都实测过，都不能用**，这里记全以免以后再走一遍。
 *
 * 第一次（`-ojf`，large-v3-turbo）：token 起点能覆盖 79.5% 的人工字幕起点（±250ms），
 * 看着很诱人；但同样数量的**均匀分布随机点**能覆盖 92.0%——还不如随机撒点。
 * 英文里 "You may take your son home" 六个词各标 1.0~1.3 秒，纯粹是量化噪声。
 * 当时留了个口子：`-dtw` 能算真正的对齐，只是没有 turbo 的预设。
 *
 * 第二次（`-dtw large.v3`，六部整片，2026-08-23）：默认模型已经换成 large-v3，
 * 预设存在，把口子补上重测——还是不行。注意 ±250ms 命中率在 token 这个密度上会
 * **饱和**（1 万多个点均匀撒开间距才 440ms，随机点自然处处命中），必须改用
 * 「到最近候选点的中位距离」比：
 *   全部 token 起点     只有同密度随机的 1.19 倍（mussolini 0.90 倍，还不如随机）
 *   只取句首 token      1.9 倍——有信息，但远不及 VAD 的 5.9 倍
 *   直接拿 DTW 时间在句末标点处预切分  起点 F1 59.4%→58.7%，掩码 F1 83.8%→83.3%，净负
 * 顺带发现：Whisper 段内部本来就很少有句末标点（哈萨维 1329 段只切出多 25 条），
 * 所以这条路连「合并漏切」都够不着——那些条恰恰是没标点才没被切开的。
 *
 * 真正有信息量的始终是 Silero VAD 的区间起点：中位距离是同密度随机的 1.9~17.5 倍。
 * 工具留在 `eval/dtwprobe.mts` 和 `eval/dtwsplit.mts`。
 */

/** 拆出来的每一段至少要有这么多语音，否则不值得单独成条 */
const RESEG_MIN_SPEECH_MS = 300

/**
 * 按 VAD 的静音间隙把 Whisper 合并过头的长条重新切开。
 *
 * Whisper 经常把好几句话压成一条（人工字幕 46 条，它只给 36 条），
 * 于是有近四分之一的句子起点在输出里根本不存在——这是起点误差的最大来源，
 * 光靠调整边界救不回来，必须先把条数还原。
 *
 * 切点取真实静音的中点，文本按各段**语音时长**比例分配（而不是按字符位置
 * 均分），因为静音不占字。分配时优先落在标点处，避免把词切断。
 */
export function resegmentAtSilence(
  cues: Cue[], regions: SpeechRegion[], o: TimingOptions = DEFAULT_TIMING
): Cue[] {
  if (regions.length === 0) return cues
  const out: Cue[] = []
  for (const cue of cues) {
    // 只认「大部分落在这条字幕里」的区间。区间只有一小截伸进来时，
    // 那段语音属于隔壁那句，拿它当切分依据会切出半个词。
    const inside = regions.filter((r) => {
      const ov = Math.min(cue.endMs, r.endMs) - Math.max(cue.startMs, r.startMs)
      return ov > 0 && ov >= Math.min(RESEG_MIN_SPEECH_MS, (r.endMs - r.startMs) * 0.6)
    })
    if (inside.length < 2) { out.push(cue); continue }

    const text = cue.text
    const totalSpeechAll = inside.reduce((s, r) => s + (r.endMs - r.startMs), 0)
    if (totalSpeechAll <= 0) { out.push(cue); continue }

    // 逐个静音间隙判断能不能切：时间上够长、两侧语音够多、文本上还得有落点
    const cuts: Array<{ at: number; charAt: number }> = []
    let consumed = 0
    let acc = 0
    for (let i = 1; i < inside.length; i += 1) {
      acc += inside[i - 1].endMs - inside[i - 1].startMs
      const gap = inside[i].startMs - inside[i - 1].endMs
      if (gap < o.resegMinGapMs) continue
      const target = Math.round((acc / totalSpeechAll) * text.length)
      const charAt = nearestBreak(text, target, consumed, o.cjkScriptBreak, o.resegMinUnits)
      if (charAt < 0 || charAt <= consumed || charAt >= text.length) continue
      cuts.push({ at: Math.round((inside[i - 1].endMs + inside[i].startMs) / 2), charAt })
      consumed = charAt
    }
    if (cuts.length === 0) { out.push(cue); continue }

    const made: Cue[] = []
    let prevMs = cue.startMs
    let prevChar = 0
    let ok = true
    for (const cut of [...cuts, { at: cue.endMs, charAt: text.length }]) {
      const slice = text.slice(prevChar, cut.charAt).trim()
      if (!slice || cut.at - prevMs < MIN_CUE_MS) { ok = false; break }
      // 文本按字数比例分、时间按语音时长比例分，两边错位就会切出语速离谱的段
      if (speakingRate(slice, cut.at - prevMs) > o.resegMaxRate) { ok = false; break }
      made.push({ index: 0, startMs: prevMs, endMs: cut.at, text: slice })
      prevMs = cut.at
      prevChar = cut.charAt
    }
    // 切出空段或语速离谱就整条放弃——宁可保留合并态，也不能丢字或切出读不完的条
    out.push(...(ok ? made : [cue]))
  }
  out.forEach((c, i) => { c.index = i + 1 })
  return out
}

/**
 * 从 target 附近找一个**不会切断词**的位置，找不到就返回 -1（该间隙放弃切分）。
 *
 * 之前 CJK 找不到标点时直接按字数硬切，结果把「持ち時間」切成「持ち時 / 間」。
 * 时间轴对了、文本毁了，这个交换不划算——所以现在一律要求落在标点或空格上。
 */
const HIRAGANA = /[぀-ゟ]/
const KANJI_OR_KATAKANA = /[㐀-䶿一-鿿ァ-ヿ]/
const PUNCT_ONLY = /[.,!?;:。、，！？；：…·)）」』】]/
/**
 * 单个假名也能当词尾的，只有助词。这份表是「安全名单」而不是「危险名单」——
 * 名单外的单假名一律不切，因为它多半是送假名（持**ち**時間、立**ち**上がる、
 * 食**べ**物），在那里下刀正好把一个词劈成两半。
 */
const PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'や', 'の', 'ね', 'よ', 'ば'])

/**
 * 日文书写体系交界处能不能安全下刀。
 *
 * 「平假名 → 汉字/片假名」是日语里最强的词边界信号，但直接用会出事：
 * 持ち時間 的「ち」后面正好跟汉字，切下去就成了「持ち / 時間」。
 * 区别在于**这段假名有多长**——送假名通常只有一个字，助词短语则不止：
 *   艦長が 参謀本部に…  「が」单字但是助词 → 可切
 *   持ち時間            「ち」单字且非助词 → 不可切
 *   明らかに 見える      「らかに」多字 → 可切
 */
function isScriptBreak(text: string, i: number): boolean {
  if (!HIRAGANA.test(text[i - 1]) || !KANJI_OR_KATAKANA.test(text[i])) return false
  let run = 0
  while (run < i && HIRAGANA.test(text[i - 1 - run])) run += 1
  return run >= 2 || PARTICLES.has(text[i - 1])
}

export function nearestBreak(
  text: string, target: number, min: number, scriptBreak = false, minLooseUnits = 0
): number {
  const WINDOW = 14
  const lo = Math.max(min + 1, target - WINDOW)
  const hi = Math.min(text.length - 1, target + WINDOW)
  const scan = (accept: (i: number) => boolean): number => {
    let best = -1
    for (let i = lo; i <= hi; i += 1) {
      if (!accept(i)) continue
      let j = i
      while (j < text.length && /\s/.test(text[j])) j += 1
      if (j <= min || j >= text.length) continue
      if (best < 0 || Math.abs(j - target) < Math.abs(best - target)) best = j
    }
    return best
  }
  /**
   * 分三档依次退让，不能一视同仁地「就近取」：
   * 标点是句读，空格只是词界。窗口里同时有逗号和空格时按距离挑，很容易挑到空格，
   * 把「L'altra volta」这种固定搭配从中间劈开——实测在意大利语上就是这么切坏的。
   */
  const byPunct = scan((i) => PUNCT_ONLY.test(text[i - 1]))
  if (byPunct >= 0) return byPunct
  /**
   * 往下两档才要求「切出来的这段不能太碎」。
   * 标点是作者自己给的句读，落在那儿多短都合理（「Boh,」就是一条）；
   * 空格和假名交界只是我们猜的词界，猜错的代价是把固定搭配劈开，所以要设下限。
   */
  const bigEnough = (j: number): boolean =>
    minLooseUnits <= 0 || speakingUnits(text.slice(min, j)) >= minLooseUnits
  const bySpace = scan((i) => /\s/.test(text[i - 1]) && bigEnough(i))
  if (bySpace >= 0 || !scriptBreak) return bySpace
  // 日文标点太稀（每 35 字才一个），退到书写体系交界
  return scan((i) => isScriptBreak(text, i) && bigEnough(i))
}

/**
 * Whisper 原始输出 → 可用字幕的完整后处理链。
 *
 * 抽成单一入口是为了让评测脚本和生产管线走同一条代码路径：
 * 否则调参时测的是 A、跑的是 B，测出来的提升根本落不到用户身上。
 */
export function refineAsrCues(
  rawCues: Cue[],
  regions: SpeechRegion[] | null | undefined,
  energy: EnergyProfile | null | undefined,
  o: TimingOptions = DEFAULT_TIMING
): Cue[] {
  let cues = cleanupCues(rawCues)
  if (regions && regions.length > 0) {
    // 先按静音把合并过头的长条拆开，再逐条校正边界——顺序不能反：
    // 边界校正只能在「一条=一句」时给出正确的起止
    cues = resegmentAtSilence(cues, regions, o)
    cues = refineCuesWithSpeechRegions(cues, regions, energy ?? undefined, o)
  } else if (energy) {
    // VAD 不可用时退化为能量启发式（仅对无背景音乐的素材有效）
    cues = dropSilentCues(cues, energy)
    snapCuesToSpeech(cues, energy)
  }
  return normalizeCues(bridgeShortGaps(dedupeAdjacent(splitLongCues(cues, o)), o.bridgeMaxGapMs))
}

/**
 * 收尾保障：保证交付出去的字幕一定是「按时间排好序、每条都有正时长、互不重叠」。
 *
 * 上游任何一处边界调整算错都可能破坏这几条不变量，而坏掉的条到了播放器那边
 * 表现各不相同（丢弃、闪现、盖住下一条），排查起来很费劲。放在最后统一兜住。
 */
export function normalizeCues(cues: Cue[]): Cue[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const out: Cue[] = []
  for (const cue of sorted) {
    if (cue.endMs - cue.startMs < MIN_CUE_MS) cue.endMs = cue.startMs + MIN_CUE_MS
    const prev = out[out.length - 1]
    if (prev && cue.startMs < prev.endMs) prev.endMs = Math.max(prev.startMs + MIN_CUE_MS, cue.startMs)
    out.push(cue)
  }
  out.forEach((c, i) => { c.index = i + 1 })
  return out
}

/** 整条落在近乎无声区间的字幕多半是 Whisper 在静音里的幻觉，丢弃并重新编号 */
export function dropSilentCues(cues: Cue[], profile: EnergyProfile): Cue[] {
  const { frameMs, frames } = profile
  if (frames.length === 0) return cues
  const kept = cues.filter((cue) => {
    const a = Math.max(0, Math.floor(cue.startMs / frameMs))
    const b = Math.min(frames.length - 1, Math.floor(cue.endMs / frameMs))
    if (b <= a) return true
    const sorted = Array.from(frames.subarray(a, b + 1)).sort((x, y) => x - y)
    return percentileOf(sorted, 0.95) > -45
  })
  kept.forEach((cue, i) => {
    cue.index = i + 1
  })
  return kept
}
