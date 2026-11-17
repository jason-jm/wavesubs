// All writes are to private fixtures. "Probe" isolates the filesystem tests from model inference.
import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { chmod, copyFile, mkdir, mkdtemp, link, open, readFile, readdir, realpath, rename, rm, stat, statfs, symlink, writeFile } from 'node:fs/promises'
import { existsSync as requireExists, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ModelLibrary, readLibrarySettings, type LibrarySettings } from '../src/main/core/modelLibrary'

class DiskSettings {
  constructor(private file: string) {}
  get library(): LibrarySettings {
    try { return JSON.parse(readFileSync(this.file, 'utf8')) } catch { return { entries: [] } }
  }
  saveLibrary(data: LibrarySettings): void {
    writeFileSync(this.file + '.tmp', JSON.stringify(data))
    renameSync(this.file + '.tmp', this.file)
  }
}
const probe = async (): Promise<void> => {}
const signal = (): AbortSignal => new AbortController().signal
const present = async (p: string): Promise<boolean> => Boolean(await stat(p).catch(() => null))
let count = 0
function passed(label: string): void { console.log('✓', ++count, label) }

async function crashWriter(root: string): Promise<void> {
  const lib = new ModelLibrary(new DiskSettings(join(root, 'settings')), join(root, 'models'), probe)
  await lib.change(join(root, 'target'), true, undefined, signal(), () => process.kill(process.pid, 'SIGKILL'))
}
async function check(): Promise<void> {
  const dir = await mkdtemp(join(await realpath(tmpdir()), 'wavesubs-library-test-'))
  const src = join(dir, 'models'), dst = join(dir, 'target'), shared = join(dir, '外部 文件')
  const store = new DiskSettings(join(dir, 'settings'))
  let probes = 0
  const fresh = (): ModelLibrary => new ModelLibrary(store, src, async () => { probes++ })
  const lib = fresh()
  try {
    for (const d of [join(src, 'llm'), dst, shared]) await mkdir(d, { recursive: true })
    const local = join(src, '日语 辨识.bin'), original = Buffer.from('lmgg' + 'a'.repeat(1_048_576))
    const english = join(src, 'ggml-tiny.bin'), llm = join(src, 'llm', 'local.gguf')
    await writeFile(local, original); await writeFile(english, 'lmgg' + 'b'.repeat(12345)); await writeFile(llm, 'GGUF-test')
    await writeFile(join(src, 'notes.bin'), 'unrelated'); await writeFile(join(src, 'notes.txt'), 'keep')
    await writeFile(join(src, 'half.download'), 'keep')
    assert.equal(lib.root, src)
    assert.equal((await lib.rows('asr')).find(m => m.name === basename(local))?.local?.status, 'verify')
    const id = await lib.verify('asr', local, { select: true })
    assert.equal((await lib.resolve('asr', id)).path, local)
    await assert.rejects(lib.resolve('asr', basename(english)), /error.modelChecksum/)
    await lib.verify('llm', llm)
    passed('default folder, discovery and checksum enforcement for legacy catalogue names')
    await assert.rejects(lib.verify('asr', join(src, 'notes.bin')), /library.invalid/)
    await assert.rejects(lib.verify('asr', llm), /library.invalid/)
    passed('reject arbitrary binary and wrong model kind')
    const ext = join(shared, basename(local))
    await copyFile(local, ext)
    const externalId = await lib.verify('asr', ext)
    assert.notEqual(externalId, id)
    const before = probes
    assert.equal(await lib.verify('asr', ext), externalId)
    assert.equal(probes, before)
    assert.equal((await fresh().resolve('asr', externalId)).path, ext)
    passed('same names in different folders, deduplication and restart persistence')
    const cache = (await lib.resolve('asr', externalId)).cacheKey
    await writeFile(ext, Buffer.from('lmgg' + 'z'.repeat(original.length - 4)))
    await assert.rejects(lib.resolve('asr',externalId),/library.changed/)
    await lib.verify('asr',ext,{id:externalId})
    assert.notEqual((await lib.resolve('asr',externalId)).cacheKey,cache)
    passed('same-length replacement must revalidate and gets a fresh cache key')
    const renamed = join(shared, 'renamed.bin')
    await rename(ext,renamed)
    assert.equal((await lib.rows('asr')).find(m=>m.file===externalId)?.local?.status,'missing')
    assert.equal(await lib.verify('asr',renamed,{id:externalId}),externalId)
    assert.equal((await lib.resolve('asr',externalId)).path,renamed)
    passed('offline reference and relink preserve the selection ID')
    assert.equal((await lib.plan(dst)).count,3)
    await assert.rejects(lib.plan(src),/library.nested/)
    await assert.rejects(lib.plan(join(src,'llm')),/library.nested/)
    await assert.rejects(lib.plan(dir),/library.nested/)
    if (process.platform !== 'win32') {
      const alias=join(dir,'alias');await symlink(src,alias)
      await assert.rejects(lib.plan(alias),/library.nested/)
    }
    passed('model-only inventory and rejection of same, nested and aliased directories')
    await writeFile(join(dst,basename(local)),Buffer.from('lmgg'+'x'.repeat(original.length-4)))
    await assert.rejects(lib.change(dst,true,undefined,signal(),()=>{}),/library.conflict/)
    assert.equal((await readFile(join(dst,basename(local))))[4],120)
    assert.equal(lib.root,src);assert.deepEqual(await readFile(local),original)
    await rm(join(dst,basename(local)))
    passed('same-name, same-size, different-content conflict preserves both files')
    await chmod(dst,0o555)
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      await assert.rejects(lib.plan(dst),/EACCES|EPERM/)
      passed('read-only target is rejected')
    }
    await chmod(dst,0o755)
    if (process.platform !== 'win32') {
    const huge=join(src,'ggml-base.bin')
    const fh=await open(huge,'w')
    const space=await statfs(dst)
    try { await fh.truncate(Math.ceil(space.bavail*space.bsize+10485760)) } finally { await fh.close() }
    await assert.rejects(lib.change(dst,true,undefined,signal(),()=>{}),/library.space/)
    await rm(huge)
    assert.equal(lib.root,src);assert.deepEqual(await readdir(dst),[])
    passed('free-space preflight on a real filesystem with a sparse model')
    }
    const cancelled = new AbortController()
    await assert.rejects(lib.change(dst,true,undefined,cancelled.signal,()=>cancelled.abort()))
    assert.equal(lib.root,src);assert.ok(await present(local))
    assert.ok(!(await readdir(dst)).some(n=>n.endsWith('.part')))
    passed('cancel during streaming; old folder and originals remain usable')
    const child = fork(fileURLToPath(import.meta.url), ['--crash',dir],{execArgv:['--import','tsx'],stdio:'ignore'})
    await once(child,'exit')
    assert.ok(store.library.pending)
    await fresh().recover()
    assert.equal(fresh().root,src); assert.equal(store.library.pending,undefined)
    assert.ok(!(await readdir(dst)).some(n=>n.endsWith('.part')))
    passed('hard-killed migration; fresh process recovers the journal and partial file')
    await copyFile(english,join(dst,basename(english)))
    const reused=await stat(join(dst,basename(english)))
    await lib.change(dst,true,undefined,signal(),()=>{})
    assert.equal((await stat(join(dst,basename(english)))).ino,reused.ino)
    assert.deepEqual(await readFile(join(dst,basename(local))),original)
    assert.equal(await present(local),false);assert.equal(await present(llm),false)
    for(const f of ['notes.bin','notes.txt','half.download'])assert.ok(await present(join(src,f)))
    assert.equal((await fresh().resolve('asr',id)).path,join(dst,basename(local)))
    assert.equal((await fresh().resolve('asr',externalId)).path,renamed)
    passed('verified retry, identical file reused, custom model follows the move, unrelated files retained')
    const offline=join(dir,'unplugged');await rename(dst,offline)
    assert.equal(await lib.online(),false)
    await assert.rejects(lib.writable('llm'),/library.offline/)
    assert.equal(await present(dst),false)
    assert.equal((await lib.resolve('asr',externalId)).path,renamed)
    await rename(offline,dst)
    assert.equal(await lib.online(),true)
    passed('missing root is never recreated; another drive still works; reconnect restores access')
    const next=join(dir,'other');await mkdir(next)
    await lib.change(next,false,undefined,signal(),()=>{})
    assert.ok(await present(join(dst,basename(local))));assert.deepEqual(await readdir(next),[])
    lib.forget('asr',externalId,true);assert.ok(await present(renamed))
    passed('switch only and remove reference both preserve original files')
    const impostor=join(next,'ggml-small.bin')
    await writeFile(impostor,'lmgg-not-the-catalogue-model')
    assert.equal((await lib.catalogue('asr',basename(impostor))).local?.status,'verify')
    await assert.rejects(lib.verify('asr',impostor),/error.modelChecksum/)
    await assert.rejects(lib.resolve('asr',basename(impostor)),/library.changed/)
    passed('an official-looking filename in an existing folder cannot impersonate the catalogue model')
    const registered='ggml-base.bin', registeredFile=join(next,registered)
    await writeFile(registeredFile,'downloaded-model')
    await lib.downloaded('asr',registered,createHash('sha256').update('downloaded-model').digest('hex'))
    assert.equal((await lib.catalogue('asr',registered)).installed,true)
    await writeFile(registeredFile,'replaced-model')
    assert.equal((await lib.catalogue('asr',registered)).local?.status,'verify')
    await assert.rejects(lib.resolve('asr',registered),/library.changed/)
    passed('verified download is remembered and a replaced managed file stops being selectable')
    const split=join(shared,'large-00001-of-00002.gguf');await writeFile(split,'GGUF-fixture')
    await assert.rejects(lib.verify('llm',split),/library.invalid/)
    passed('reject incomplete multi-file GGUF input')
    const abandoned=join(dir,'ejected-mid-copy')
    const token = 'wavesubs-' + randomUUID()
    store.saveLibrary({...store.library,pending:{dir:abandoned,token}})
    const usable=join(dir,'usable');await mkdir(usable)
    await lib.change(usable,false,undefined,signal(),()=>{})
    assert.equal(lib.root,usable)
    await mkdir(abandoned)
    const partial=join(abandoned,'.' + token + '.part');await writeFile(partial,'partial')
    await lib.recover()
    assert.equal(await present(partial),false);assert.equal(store.library.deferred,undefined)
    passed('missing interrupted destination does not block another folder; cleanup resumes when accessible')

    const loose = join(usable, 'shared.gguf'), nested = join(usable, 'llm', 'shared.gguf')
    await mkdir(join(usable, 'llm'))
    await writeFile(loose, 'GGUF-loose'); await writeFile(nested, 'GGUF-nested')
    const sharedOther = join(usable, 'different-app.gguf')
    await writeFile(sharedOther, 'GGUF-unmanaged')
    const rootId = await lib.verify('llm', loose), nestedId = await lib.verify('llm', nested)
    assert.notEqual(rootId, nestedId)
    assert.equal((await lib.rows('llm')).filter(m => m.installed && m.name === 'shared.gguf').length, 2)
    const protectedId = await lib.verify('llm', nested, {asReference: true})
    const finalDir = join(dir, 'after-upgrade'); await mkdir(finalDir)
    await lib.change(finalDir, true, undefined, signal(), () => {})
    assert.ok(await present(sharedOther)); assert.ok(await present(nested)); assert.ok(!await present(loose))
    assert.equal((await fresh().resolve('llm', rootId)).path, join(finalDir, 'shared.gguf'))
    assert.equal((await fresh().resolve('llm', protectedId)).path, nested)
    passed('loose and nested GGUFs with the same basename, separate references and unrelated shared files')
    const aliasFile = join(finalDir, '中文.bin'); await writeFile(aliasFile, 'lmgg-ascii-alias')
    const aliasLib = new ModelLibrary(store, src, async (_kind, path) => {
      const alias = join(finalDir, 'transient-hard-link'); await link(path, alias); await rm(alias)
    })
    const aliasId = await aliasLib.verify('asr', aliasFile)
    const stableKey = (await aliasLib.resolve('asr', aliasId)).cacheKey
    const restored = join(finalDir, 'restored'); await copyFile(aliasFile, restored); await rename(restored, aliasFile)
    assert.equal((await fresh().resolve('asr', aliasId)).cacheKey, stableKey)
    assert.equal((await fresh().rows('asr')).find(m => m.file === aliasId)?.installed, true)
    passed('Chinese filename creates transient hard link during validation; restoring identical bytes keeps selection and cache')
    const rollback = join(dir, 'multifile-cancel'); await mkdir(rollback)
    const abort = new AbortController()
    await assert.rejects(lib.change(rollback, true, undefined, abort.signal, p => {
      if (p.done < p.total && requireExists(join(rollback, p.file))) abort.abort()
    }))
    assert.ok(await present(aliasFile)); assert.ok(await present(join(finalDir, 'shared.gguf')))
    assert.deepEqual((await readdir(rollback)).filter(n => n !== 'llm'), [])
    passed('cancellation after one complete copy rolls back completed files as well as partial files')
    assert.deepEqual(readLibrarySettings({root: finalDir, entries: ['corrupt'], pending: {dir: finalDir, token: '../other'}}).entries, [])
    assert.equal(readLibrarySettings({root: finalDir, entries: {}}).root, finalDir)
    passed('malformed old settings retain the selected folder without trusting invalid entries or journals')

    console.log('Passed',count,'model-library scenarios.')
  } finally { await chmod(dst,0o755).catch(()=>{}); await rm(dir,{recursive:true,force:true}) }
}

if (process.argv[2] === '--crash') await crashWriter(process.argv[3])
else await check()
