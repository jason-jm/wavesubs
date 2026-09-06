import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

/** 写失败时该换地方而不是报错的错误码：沙盒拒绝、只读卷、NAS 只读共享 */
const DENIED = new Set(['EACCES', 'EPERM', 'EROFS'])

/**
 * 写成品字幕；目标目录不可写时落到 fallbackDir，返回实际写入的路径。
 *
 * 动机：Mac App Store 版跑在沙盒里，用户拖进来一个视频，应用只拿到**这个文件**的
 * 访问权，写不了它旁边的 `.srt`。与其弹错误，不如写到 ~/Movies/Wave Subs
 * （沙盒有对应的 assets.movies 权限）并把真实位置显示给用户。
 * Developer ID 版几乎不会走到兜底分支，除非源文件在只读卷上——那同样是对的行为。
 */
export async function writeOutput(
  path: string,
  data: string,
  fallbackDir?: string
): Promise<string> {
  try {
    await writeFile(path, data, 'utf8')
    return path
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (!fallbackDir || !code || !DENIED.has(code)) throw err
    await mkdir(fallbackDir, { recursive: true })
    const alt = join(fallbackDir, basename(path))
    await writeFile(alt, data, 'utf8')
    return alt
  }
}
