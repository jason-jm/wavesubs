/**
 * 视频预览链路自检：Range 解析矩阵 + 用合成视频真实跑一遍片段生成。
 *
 * Range 解析错了 <video> 的 seek 会安静地坏掉（拖进度条回到 0）；
 * 片段生成用真 ffmpeg + lavfi 合成源，纯音频/无声视频两种残缺输入也要有明确行为。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseRange } from '../src/main/media-protocol'
import { buildSegmentPreview, previewKeyOf } from '../src/main/core/preview'

let bad = 0
const eq = (name: string, got: unknown, want: unknown): void => {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    console.log(`  ✓ ${name}`)
    return
  }
  bad += 1
  console.log(`  ✗ ${name}\n      得到 ${g}\n      期望 ${w}`)
}

console.log('Range 解析（parseRange）：')
eq('bytes=0-99', parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
eq('bytes=200-（到文件尾）', parseRange('bytes=200-', 1000), { start: 200, end: 999 })
eq('bytes=-100（最后 100 字节）', parseRange('bytes=-100', 1000), { start: 900, end: 999 })
eq('end 超出被夹到文件尾', parseRange('bytes=0-99999', 1000), { start: 0, end: 999 })
eq('start 越界 → null', parseRange('bytes=1000-', 1000), null)
eq('start > end → null', parseRange('bytes=50-10', 1000), null)
eq('无头 → null（回退整文件）', parseRange(null, 1000), null)
eq('多区间不支持 → null', parseRange('bytes=0-1,5-9', 1000), null)
eq('bytes=- 空 → null', parseRange('bytes=-', 1000), null)
eq('空文件 → null', parseRange('bytes=0-10', 0), null)

const FFMPEG = resolve('vendor/bin/ffmpeg')
if (!existsSync(FFMPEG)) {
  console.log('\n⚠ 找不到随包 ffmpeg，片段生成部分跳过（先跑 npm run bundle-deps）')
  process.exit(bad === 0 ? 0 : 1)
}

const work = mkdtempSync(join(tmpdir(), 'wavesubs-checkpreview-'))
try {
  // 合成一段 8 秒的测试视频（画面 + 正弦音），再派生纯音频与无声视频两种残缺输入
  const av = join(work, 'av.mp4')
  const audioOnly = join(work, 'audio.m4a')
  const videoOnly = join(work, 'silent.mp4')
  execFileSync(FFMPEG, [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=duration=8:size=320x240:rate=24',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
    '-map', '0:v', '-map', '1:a', '-c:v', 'mjpeg', '-q:v', '5', '-c:a', 'aac', av
  ])
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', av, '-map', '0:a', '-c', 'copy', audioOnly])
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', av, '-map', '0:v', '-c', 'copy', videoOnly])

  const cache = join(work, 'cache')

  console.log('\n片段生成（音画俱全的输入）：')
  const seg = await buildSegmentPreview(FFMPEG, { input: av, startMs: 2000, endMs: 4000 }, cache)
  eq('拿到帧（10fps × 约2.8s ≈ 28 帧）', seg.frames.length >= 24 && seg.frames.length <= 32, true)
  eq('拿到音频', seg.audio !== null, true)
  eq('前置留白算进 offset（2000-400）', seg.offsetMs, 1600)
  eq('时长 = 窗口 + 两端留白', seg.durationMs, 2800)

  console.log('\n缓存命中：')
  const t0 = Date.now()
  const seg2 = await buildSegmentPreview(FFMPEG, { input: av, startMs: 2000, endMs: 4000 }, cache)
  eq('第二次直接读缓存（<50ms）', Date.now() - t0 < 50, true)
  eq('内容一致', seg2.frames.length, seg.frames.length)

  console.log('\n残缺输入：')
  const aOnly = await buildSegmentPreview(
    FFMPEG,
    { input: audioOnly, startMs: 1000, endMs: 3000 },
    cache
  )
  eq('纯音频：无帧、有声', { f: aOnly.frames.length, a: aOnly.audio !== null }, { f: 0, a: true })
  const vOnly = await buildSegmentPreview(
    FFMPEG,
    { input: videoOnly, startMs: 1000, endMs: 3000 },
    cache
  )
  eq('无声视频：有帧、无声', { f: vOnly.frames.length > 0, a: vOnly.audio }, { f: true, a: null })

  console.log('\n窗口边界：')
  const head = await buildSegmentPreview(FFMPEG, { input: av, startMs: 100, endMs: 1000 }, cache)
  eq('片头的条不会把 offset 减成负数', head.offsetMs, 0)
  const longSeg = await buildSegmentPreview(FFMPEG, { input: av, startMs: 0, endMs: 60000 }, cache)
  eq('超长条截断在 15 秒上限', longSeg.durationMs <= 15000, true)

  console.log('\n缓存键：')
  eq(
    '不同窗口不同键',
    previewKeyOf({ input: av, startMs: 0, endMs: 1000 }, 'id') ===
      previewKeyOf({ input: av, startMs: 0, endMs: 2000 }, 'id'),
    false
  )
  eq(
    '同窗口不同文件身份不同键（文件被替换后不能吃旧帧）',
    previewKeyOf({ input: av, startMs: 0, endMs: 1000 }, 'id-a') ===
      previewKeyOf({ input: av, startMs: 0, endMs: 1000 }, 'id-b'),
    false
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
