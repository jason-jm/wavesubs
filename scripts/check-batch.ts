/**
 * 校验批量队列「全局设置 + 单个文件个别设置」的合并规则。
 *
 * 为什么值得单独写一份：合并错了不会报错，只会**静默产出错的字幕**——
 * 比如某个文件明明设了「不翻译」却被全局的「翻译成中文」盖回去，
 * 跑完才发现，而批量往往是挂着跑几个小时的。
 *
 * 和 check-i18n / check-css 一样是启动前的自检脚本，不引入测试框架。
 */
import { mergeBatchRequest } from '../src/renderer/src/lib/runBatchQueue'
import { pickDefaultSource } from '../src/renderer/src/lib/source'
import { TARGET_LANGUAGE_CODES, targetForUiLocale } from '../src/shared/targetLanguages'
import { languageName } from '../src/main/core/translate/types'
import type { JobRequest, MediaProbeInfo } from '../src/shared/types'

const GLOBAL: JobRequest = {
  language: 'auto',
  translate: true,
  targetLanguage: 'zh',
  engine: 'api',
  providerId: 'p1',
  format: 'srt',
  content: 'bilingual'
}

const videoWithSubs: MediaProbeInfo = {
  kind: 'video',
  format: 'matroska',
  durationSec: 100,
  audioStreams: [],
  subtitleStreams: [
    { subtitleIndex: 0, codec: 'subrip', textBased: true, forced: true, hearingImpaired: false },
    { subtitleIndex: 1, codec: 'subrip', textBased: true, forced: false, hearingImpaired: false }
  ]
}
const videoNoSubs: MediaProbeInfo = { ...videoWithSubs, subtitleStreams: [] }

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

console.log('没有个别设置时，行为和以前完全一致：')
eq(
  '有文本字幕轨 → 自动挑非强制那条',
  mergeBatchRequest(GLOBAL, undefined, videoWithSubs).source,
  { kind: 'embedded', subtitleIndex: 1 }
)
eq('没有字幕轨 → 走语音识别', mergeBatchRequest(GLOBAL, undefined, videoNoSubs).source, {
  kind: 'asr'
})
eq('全局字段原样带上', mergeBatchRequest(GLOBAL, undefined, videoNoSubs).targetLanguage, 'zh')

console.log('\n个别设置能盖掉全局：')
eq(
  '强制走识别，盖掉自动挑中的字幕轨',
  mergeBatchRequest(GLOBAL, { source: { kind: 'asr' } }, videoWithSubs).source,
  { kind: 'asr' }
)
eq(
  '指定用另一条字幕轨',
  mergeBatchRequest(GLOBAL, { source: { kind: 'embedded', subtitleIndex: 0 } }, videoWithSubs)
    .source,
  { kind: 'embedded', subtitleIndex: 0 }
)
eq('只改目标语言，其余仍跟随全局', mergeBatchRequest(GLOBAL, { targetLanguage: 'en' }, videoNoSubs), {
  ...GLOBAL,
  targetLanguage: 'en',
  source: { kind: 'asr' }
})

console.log('\n这一项不翻译（最容易写错的一条）：')
const noTrans = mergeBatchRequest(GLOBAL, { translate: false }, videoNoSubs)
eq('translate 保持 false，没被全局的 true 盖回去', noTrans.translate, false)
eq('目标语言被清掉', noTrans.targetLanguage, undefined)
eq('引擎被清掉', noTrans.engine, undefined)
eq('云端服务 id 被清掉', noTrans.providerId, undefined)
eq('导出内容强制为原文', noTrans.content, 'original')
eq('格式仍跟随全局', noTrans.format, 'srt')

console.log('\n探测信息缺失时不能崩：')
eq('拿不到轨道信息就退回识别', mergeBatchRequest(GLOBAL, undefined, undefined).source, {
  kind: 'asr'
})
eq(
  '探测失败但用户已指定字幕轨 → 仍用用户指定的',
  mergeBatchRequest(GLOBAL, { source: { kind: 'embedded', subtitleIndex: 3 } }, undefined).source,
  { kind: 'embedded', subtitleIndex: 3 }
)

console.log('\n自动选轨按语言打分（pickDefaultSource）：')
{
  const mk = (
    audioLang: string | undefined,
    subs: Array<[number, string | undefined, boolean, boolean]>
  ): MediaProbeInfo => ({
    kind: 'video',
    format: 'matroska',
    durationSec: 100,
    audioStreams: audioLang
      ? [{ audioIndex: 0, codec: 'aac', channels: 2, language: audioLang }]
      : [{ audioIndex: 0, codec: 'aac', channels: 2 }],
    subtitleStreams: subs.map(([subtitleIndex, language, forced, hearingImpaired]) => ({
      subtitleIndex,
      codec: 'subrip',
      language,
      textBased: true,
      forced,
      hearingImpaired
    }))
  })

  // 真实翻车现场：意大利语剧集第一条字幕轨是丹麦语，闭眼取第一条会拿丹麦语当原文
  eq(
    '意语音轨 + [dan, eng, ita] → 选 ita（与音轨同语言）',
    pickDefaultSource(mk('ita', [[0, 'dan', false, false], [1, 'eng', false, false], [2, 'ita', false, false]])),
    { kind: 'embedded', subtitleIndex: 2 }
  )
  eq(
    '639-2/639-1 互认：jpn 音轨匹配 ja 字幕轨',
    pickDefaultSource(mk('jpn', [[0, 'en', false, false], [1, 'ja', false, false]])),
    { kind: 'embedded', subtitleIndex: 1 }
  )
  eq(
    '音轨没有语言标记 → 保持旧行为，取第一条非强制轨',
    pickDefaultSource(mk(undefined, [[0, 'dan', false, false], [1, 'eng', false, false]])),
    { kind: 'embedded', subtitleIndex: 0 }
  )
  eq(
    '同语言的普通轨优先于听障轨（SDH 满是音效标注）',
    pickDefaultSource(mk('eng', [[0, 'eng', false, true], [1, 'eng', false, false]])),
    { kind: 'embedded', subtitleIndex: 1 }
  )
  eq(
    '只有强制轨时仍可用（强制轨只含少量翻译，最后的退路）',
    pickDefaultSource(mk('eng', [[0, 'eng', true, false]])),
    { kind: 'embedded', subtitleIndex: 0 }
  )
  eq(
    '没有任何语言匹配 → 第一条非强制轨',
    pickDefaultSource(mk('kor', [[0, 'dan', false, false], [1, 'eng', false, false]])),
    { kind: 'embedded', subtitleIndex: 0 }
  )
}

console.log('\n首次启动的默认翻译目标（targetForUiLocale）：')
eq('简体中文界面 → zh', targetForUiLocale('zh-Hans'), 'zh')
eq('繁体中文界面 → zh-Hant', targetForUiLocale('zh-Hant'), 'zh-Hant')
eq('挪威语界面 nb → no（后端用 no）', targetForUiLocale('nb'), 'no')
eq('德语界面 → de', targetForUiLocale('de'), 'de')
eq('带地区的 pt-BR → pt', targetForUiLocale('pt-BR'), 'pt')
eq('后端不支持的界面语言 → 英语兜底', targetForUiLocale('bn'), 'en')
eq('所有目标码都能被翻译提示词认出（不出现裸码）', TARGET_LANGUAGE_CODES.filter((c) => languageName(c) === c), [])

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
