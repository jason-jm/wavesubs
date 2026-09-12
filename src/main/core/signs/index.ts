export { extractFrames, ocrLanguagesFor, runVisionOcr } from './ocr'
export { buildSignBlocks, creditWindows, groupLines, textSimilarity, trackBlocks } from './blocks'
export { judgeSigns } from './judge'
export type { ChatFn, JudgeOptions } from './judge'
export { layoutOf, signsToCues } from './layout'
export type { OcrBox, OcrFrame, SignBlock, SignBlocksResult, SignJudgement } from './types'

/** 抽帧参数：1 fps、960 宽。画面文字通常停留一秒以上；960 已够 Vision 读清 1080p 里的字 */
export const SIGN_FPS = 1
export const SIGN_FRAME_WIDTH = 960
