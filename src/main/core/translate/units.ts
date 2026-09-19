/**
 * 文本的信息量，用来比较原文和译文「说了多少东西」：
 * 汉字、谚文一个算 1，假名一个算 0.6（一个汉字往往对应两个假名），西文一个词算 1。
 * 跨语言比长度只能这么粗略地比，够用来判断「只译了开头一截」这种差一倍以上的情况。
 */
export function contentUnits(s: string): number {
  const count = (re: RegExp): number => (s.match(re) ?? []).length
  const kana = count(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)
  const cjk = count(/[\p{Script=Han}\p{Script=Hangul}]/gu)
  const words = count(/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]+/gu)
  return kana * 0.6 + cjk + words
}
