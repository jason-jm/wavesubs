/**
 * 成品写出的兜底逻辑：目录不可写 → 落到兜底目录；可写 → 原地；
 * 其它错误（比如父目录不存在）不能被兜底吞掉——那是真错误。
 */
import { chmodSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeOutput } from '../src/main/core/output'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) { console.log(`  ✓ ${name}`); return }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

const work = mkdtempSync(join(tmpdir(), 'wavesubs-checkoutput-'))
try {
  const okDir = join(work, 'ok')
  const roDir = join(work, 'readonly')
  const fallback = join(work, 'fallback', 'Wave Subs')
  mkdirSync(okDir)
  mkdirSync(roDir)
  chmodSync(roDir, 0o500)

  eq('可写目录 → 原地写入', await writeOutput(join(okDir, 'a.srt'), '1', fallback), join(okDir, 'a.srt'))
  eq('只读目录 → 落到兜底目录（自动创建）', await writeOutput(join(roDir, 'b.srt'), '1', fallback), join(fallback, 'b.srt'))
  eq('兜底文件确实存在', existsSync(join(fallback, 'b.srt')), true)

  let threw = ''
  try { await writeOutput(join(roDir, 'c.srt'), '1') } catch (e) { threw = (e as NodeJS.ErrnoException).code ?? 'x' }
  eq('没有兜底目录时照常报错', threw, 'EACCES')

  threw = ''
  try { await writeOutput(join(work, 'missing', 'd.srt'), '1', fallback) } catch (e) { threw = (e as NodeJS.ErrnoException).code ?? 'x' }
  eq('父目录不存在（ENOENT）不走兜底，直接抛出', threw, 'ENOENT')

  chmodSync(roDir, 0o700)
} finally {
  rmSync(work, { recursive: true, force: true })
}
console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
