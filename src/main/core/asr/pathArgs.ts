import { win32 } from 'node:path'

/**
 * whisper.cpp 的两个 Windows 程序（whisper-cli、whisper-vad-speech-segments）对路径编码的处理自相矛盾：
 *
 * - 命令行参数按系统代码页编码（中文系统是 GBK，cli.cpp 的注释写明了这一点）；
 * - 加载模型却把路径当 UTF-8 转换（whisper.cpp 里 _MSC_VER 分支的 wstring_convert<codecvt_utf8>），
 *   非 ASCII 的代码页字节转换失败就抛异常，没人接，进程以 0xC0000409（3221226505）中止；
 * - 读音频（miniaudio 的 fopen_s / CreateFileA）和写结果（窄字符 ofstream）又按系统代码页解释。
 *
 * 模型放在 AppData 下，用户名就在路径里：用户名带任何非 ASCII 字符（中日韩、西里尔、带重音的拉丁字母），
 * 模型一加载就崩；用户名里的字系统代码页装不下时（中文用户名配英文系统）还会变成问号，连音频都打不开。
 * 上游 master 至今没改，升级 whisper.cpp 修不了（GitHub issue #1）。
 *
 * 做法：子进程的工作目录设成模型所在目录，每个路径参数都换成从那里出发的相对路径。
 * 模型文件名本身是纯 ASCII；默认布局下模型在 AppData\Roaming、临时文件在 AppData\Local\Temp，
 * 相对路径只经过 AppData 下面的英文目录名，也是纯 ASCII——用户名根本不进命令行。
 * 相对路径不是纯 ASCII、或跨了盘（Node 的 relative 此时返回绝对路径）就退回绝对路径，即旧行为。
 *
 * 只在 Windows 上这么做：Windows 解析 .. 是按字符串折叠的，不受目录链接影响；
 * macOS 的 .. 由内核按实际目录解析，碰上符号链接会走错，而且那边路径本来就是 UTF-8，不需要。
 */
export interface PathArgs {
  /** 子进程的工作目录；undefined = 沿用当前进程的 */
  cwd?: string
  /** 与传入顺序一一对应 */
  paths: string[]
}

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/

/** 纯函数、按 Windows 规则算：任何平台上都能测 */
export function relativeAsciiPaths(anchorFile: string, paths: string[]): PathArgs {
  const cwd = win32.dirname(anchorFile)
  return {
    cwd,
    paths: paths.map((p) => {
      const rel = win32.relative(cwd, p)
      return rel !== '' && !win32.isAbsolute(rel) && PRINTABLE_ASCII.test(rel) ? rel : p
    })
  }
}

/** anchorFile 是模型文件（工作目录取它所在的目录）；paths 是要交给 whisper 程序的全部路径参数 */
export function whisperPathArgs(
  anchorFile: string,
  paths: string[],
  platform: NodeJS.Platform = process.platform
): PathArgs {
  return platform === 'win32' ? relativeAsciiPaths(anchorFile, paths) : { paths }
}
