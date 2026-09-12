/** OCR 出来的一个文本框：坐标是左上角原点的归一化值（0–1） */
export interface OcrBox {
  t: string
  /** 置信度 0–1 */
  c: number
  x: number
  y: number
  w: number
  h: number
}

/** 一帧的 OCR 结果；i 是帧序号（从 0 起），时间 = i / fps */
export interface OcrFrame {
  i: number
  boxes: OcrBox[]
}

/** 跨帧跟踪合并后的一段画面文字 */
export interface SignBlock {
  id: number
  /** 多行用 \n 分隔 */
  text: string
  startSec: number
  endSec: number
  frames: number
  conf: number
  box: { x: number; y: number; w: number; h: number }
  /** 启发式丢弃原因；没有就是送模型判别的 */
  drop?: 'no-letters' | 'credits' | 'low-conf' | 'tiny' | 'flash' | 'single-char' | 'subtitle-band' | 'watermark'
  /** 与人声区间重叠的时间占比 0–1 */
  speech?: number
}

export interface SignJudgement {
  id: number
  category: 'sign' | 'credits' | 'noise'
  /** 3 = 不看就不懂剧情；2 = 有帮助；1 = 可有可无 */
  importance: number
  /** 模型修正后的原文（OCR 打碎/错字时），空表示照用 OCR 文本 */
  fixed: string
  /** 译文 */
  tr: string
}

export interface SignBlocksResult {
  blocks: SignBlock[]
  /** 判定出的烧录字幕带 [y0, y1)；没有则为空 */
  band: number[]
  /** 片头片尾名单时段（秒） */
  credits: Array<[number, number]>
}
