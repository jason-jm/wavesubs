// Run each stage on the actual packaged app, using an isolated profile. Includes screenshots of its renderer.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, realpath, rename, rmdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { basename, join, relative, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const [stage, exe, scratchArg] = process.argv.slice(2)
assert.ok(['legacy','upgrade','custom','restart','offline','reconnected','linked','replaced'].includes(stage))
const scratch = await realpath(scratchArg)
const profile = process.env.WAVESUBS_QA_PROFILE ?? join(scratch, '用户 资料')
const original = join(profile, 'models')
const root = resolve(process.env.WAVESUBS_QA_LIBRARY ?? join(scratch, '独立 模型盘'))
const disconnected = root + '-disconnected'
const model = process.env.WAVESUBS_QA_ASR ?? process.env.WAVESUBS_QA_TINY
const customName = process.env.WAVESUBS_QA_ASR ? basename(model) : '中文 识别.bin'
const llm = process.env.WAVESUBS_QA_LLM
const llmName = llm && '中文 翻译.gguf'
const marker = join(profile, '.wavesubs-upgrade-test')
const settingsFile = join(profile, 'settings.json')
if (stage === 'legacy') {
  await mkdir(profile, { recursive: false })
  await writeFile(marker, 'upgrade QA', {flag:'wx'})
  await mkdir(original)
  await copyFile(process.env.WAVESUBS_QA_TINY, join(original, 'ggml-tiny.bin'), constants.COPYFILE_FICLONE)
} else assert.equal(await readFile(marker, 'utf8'), 'upgrade QA')
if (stage === 'custom') {
  await mkdir(root, {recursive:false})
  await copyFile(model, join(root,customName), constants.COPYFILE_FICLONE)
  if (llm) await copyFile(llm, join(root,llmName), constants.COPYFILE_FICLONE)
  // The previous-stage suite exercises the picker and move. This fixture starts a fresh process with the saved choice.
  const settings = JSON.parse(await readFile(settingsFile,'utf8'))
  settings.library = {...settings.library,root}
  await writeFile(settingsFile,JSON.stringify(settings))
}
if (stage === 'offline') { await rename(root,disconnected); await mkdir(root) }
if (stage === 'reconnected') { await rmdir(root); await rename(disconnected,root) }
const portServer = createServer()
await new Promise(resolve => portServer.listen(0,'127.0.0.1',resolve))
const port = portServer.address().port
await new Promise(resolve => portServer.close(resolve))
const env = {...process.env}
delete env.WAVESUBS_MODELS_DIR
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(exe,['--user-data-dir='+profile,'--remote-debugging-port='+port,'--disable-gpu','--disable-background-networking'],{env,stdio:'ignore'})
const exited = once(child,'exit')
let ws
const pending = new Map()
let serial = 0
const cdp = (method, params={}) => new Promise((resolve,reject) => {
  const id = ++serial
  pending.set(id,{resolve,reject})
  ws.send(JSON.stringify({id,method,params}))
})
const evaluate = async expression => {
  const result = await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
const call = (method,...args) => evaluate('window.waveSubs[' + JSON.stringify(method) + '](...' + JSON.stringify(args) + ')')
const shots = join(scratch,'screenshots')
const limit = setTimeout(() => { child.kill(); console.error(stage,'timed out'); process.exit(2) }, 480000)
try {
  let page
  for (let i=0;i<240 && !page;i++) {
    assert.equal(child.exitCode,null,'the application exited before its window opened')
    try { page = (await (await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t => t.type === 'page' && t.url.startsWith('file:')) } catch {}
    if (!page) await sleep(250)
  }
  assert.ok(page,'the application did not expose its renderer')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject})
  ws.onmessage = ({data}) => {
    const msg = JSON.parse(data), receiver = pending.get(msg.id)
    if (!receiver) return
    pending.delete(msg.id)
    if (msg.error) receiver.reject(new Error(msg.error.message)); else receiver.resolve(msg.result)
  }
  // CDP can list a file URL before Chromium replaces the initial execution context.
  let ready = false
  for (let i = 0; i < 150 && !ready; i++) {
    try { ready = await evaluate("document.readyState === 'complete' && Boolean(window.waveSubs && document.querySelector('nav.nav .nav-item'))") }
    catch (err) { if (!/context|navigat/i.test(err.message)) throw err }
    if (!ready) await sleep(200)
  }
  assert.ok(ready,'renderer did not finish mounting')
  const info = await call('appInfo')
  const expected = process.env.WAVESUBS_QA_EXPECTED_VERSION || (stage === 'legacy' ? '1.0.9' : JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version)
  assert.equal(info.version,expected)
  const overview = await call('modelsOverview')
  assert.equal(relative(overview.dir,['legacy','upgrade','linked','replaced'].includes(stage) ? original : root),'')
  if (stage === 'legacy') {
    await call('updateSettings',{language:'zh-Hans',updateCheck:false,translateEnabled:false})
    await call('selectModel','asr','ggml-tiny.bin')
  } else if (stage === 'replaced') {
    assert.equal(overview.folderOnline, false)
    await assert.rejects(call('downloadModel', 'llm', 'Qwen3-1.7B-Q8_0.gguf'), /无法使用原位置|reconnect|library\.offline/i)
    assert.deepEqual(await readdir(original), [])
  } else if (stage === 'upgrade' || stage === 'linked') {
    assert.equal((await call('getSettings')).language,'zh-Hans')
    assert.equal(overview.selected,'ggml-tiny.bin')
    assert.ok(overview.models.find(m => m.file === 'ggml-tiny.bin').installed)
    if (stage === 'linked') {
      assert.equal(overview.folderOnline, true)
      assert.match(await readFile(join(original,'.wavesubs-library-id'),'utf8'), /^[a-f\d-]{36}$/i)
    }
  } else if (stage === 'custom') {
    assert.equal(await call('verifyModel','asr',customName),customName)
    if (llm) assert.equal(await call('verifyModel','llm','root/'+llmName),'root/'+llmName)
  } else if (stage === 'offline') {
    assert.equal(overview.folderOnline,false)
    await assert.rejects(call('selectModel','asr',customName))
    assert.deepEqual(await readdir(root),[])
  } else {
    assert.equal(overview.selected,customName)
    assert.ok(overview.models.find(m => m.file === customName).installed)
    if (llm) assert.ok(overview.llmModels.find(m => m.file === 'root/'+llmName).installed)
    if (stage === 'restart') {
      const input = join(scratch,'测试 采访.wav')
      await copyFile(process.env.WAVESUBS_QA_AUDIO,input)
      const result = await call('runJob',input,{language:process.env.WAVESUBS_QA_LANGUAGE ?? 'en',translate:Boolean(llm),
        targetLanguage:'zh',content:'bilingual',format:'srt',signs:false,refreshCache:true})
      console.log('Subtitle export',JSON.stringify({cues:result.cueCount,translated:result.translatedCount,device:result.asrDevice}))
      assert.ok(result.cueCount>0)
      if (llm) assert.equal(result.translatedCount,result.cueCount,'every subtitle in the acceptance recording must translate')
      const srt = await readFile(result.outputPath,'utf8')
      assert.ok(srt.includes('-->'))
      if (llm) assert.match(srt, /[\u4e00-\u9fff]/u)
      if (!process.env.WAVESUBS_QA_ASR) assert.match(srt,/country/i)
      await writeFile(join(scratch,'packaged-output.srt'),srt)
    }
  }
  await evaluate("document.querySelectorAll('nav.nav .nav-item')[2]?.click()")
  if (llm && ['custom','restart'].includes(stage)) await evaluate("document.querySelectorAll('.subnav-tab')[1]?.click()")
  await sleep(400)
  await mkdir(shots,{recursive:true})
  const image = await cdp('Page.captureScreenshot',{format:'png'})
  await writeFile(join(shots,stage+'.png'),Buffer.from(image.data,'base64'))
  console.log('PASS',stage,info.platform,info.version,overview.dir)
} finally {
  clearTimeout(limit)
  ws?.close()
  if (child.exitCode === null) child.kill()
  await exited
}
