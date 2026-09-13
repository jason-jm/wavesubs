/**
 * 汉字写法归一：繁体一律折算成简体，用来判「这条译文其实和原文是同一行字」。
 *
 * 日剧的人名字幕（北条義時）、中文片源的片名（赤壁之戰）译过来只是做了简繁转写，
 * 等于把同一行字在画面上写两遍。按原样比对看不出来，折算之后才看得出。
 *
 * 只折繁体，不折日本新字体：「営業中」折过去就成了「营业中」，可「営」根本不是汉字，
 * 中文观众未必认得，这条译文是有用的，不该当成照抄丢掉。
 */
import * as OpenCC from 'opencc-js'

type Convert = (s: string) => string
let convert: Convert | null = null

/** 折算成简体。词典是懒加载的，没有画面文字的任务不会付这份开销 */
export function toSimplified(text: string): string {
  if (!convert) convert = OpenCC.Converter({ from: 'tw', to: 'cn' })
  return convert(text)
}
