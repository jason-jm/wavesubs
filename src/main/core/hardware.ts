import { execFile } from 'node:child_process'
import { totalmem } from 'node:os'
import { promisify } from 'node:util'
import type { HardwareInfo, ModelFitness } from '../../shared/types'

const execFileAsync = promisify(execFile)

let cached: HardwareInfo | null = null

export async function detectHardware(): Promise<HardwareInfo> {
  if (cached) return cached
  const memGB = Math.round(totalmem() / 2 ** 30)
  const appleSilicon = process.arch === 'arm64'
  let chip = appleSilicon ? 'Apple Silicon' : 'Intel'
  try {
    const { stdout } = await execFileAsync('sysctl', ['-n', 'machdep.cpu.brand_string'])
    if (stdout.trim()) chip = stdout.trim()
  } catch {
    // sysctl 不可用时保留粗略判断
  }
  cached = { chip, memGB, appleSilicon }
  return cached
}

/** 只回结论，文案由界面按当前语言自己出 */
export function assessModelFitness(spec: { ramGB: number }, hw: HardwareInfo): ModelFitness {
  if (hw.memGB < spec.ramGB + 2) return 'unfit'
  if (!hw.appleSilicon && spec.ramGB >= 2) return 'slow'
  if (hw.memGB >= spec.ramGB + 6) return 'great'
  return 'ok'
}
