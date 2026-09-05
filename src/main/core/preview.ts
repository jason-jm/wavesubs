/**
 * 片段预览：把视频里某条字幕对应的几秒钟转成「一串 jpeg 帧 + 一段 aac 音频」。
 *
 * 为什么不直接 <video> 播原片：NAS 片库里大量 HEVC/DTS/TrueHD 的 MKV，
 * Chromium 一律播不了；而我们的 LGPL ffmpeg **什么都能解码**、却没有 H.264
 * 编码器（那是 GPL），转不出 <video> 能播的整片。几秒的片段用帧序列 + <audio>
 * 在 canvas/img 上播放，解码能力全覆盖、体积有界（12 秒 ≈ 120 帧 ×30KB + 100KB 音频）、
 * 没有流式同步的失控面。兼容的文件仍然优先走 <video> 直接播（renderer 侧探测）。
 *
 * 缓存按 (文件身份 + 窗口) 落在系统临时目录，重播同一条秒开；应用退出统一清理。
 */
import { execFile } from 'node:child_process'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface SegmentSpec {
  input: string
  startMs: number
  endMs: number
  audioIndex?: number
}

export interface SegmentPreview {
  /** 帧文件的绝对路径，按时间顺序；纯音频输入时为空数组 */
  frames: string[]
  /** 音频文件绝对路径；源没有音轨时为 null */
  audio: string | null
  fps: number
  /** 预览内容相对原片的起点（前置留白已经算进去） */
  offsetMs: number
  durationMs: number
}

const FPS = 10
const FRAME_WIDTH = 480
/** 前后各垫 400ms：字幕边界常常掐在半个音节上，光秃秃地播判断不了对错 */
const PAD_MS = 400
/** 片段上限：预览是「听这句对不对」，不是看片；超长条截前面一段足够判断 */
const MAX_MS = 15000

export function previewKeyOf(spec: SegmentSpec, identity: string): string {
  return createHash('sha1')
    .update(`${identity}|${spec.startMs}|${spec.endMs}|${spec.audioIndex ?? 0}`, 'utf8')
    .digest('hex')
    .slice(0, 20)
}

export async function buildSegmentPreview(
  ffmpeg: string,
  spec: SegmentSpec,
  cacheRoot: string
): Promise<SegmentPreview> {
  const s = await stat(spec.input)
  const identity = `${s.size}|${Math.round(s.mtimeMs)}`
  const key = previewKeyOf(spec, identity)
  const dir = join(cacheRoot, key)

  const offsetMs = Math.max(0, spec.startMs - PAD_MS)
  const durationMs = Math.min(spec.endMs + PAD_MS - offsetMs, MAX_MS)

  const collect = async (): Promise<SegmentPreview | null> => {
    if (!existsSync(dir)) return null
    const files = await readdir(dir)
    const frames = files
      .filter((f) => f.startsWith('f-') && f.endsWith('.jpg'))
      .sort()
      .map((f) => join(dir, f))
    /**
     * 音频必须校验大小而不是只看存在：源没有音轨时，ffmpeg 的 -y 已经把空文件
     * 建出来了、随后 mux 失败退出——留下一个 0 或几十字节的壳。把壳当音频交给
     * <audio> 会 onerror，无声视频的帧驱动逻辑也不会启动，预览整个卡死。
     */
    let audio: string | null = null
    if (files.includes('a.m4a')) {
      const audioPath = join(dir, 'a.m4a')
      const size = (await stat(audioPath)).size
      if (size > 256) audio = audioPath
      else await rm(audioPath, { force: true })
    }
    if (frames.length === 0 && !audio) return null
    return { frames, audio, fps: FPS, offsetMs, durationMs }
  }

  const cached = await collect()
  if (cached) return cached

  await mkdir(dir, { recursive: true })
  const ss = (offsetMs / 1000).toFixed(3)
  const t = (durationMs / 1000).toFixed(3)

  /**
   * 视频与音频分两次跑而不是一条命令：合成一条时任一路缺失（纯音频输入没画面、
   * 无声视频没音轨）会让整条命令失败。分开跑各自失败各自吞，拿到什么算什么。
   * -ss 放在 -i 前是输入端 seek——NAS 上 20GB 的文件顺序读到两小时处要几分钟。
   */
  await run(ffmpeg, [
    '-nostdin', '-v', 'error', '-y',
    '-ss', ss, '-t', t, '-i', spec.input,
    '-map', '0:v:0', '-vf', `fps=${FPS},scale=${FRAME_WIDTH}:-2`,
    '-q:v', '5', join(dir, 'f-%04d.jpg')
  ]).catch(() => undefined)
  /**
   * -vn 必须显式给：`-map 0:a:N?` 匹配不到音轨时不是失败，而是**整个 map 组落空、
   * ffmpeg 回退默认选流**——把视频流转码塞进 a.m4a（实测 49KB 的"音频"里是 mjpeg）。
   * 禁掉视频后无音轨才会真的 mux 失败，留下的空壳由 collect 的大小校验清理。
   */
  await run(ffmpeg, [
    '-nostdin', '-v', 'error', '-y',
    '-ss', ss, '-t', t, '-i', spec.input,
    '-map', `0:a:${spec.audioIndex ?? 0}?`, '-vn', '-sn',
    '-ac', '2', '-c:a', 'aac', '-b:a', '96k',
    join(dir, 'a.m4a')
  ]).catch(() => undefined)

  const built = await collect()
  if (!built) {
    await rm(dir, { recursive: true, force: true })
    throw new Error(`无法从该文件解出画面或声音: ${spec.input}`)
  }
  return built
}

const CACHE_CAP = 60

/** 预览缓存清理：按目录 mtime 淘汰最旧的，退出时整树删除由调用方负责 */
export async function prunePreviewCache(cacheRoot: string): Promise<void> {
  try {
    const entries = await readdir(cacheRoot)
    if (entries.length <= CACHE_CAP) return
    const dated = await Promise.all(
      entries.map(async (e) => ({ e, mtime: (await stat(join(cacheRoot, e))).mtimeMs }))
    )
    dated.sort((a, b) => a.mtime - b.mtime)
    for (const { e } of dated.slice(0, dated.length - CACHE_CAP)) {
      await rm(join(cacheRoot, e), { recursive: true, force: true })
    }
  } catch {
    /* 清不动就算了，退出时还有整树清理兜底 */
  }
}
