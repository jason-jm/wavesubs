import type { ModelInfo } from '../../../shared/types'

export function sizeLabel(mb: number): string {
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

/**
 * 第一次用、一个模型都没有时，替用户挑一个先下着。
 * 内存不够的不要；能跑得顺的（great / ok）优先于「能跑但偏慢」；
 * 同一档里先要目录标了「默认推荐」的（实测最稳），再按质量从高到低。
 * Apple Silicon 16GB 上是 Large v3，Windows 16GB 上 Large v3 被判偏慢，落到 Large v3 Turbo。
 */
export function recommendModel(models: ModelInfo[]): ModelInfo | null {
  const rank = (m: ModelInfo): number => (m.fitness === 'great' || m.fitness === 'ok' ? 0 : 1)
  const candidates = models
    .filter((m) => !m.installed && m.fitness !== 'unfit')
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.recommendedDefault ?? false) - Number(a.recommendedDefault ?? false) ||
        b.quality - a.quality
    )
  return candidates[0] ?? null
}
