/**
 * wsmedia:// 自定义协议：让渲染进程能播放本地媒体文件。
 *
 * 为什么需要它：开发模式渲染进程跑在 http://localhost 上，file:// 被同源策略拦死；
 * 打包后虽然是 file:// 但 <video> 的 seek 需要 Range 请求，普通 file 加载也没有。
 * 一个自定义协议同时解决两种环境，并且是唯一能自己实现 Range 语义的地方。
 *
 * 两条安全线：
 * 1. **白名单**：只有主进程明确授权过的路径（任务记录的输入文件、预览临时目录）
 *    才可访问。协议对整个渲染进程可见，没有白名单它就是任意文件读取服务。
 * 2. 路径经 resolve 规范化后精确比对/前缀比对，"../" 混不进来。
 */
import { createReadStream, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { Readable } from 'node:stream'

export const MEDIA_SCHEME = 'wsmedia'

const allowedFiles = new Set<string>()
const allowedRoots: string[] = []

/** 授权单个文件（任务记录的输入视频） */
export function allowMediaFile(path: string): string {
  const real = resolve(path)
  allowedFiles.add(real)
  return mediaUrlFor(real)
}

/** 授权整个目录（预览帧/音频的临时目录），目录内任何层级都可读 */
export function allowMediaRoot(dir: string): void {
  const real = resolve(dir)
  if (!allowedRoots.includes(real)) allowedRoots.push(real)
}

export function mediaUrlFor(path: string): string {
  return `${MEDIA_SCHEME}://file/${encodeURIComponent(resolve(path))}`
}

function isAllowed(path: string): boolean {
  if (allowedFiles.has(path)) return true
  return allowedRoots.some((root) => path === root || path.startsWith(root + sep))
}

export interface ByteRange {
  start: number
  end: number
}

/**
 * 解析 HTTP Range 头。只支持 <video>/<audio> 实际会发的单区间形式：
 * bytes=a-b / bytes=a- / bytes=-n。多区间、非法输入返回 null（回退整文件）。
 */
export function parseRange(header: string | null, size: number): ByteRange | null {
  if (!header || size <= 0) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  if (m[1] === '') {
    // bytes=-n：最后 n 字节
    const n = Number(m[2])
    if (n <= 0) return null
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(m[1])
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start > end || start >= size) return null
  return { start, end }
}

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

function mimeOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return (dot >= 0 ? MIME[path.slice(dot).toLowerCase()] : undefined) ?? 'application/octet-stream'
}

/** protocol.handle 的处理器。独立导出，方便直接对它做单元验证 */
export async function handleMediaRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = resolve(decodeURIComponent(url.pathname.replace(/^\//, '')))
  if (!isAllowed(path)) {
    return new Response('forbidden', { status: 403 })
  }
  let size: number
  try {
    const s = statSync(path)
    if (!s.isFile()) return new Response('not a file', { status: 404 })
    size = s.size
  } catch {
    return new Response('not found', { status: 404 })
  }

  const range = parseRange(request.headers.get('range'), size)
  const headers: Record<string, string> = {
    'content-type': mimeOf(path),
    'accept-ranges': 'bytes'
  }
  if (range) {
    headers['content-range'] = `bytes ${range.start}-${range.end}/${size}`
    headers['content-length'] = String(range.end - range.start + 1)
    const stream = createReadStream(path, { start: range.start, end: range.end })
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers })
  }
  headers['content-length'] = String(size)
  const stream = createReadStream(path)
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers })
}
