/**
 * 校验各语言字典与基准（简体中文）一致：
 * 键不能缺、不能多，插值占位符必须一一对应。
 * 类型系统能挡住缺键，但挡不住占位符写错——那种错误只有运行到才发现。
 */
import { DICTS, LOCALES, AVAILABLE_LOCALES } from '../src/shared/i18n'
import { zhHans } from '../src/shared/i18n/locales/zh-Hans'

const BASE = 'zh-Hans'
const baseKeys = Object.keys(zhHans).sort()
const placeholders = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

let problems = 0
const fail = (msg: string): void => {
  problems += 1
  console.log(`  ✗ ${msg}`)
}

console.log(`基准 ${BASE}：${baseKeys.length} 个键\n`)

for (const [code, dict] of Object.entries(DICTS)) {
  const keys = Object.keys(dict).sort()
  const missing = baseKeys.filter((k) => !(k in dict))
  const extra = keys.filter((k) => !(k in zhHans))
  const before = problems

  missing.forEach((k) => fail(`${code} 缺键 ${k}`))
  extra.forEach((k) => fail(`${code} 多出键 ${k}`))

  for (const k of baseKeys) {
    const src = zhHans[k as keyof typeof zhHans]
    const dst = dict[k as keyof typeof dict]
    if (dst === undefined) continue
    const a = placeholders(src)
    const b = placeholders(dst)
    if (a.join(',') !== b.join(',')) {
      fail(`${code} 的 ${k} 占位符不匹配：基准 [${a}] ↔ 实际 [${b}]`)
    }
    if (typeof dst === 'string' && dst.trim() === '') fail(`${code} 的 ${k} 是空串`)
  }
  if (problems === before) console.log(`  ✓ ${code.padEnd(8)} ${keys.length} 键，占位符一致`)
}

// 清单里声明了但还没写字典的语言：不算错，但要提示，免得以为已经支持了
const declared = LOCALES.map((l) => l.code)
const shipped = AVAILABLE_LOCALES.map((l) => l.code)
const pending = declared.filter((c) => !shipped.includes(c))
console.log(`\n已上线 ${shipped.length} / 清单 ${declared.length} 门语言`)
if (pending.length > 0) console.log(`待补字典：${pending.join(', ')}`)

if (problems > 0) {
  console.log(`\n${problems} 处问题`)
  process.exit(1)
}
console.log('\n全部通过')
