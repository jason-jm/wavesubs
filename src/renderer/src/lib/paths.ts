/**
 * 从完整路径里取文件名。
 *
 * 渲染进程里没有 Node 的 `path` 模块，只能自己切。而 Windows 用反斜杠、
 * macOS 用正斜杠——只按 '/' 切的话，Windows 上整条 `C:\Users\...\a.mkv`
 * 会被当成文件名原样显示在队列和标题里。
 */
export function fileNameOf(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at >= 0 ? path.slice(at + 1) : path
}
