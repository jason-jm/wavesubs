import type {
  BatchEntry,
  BatchOverride,
  JobRequest,
  JobSummary,
  MediaProbeInfo
} from '../../../shared/types'
import { pickDefaultSource } from './source'

export interface BatchRunnerDeps {
  probe: (path: string) => Promise<MediaProbeInfo>
  run: (path: string, request: JobRequest) => Promise<JobSummary>
  /** 读队列的当前值。必须是实时的，不能是渲染时捕获的快照 */
  getEntries: () => BatchEntry[]
  patch: (fn: (prev: BatchEntry[]) => BatchEntry[]) => void
  shouldStop: () => boolean
  toMessage: (err: unknown) => string
}

/**
 * 把全局设置和单个文件的个别设置合成这一趟真正要用的请求。
 *
 * 规则很简单：个别设置里写了什么就盖掉什么，没写的沿用全局。
 * 只有 `source` 特殊——两边都没指定时按探测结果自动挑（有字幕轨就用字幕轨）。
 *
 * `translate: false` 必须用 `!== undefined` 判断而不是真值判断，
 * 否则「这个文件不翻译」会被当成没设置，掉回全局的「要翻译」。
 */
export function mergeBatchRequest(
  global: JobRequest,
  override: BatchOverride | undefined,
  info: MediaProbeInfo | undefined
): JobRequest {
  const merged: JobRequest = { ...global, ...(override ?? {}) }
  if (!merged.source) merged.source = info ? pickDefaultSource(info) : { kind: 'asr' }
  // 不翻译就没有目标语言和引擎可言，留着会让主进程按云端配置去校验
  if (merged.translate === false) {
    delete merged.targetLanguage
    delete merged.engine
    delete merged.providerId
    merged.content = 'original'
  }
  return merged
}

/**
 * 串行跑完队列。抽成纯函数是为了能对着假依赖验证下面四条：
 *
 * 1. 单个文件失败只记在该项上，绝不中断整批——批量最怕的就是第 3 个文件坏了，
 *    后面 20 个全不跑；
 * 2. processed 兜底：状态回写是异步的，只靠 status 判断可能重复取到同一项而死循环；
 * 3. 每轮重新取下一个，所以运行途中追加进来的文件也会被带上；
 * 4. 每一项各自合并自己的个别设置，互不影响。
 */
export async function runBatchQueue(
  request: JobRequest,
  deps: BatchRunnerDeps
): Promise<void> {
  const processed = new Set<string>()

  while (!deps.shouldStop()) {
    const next = deps.getEntries().find((e) => e.status === 'waiting' && !processed.has(e.id))
    if (!next) break
    processed.add(next.id)

    deps.patch((prev) =>
      prev.map((e) =>
        e.id === next.id
          ? { ...e, status: 'running', progress: { stage: 'probe', percent: 0 } }
          : e
      )
    )

    try {
      // 加入队列时通常已经探测过（要拿轨道列表给用户选），这里直接复用；
      // 探测失败或还没轮到的才现探一次
      const info = next.info ?? (await deps.probe(next.path))
      const result = await deps.run(next.path, mergeBatchRequest(request, next.override, info))
      deps.patch((prev) =>
        prev.map((e) =>
          e.id === next.id ? { ...e, status: 'done', result, progress: undefined } : e
        )
      )
    } catch (err) {
      deps.patch((prev) =>
        prev.map((e) =>
          e.id === next.id
            ? { ...e, status: 'failed', error: deps.toMessage(err), progress: undefined }
            : e
        )
      )
    }
  }
}
