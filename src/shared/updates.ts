/**
 * 检查更新的纯逻辑：版本号比较、latest.json 的解析。不碰 Electron，脚本能直接测。
 *
 * 没有服务端：发布链把一个静态的 latest.json 作为附件传到 GitHub Release，
 * 应用启动后读 `releases/latest/download/latest.json` 这个永久链接——它永远指向最新一次发布里的同名附件。
 */
import type { UpdateInfo } from './types'

export const LATEST_JSON_URL = 'https://github.com/jason-jm/wavesubs/releases/latest/download/latest.json'

/** latest.json 的形状（发布链 scripts/make-latest.ts 生成） */
export interface LatestManifest {
  version: string
  publishedAt?: string
  notesUrl: string
  /** 按界面语言的更新要点，键是语言码（zh-Hans / en …） */
  notes?: Record<string, string>
  /** 键是 `${platform}-${arch}`：darwin-arm64、win32-x64 */
  assets?: Record<string, { url: string; sizeMB?: number }>
}

/**
 * 比较两个版本号：正数 = a 新，负数 = b 新，0 = 一样。
 * 只认 x.y.z 的数字部分；带 -beta 这类后缀的，数字相同时算比正式版旧。
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const m = v.trim().replace(/^v/i, '').match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?/)
    if (!m) return { nums: [0], pre: '' }
    return { nums: m[1].split('.').map((n) => Number(n)), pre: m[2] ?? '' }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i += 1) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0)
    if (d !== 0) return d
  }
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

/** 只接受 GitHub 上我们自己仓库的地址：latest.json 万一被换掉，也不能把用户带到别处 */
const TRUSTED_URL = /^https:\/\/github\.com\/jason-jm\/wavesubs\//

/** 把 latest.json 解析成界面要的信息；形状不对就抛错，调用方按「检查失败」处理 */
export function parseLatest(raw: unknown, platform: string, arch: string): UpdateInfo {
  const m = raw as Partial<LatestManifest> | null
  if (!m || typeof m !== 'object') throw new Error('latest.json 不是对象')
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+/.test(m.version)) throw new Error('latest.json 缺版本号')
  if (typeof m.notesUrl !== 'string' || !TRUSTED_URL.test(m.notesUrl)) throw new Error('latest.json 的说明链接不可信')
  const asset = m.assets?.[`${platform}-${arch}`]
  const downloadUrl = asset && typeof asset.url === 'string' && TRUSTED_URL.test(asset.url) ? asset.url : undefined
  const notes: Record<string, string> = {}
  if (m.notes && typeof m.notes === 'object') {
    for (const [k, v] of Object.entries(m.notes)) if (typeof v === 'string' && v.trim()) notes[k] = v.trim()
  }
  return {
    version: m.version,
    publishedAt: typeof m.publishedAt === 'string' ? m.publishedAt : undefined,
    notesUrl: m.notesUrl,
    notes: Object.keys(notes).length > 0 ? notes : undefined,
    downloadUrl,
    sizeMB: asset && typeof asset.sizeMB === 'number' ? asset.sizeMB : undefined
  }
}

/** 更新要点按界面语言取：没有这门语言就退到简体中文（繁体界面）或英文，再不行拿第一份 */
export function pickNotes(notes: Record<string, string> | undefined, locale: string): string | undefined {
  if (!notes) return undefined
  const order = [locale, locale.startsWith('zh') ? 'zh-Hans' : 'en', 'en']
  for (const k of order) if (notes[k]) return notes[k]
  return Object.values(notes)[0]
}
