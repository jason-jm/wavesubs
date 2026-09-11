import { useEffect, useRef, useState } from 'react'
import type { JobProgress, PipelineStage } from '../../../shared/types'

interface StageStart {
  stage: PipelineStage
  at: number
  pct: number
}

/**
 * 预计剩余秒数，按**当前阶段**的推进速度外推。
 *
 * 不能用总进度算：识别一小时的片子要十几分钟，写出只要一秒，各阶段在总进度里
 * 占的是固定权重，跟真实耗时无关；用总进度外推会在识别快结束时报「马上完成」，
 * 然后翻译又跑二十分钟。按阶段算，识别与翻译各自大致匀速，误差在几成以内。
 *
 * 阶段刚切换、推进不足 2 个点或不足 5 秒时返回 null（不显示）——刚开始那几秒
 * 样本太少，报出来的数字会来回跳。
 */
export function useStageEta(progress: JobProgress | null): number | null {
  const startRef = useRef<StageStart | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const stage = progress?.stage ?? null

  useEffect(() => {
    if (!stage) {
      startRef.current = null
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [stage])

  if (!progress || !stage) return null
  const pct = progress.stagePercent ?? 0
  const start = startRef.current
  if (!start || start.stage !== stage) {
    startRef.current = { stage, at: Date.now(), pct }
    return null
  }
  const elapsed = (now - start.at) / 1000
  const gained = pct - start.pct
  if (elapsed < 5 || gained < 2 || pct >= 100) return null
  return Math.max(0, ((100 - pct) * elapsed) / gained)
}
