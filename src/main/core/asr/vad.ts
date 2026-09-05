import { spawn } from 'node:child_process'

export interface SpeechRegion {
  startMs: number
  endMs: number
}

/**
 * 用 whisper.cpp 附带的独立 Silero VAD 工具检测「真实说话区间」。
 * 只读音频、不参与转写，输出用于校正字幕时间与剔除幻觉。
 */
/**
 * Silero 的调参结果，对着 46 部影片 / 135 个片段扫出来的（默认值是 0.5/100/30）：
 *
 * - `-vsd 60`：切分用的最小静音从 100ms 降到 60ms。人换气的停顿常常不到 100ms，
 *   按默认值两句话会并成一个区间，字幕跟着并成一条。降到 60ms 后起点 MAE 少 10ms。
 *   再往下降没用——实测 40ms 和 60ms 结果完全一致，已到 Silero 的帧粒度。
 * - `-vt 0.35`：阈值从 0.5 放宽，能抓到无线电对讲、耳语这类默认漏检的语音。
 * - `-vp 10`：区间两端的填充从 30ms 收到 10ms，边界更贴合真实起止。
 *
 * 折半验证过：两半语料上 F1 都 +0.6、MAE 都 −10ms，方向一致。
 *
 * 两个**不要碰**的开关，都实测过会静默失效：
 * - `-vspd`（最小语音时长）：当前 whisper.cpp 按 0~1 的浮点解析，传毫秒数直接返回 0 个区间。
 * - `-ug`（走 GPU）：同样返回 0 个区间。而且没必要——51 分钟的音频在 CPU 上只要 4.3 秒，
 *   整条管线的瓶颈从来不在这里（实测长片耗时的 97% 是从网络盘读音频）。
 *
 * 这两个都不会报错，只是让 VAD 什么都检测不到，而后处理拿不到区间时会退化成
 * 能量启发式——指标掉一大截却不会有任何报错，很难查。
 */
const VAD_TUNING = ['-vsd', '60', '-vt', '0.35', '-vp', '10']

export async function detectSpeechRegions(
  vadBin: string,
  vadModelPath: string,
  wavPath: string
): Promise<SpeechRegion[]> {
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(vadBin, ['-vm', vadModelPath, '-f', wavPath, ...VAD_TUNING])
    let out = ''
    let errTail = ''
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      errTail = (errTail + chunk.toString()).slice(-2000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`VAD 检测失败（退出码 ${code}）\n${errTail}`))
    })
  })
  const regions: SpeechRegion[] = []
  // 输出行形如 "Speech segment 3: start = 397.00, end = 800.00"（单位为厘秒）
  for (const match of stdout.matchAll(/start = ([\d.]+), end = ([\d.]+)/g)) {
    regions.push({
      startMs: Math.round(Number(match[1]) * 10),
      endMs: Math.round(Number(match[2]) * 10)
    })
  }
  return regions
}
