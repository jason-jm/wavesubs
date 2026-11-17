import { copyFile, link, mkdtemp, rm, symlink, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, win32 } from 'node:path'

interface PathArgs { cwd?: string; paths: string[] }
const ascii = /^[\x20-\x7e]+$/

// Most Windows installations need no aliases. CreateProcessW takes the cwd in Unicode.
export function relativeAsciiPaths(anchorFile: string, paths: string[]): PathArgs {
  const cwd = win32.dirname(anchorFile)
  return { cwd, paths: paths.map(path => {
    const rel = win32.relative(cwd, path)
    return rel && !win32.isAbsolute(rel) && ascii.test(rel) ? rel : path
  }) }
}
export function whisperPathArgs(anchorFile: string, paths: string[], platform: NodeJS.Platform = process.platform): PathArgs {
  return platform === 'win32' ? relativeAsciiPaths(anchorFile, paths) : { paths }
}

export async function nativePaths(anchor: string, paths: string[]): Promise<PathArgs & { release: () => Promise<void> }> {
  const direct = whisperPathArgs(anchor, paths)
  if (process.platform !== 'win32' || direct.paths.every(p => ascii.test(p))) {
    return { ...direct, release: async () => {} }
  }
  const cwd = await mkdtemp(join(tmpdir(), 'wavesubs-path-'))
  const links: string[] = []
  const release = async (): Promise<void> => {
    for (const path of links) await unlink(path).catch(() => {})
    await rm(cwd, { recursive: true, force: true })
  }
  try {
    const args: string[] = []
    for (const [i, path] of paths.entries()) {
      const fromTemp = win32.relative(cwd, path)
      if (ascii.test(fromTemp)) {
        args.push(fromTemp)
        continue
      }
      const name = basename(path)
      const parent = dirname(path)
      const dir = 'd' + i
      if (ascii.test(name)) {
        // A junction joins local volumes without administrator privileges. UNC shares cannot
        // always be junction targets, so fall back to a file alias for a remote input.
        try {
          await symlink(parent, join(cwd, dir), 'junction')
          args.push(join(dir, name))
          continue
        } catch { /* Try a file alias when the volume does not support junctions. */ }
      }
      const alias = 'file' + i + extname(path).replace(/[^.a-z0-9]/gi, '')
      const target = join(cwd, alias)
      try { await link(path, target) }
      catch {
        try { await symlink(path, target, 'file') }
        catch {
          // A hard link on the model's own NTFS volume costs no model storage.
          const local = join(parent, '.wavesubs-' + randomUUID() + extname(alias))
          try {
            await link(path, local)
            links.push(local)
            await symlink(parent, join(cwd, dir), 'junction')
          } catch {
            // Read-only cross-volume file with a Unicode basename and file symlinks disabled.
            // Its private working copy lasts only for this native process.
            await copyFile(path, target)
            args.push(alias)
            continue
          }
          args.push(join(dir, basename(local)))
          continue
        }
      }
      args.push(alias)
    }
    return { cwd, paths: args, release }
  } catch (e) { await release(); throw e }
}
