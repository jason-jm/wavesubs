import { execFile } from 'node:child_process'
import { cpus, totalmem } from 'node:os'
import { promisify } from 'node:util'
import type { HardwareInfo, ModelFitness } from '../../shared/types'

const execFileAsync = promisify(execFile)

let cached: HardwareInfo | null = null

/** 「Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz」→「Intel Core i5-8250U」：商标符号和主频对挑模型没用 */
const tidyCpuName = (s: string): string =>
  s.replace(/\((R|TM|C)\)/gi, '').replace(/\s*@.*$/, '').replace(/\bCPU\b/, '').replace(/\s+/g, ' ').trim()

export async function detectHardware(): Promise<HardwareInfo> {
  if (cached) return cached
  const memGB = Math.round(totalmem() / 2 ** 30)
  const platform = process.platform
  const appleSilicon = platform === 'darwin' && process.arch === 'arm64'
  // CPU 型号：macOS 上 sysctl 最准；Windows / Linux 没有 sysctl，用 os.cpus() 的型号串。
  // 之前不分平台，Windows 上 sysctl 一失败就写成「Intel」，AMD 机器也是 Intel
  let chip = tidyCpuName(cpus()[0]?.model ?? '') || (appleSilicon ? 'Apple Silicon' : process.arch)
  if (platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('sysctl', ['-n', 'machdep.cpu.brand_string'])
      if (stdout.trim()) chip = tidyCpuName(stdout)
    } catch {
      // sysctl 不可用时保留粗略判断
    }
  }
  cached = { chip, memGB, appleSilicon, platform }
  return cached
}

/** 只回结论，文案由界面按当前语言自己出 */
export function assessModelFitness(spec: { ramGB: number }, hw: HardwareInfo): ModelFitness {
  if (hw.memGB < spec.ramGB + 2) return 'unfit'
  if (hw.platform === 'darwin') {
    // Intel Mac 没有 Metal 加速，稍大一点的模型就慢
    if (!hw.appleSilicon && spec.ramGB >= 2) return 'slow'
  } else if (spec.ramGB >= 4.5) {
    // Windows：语音识别只走 CPU，翻译要有 Vulkan 设备才吃到 GPU——大模型按慢算，小的只看内存。
    // 之前套的是 Intel Mac 的规则，Windows 上连 Qwen3 1.7B 都被标成「能跑但偏慢」
    return 'slow'
  }
  if (hw.memGB >= spec.ramGB + 6) return 'great'
  return 'ok'
}
