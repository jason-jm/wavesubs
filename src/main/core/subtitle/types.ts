export interface Cue {
  index: number
  startMs: number
  endMs: number
  text: string
  translation?: string
  /**
   * 编辑器改过原文之后置位：这条的旧译文对应的是改前的原文，重译时只补这些条。
   * 翻译成功后清掉。
   */
  srcEdited?: boolean
  /** 画面文字（招牌、便签、短信、告示…）；缺省是语音字幕 */
  kind?: 'sign'
  /** 画面文字在画面里的框：左上角原点的归一化坐标（0–1） */
  pos?: { x: number; y: number; w: number; h: number }
  /** 画面文字的排法：盖在原文上 / 贴原文正下方 / 放到顶部 */
  layout?: SignLayout
  /** 画面文字重要度 1–3 */
  importance?: number
}

export type SignLayout = 'box' | 'below' | 'top'

export interface Transcript {
  language: string
  cues: Cue[]
}
