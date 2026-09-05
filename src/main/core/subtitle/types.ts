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
}

export interface Transcript {
  language: string
  cues: Cue[]
}
