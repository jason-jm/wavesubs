/**
 * Windows 上交给 whisper 程序的路径：用户名带非 ASCII 字符时不能让它进命令行（GitHub issue #1）。
 * 按 Windows 规则在任何平台上都能测：每条都核对两件事——
 *   1. 交出去的参数是纯 ASCII（或者退回了原来的绝对路径）；
 *   2. 在工作目录下解析回来，指向的正是原来那个文件。
 * 另外钉住随包的 win-ocr.ps1 必须是纯 ASCII（PowerShell 5.1 在中日韩 Windows 上按双字节代码页读它）。
 */
import { readFileSync } from 'node:fs'
import { join, win32 } from 'node:path'
import { relativeAsciiPaths, whisperPathArgs } from '../src/main/core/asr/pathArgs'

let bad = 0
const ok = (name: string, cond: boolean, detail = ''): void => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : `\n      ${detail}`}`)
  if (!cond) bad += 1
}
const ASCII = /^[\x20-\x7e]+$/
const same = (a: string, b: string): boolean => win32.resolve(a).toLowerCase() === win32.resolve(b).toLowerCase()

function layout(user: string, temp = `C:\\Users\\${user}\\AppData\\Local\\Temp`) {
  const models = `C:\\Users\\${user}\\AppData\\Roaming\\Wave Subs\\models`
  return {
    model: `${models}\\ggml-small.bin`,
    vad: `${models}\\ggml-silero-v5.1.2.bin`,
    audio: `${temp}\\wavesubs-job-a1B2c3\\audio.wav`,
    out: `${temp}\\wavesubs-whisper-d4E5f6\\transcript`
  }
}

console.log('默认布局，各种非 ASCII 用户名：')
for (const user of ['张三', '山田太郎', '김민수', 'Иван', 'José Müller', 'jason']) {
  const l = layout(user)
  const { cwd, paths } = relativeAsciiPaths(l.model, [l.model, l.vad, l.audio, l.out])
  const [m, v, a, o] = paths
  ok(`${user}：模型只传文件名`, m === 'ggml-small.bin' && v === 'ggml-silero-v5.1.2.bin', JSON.stringify(paths))
  ok(`${user}：音频、输出是纯 ASCII 的相对路径`, ASCII.test(a) && ASCII.test(o) && !win32.isAbsolute(a) && !win32.isAbsolute(o), JSON.stringify(paths))
  ok(`${user}：解析回来是原文件`, [l.model, l.vad, l.audio, l.out].every((p, i) => same(win32.join(cwd!, paths[i]), p)), JSON.stringify({ cwd, paths }))
}
{
  const l = layout('张三')
  const { paths } = relativeAsciiPaths(l.model, [l.audio])
  ok('默认布局下音频的相对路径长这样', paths[0] === '..\\..\\..\\Local\\Temp\\wavesubs-job-a1B2c3\\audio.wav', paths[0])
}

console.log('退回绝对路径的情形：')
{
  const l = layout('张三', 'D:\\Temp')
  const { paths } = relativeAsciiPaths(l.model, [l.model, l.audio])
  ok('临时目录在另一个盘：模型仍只传文件名，音频退回绝对路径', paths[0] === 'ggml-small.bin' && paths[1] === l.audio, JSON.stringify(paths))
}
{
  const model = 'C:\\模型\\ggml-small.bin'
  const audio = 'C:\\Users\\张三\\AppData\\Local\\Temp\\wavesubs-job-1\\audio.wav'
  const { paths } = relativeAsciiPaths(model, [model, audio])
  ok('相对路径里还有非 ASCII：退回绝对路径（等于旧行为）', paths[0] === 'ggml-small.bin' && paths[1] === audio, JSON.stringify(paths))
}
{
  const model = 'D:\\WaveSubsModels\\ggml-small.bin'
  const audio = 'C:\\Users\\张三\\AppData\\Local\\Temp\\wavesubs-job-1\\audio.wav'
  const { cwd, paths } = relativeAsciiPaths(model, [model, audio])
  ok('WAVESUBS_MODELS_DIR 指到别的盘：工作目录是它，音频退回绝对路径', cwd === 'D:\\WaveSubsModels' && paths[1] === audio, JSON.stringify({ cwd, paths }))
}
{
  const model = '\\\\nas\\share\\models\\ggml-small.bin'
  const audio = 'C:\\Users\\bob\\AppData\\Local\\Temp\\wavesubs-job-1\\audio.wav'
  const { paths } = relativeAsciiPaths(model, [model, audio])
  ok('模型在网络共享上：音频跨卷，退回绝对路径', paths[0] === 'ggml-small.bin' && paths[1] === audio, JSON.stringify(paths))
}

console.log('只在 Windows 上改写：')
{
  const r = whisperPathArgs('/Users/张三/Library/Application Support/Wave Subs/models/ggml-small.bin', ['/a/b.bin', '/tmp/x.wav'], 'darwin')
  ok('macOS：路径原样、不设工作目录', r.cwd === undefined && r.paths.join('|') === '/a/b.bin|/tmp/x.wav', JSON.stringify(r))
  const l = layout('张三')
  const w = whisperPathArgs(l.model, [l.model], 'win32')
  ok('win32：走相对路径', w.paths[0] === 'ggml-small.bin' && w.cwd === win32.dirname(l.model), JSON.stringify(w))
}

console.log('随包的 PowerShell 脚本：')
{
  const bytes = readFileSync(join(import.meta.dirname, '..', 'native', 'win-ocr', 'win-ocr.ps1'))
  const at = [...bytes].findIndex((b) => b > 0x7f)
  ok('win-ocr.ps1 是纯 ASCII（中日韩 Windows 上的 PowerShell 5.1 才解析得了）', at < 0, `第 ${at} 字节不是 ASCII`)
}

console.log(bad === 0 ? '\n全部通过' : `\n${bad} 条不符`)
process.exit(bad === 0 ? 0 : 1)
