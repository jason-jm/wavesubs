/**
 * 按 locales/ 目录重新生成 index.ts 的导入与 DICTS 登记。
 * 加语言时只要放文件，跑一次这个脚本即可。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'src/shared/i18n/locales')
const codes = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .sort()

/** zh-Hans → zhHans，作为导出的变量名 */
const varName = (code: string): string =>
  code.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())

const imports = codes.map((c) => `import { ${varName(c)} } from './locales/${c}'`).join('\n')
const entries = codes
  .map((c) => (c === varName(c) ? `  ${c}` : `  '${c}': ${varName(c)}`))
  .join(',\n')

const path = join(process.cwd(), 'src/shared/i18n/index.ts')
let s = readFileSync(path, 'utf8')
s = s.replace(/import \{ \w+ \} from '\.\/locales\/[\w-]+'\n/g, '')
s = s.replace("import { LOCALES, createTranslate, resolveLocale } from './core'\n",
  `import { LOCALES, createTranslate, resolveLocale } from './core'\n${imports}\n`)
s = s.replace(/export const DICTS: Record<string, Dict> = \{[\s\S]*?\n\}/,
  `export const DICTS: Record<string, Dict> = {\n${entries}\n}`)
writeFileSync(path, s)
console.log(`已登记 ${codes.length} 门语言：${codes.join(', ')}`)
