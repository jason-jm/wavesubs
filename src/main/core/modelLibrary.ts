import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream, createWriteStream } from 'node:fs'
import { access, lstat, mkdir, open, readdir, readFile, realpath, rename, rm, stat, statfs, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { ModelFolderPlan, ModelInfo, ModelKind, ModelMoveProgress } from '../../shared/types'
import { LocalizedError } from '../../shared/i18n/core'
import { findModelSpec, VAD_MODEL_FILE } from './asr/catalog'
import { findLocalLlmSpec } from './translate/localCatalog'
import { cleanupDownload, validDownloadStage, type DownloadStage } from './modelManager'

type Stamp = { size: number; mtimeMs: number; ctimeMs: number; ino: number; dev: number }
interface Entry {
  id: string
  kind: ModelKind
  origin: 'folder' | 'external'
  // Folder entries are relative to the selected root and survive a move.
  location: string
  atRoot?: boolean // An LLM placed directly in the selected directory.
  stamp: Stamp
  digest: string
  bookmark?: string
}
interface CreatedFile { path: string; stamp: Stamp; digest: string }
interface OriginalFile { path: string; stamp: Stamp; target: CreatedFile }
interface PendingMove { dir: string; token: string; bookmark?: string; target?: string; created?: CreatedFile[] }
interface Cleanup { source: string; dest: string; files: OriginalFile[]; bookmark?: string; destBookmark?: string }
export interface LibrarySettings {
  root?: string
  folderId?: string
  readOnlyRoot?: boolean
  bookmark?: string
  entries: Entry[]
  pending?: PendingMove
  deferred?: PendingMove[]
  cleanup?: Cleanup[]
  downloads?: DownloadStage[]
}
interface DiskFile { kind: ModelKind; name: string; path: string; stamp: Stamp; atRoot: boolean }
interface Storage {
  readonly library: LibrarySettings
  saveLibrary(data: LibrarySettings, selection?: { kind: ModelKind; id?: string }): void
}

function validStamp(s: Stamp | undefined): boolean {
  return !!s && [s.size, s.mtimeMs, s.ctimeMs, s.ino, s.dev].every(Number.isFinite)
}
export function readLibrarySettings(raw: unknown): LibrarySettings {
  const value = raw as Partial<LibrarySettings> | null
  const absolute = (s: unknown): s is string => typeof s === 'string' && !s.includes('\0') && isAbsolute(s)
  const text = (s: unknown): string | undefined => typeof s === 'string' ? s : undefined
  const validCreated = (f: CreatedFile, root: string): boolean => !!f && absolute(f.path) && safePath(root, f.path) &&
    validStamp(f.stamp) && typeof f.digest === 'string' && /^[a-f\d]{64}$/i.test(f.digest)
  const journal = (j?: PendingMove): PendingMove | undefined => {
    if (!j || !absolute(j.dir) || typeof j.token !== 'string' || !/^wavesubs-[a-f\d-]{36}$/i.test(j.token)) return
    return { dir: j.dir, token: j.token, bookmark: text(j.bookmark),
      target: absolute(j.target) && safePath(j.dir, j.target) ? j.target : undefined,
      created: Array.isArray(j.created) ? j.created.filter(f => validCreated(f, j.dir)) : [] }
  }
  const entries = (Array.isArray(value?.entries) ? value.entries : []).filter(e => e &&
    (e.kind === 'asr' || e.kind === 'llm') && typeof e.id === 'string' && typeof e.location === 'string' &&
    (e.origin === 'external' ? absolute(e.location) : e.origin === 'folder' && basename(e.location) === e.location &&
      e.location.toLowerCase().endsWith(extension(e.kind))) && validStamp(e.stamp) && /^[a-f\d]{64}$/i.test(e.digest))
  return { root: absolute(value?.root) ? value.root : undefined, bookmark: text(value?.bookmark), entries,
    folderId: typeof value?.folderId === 'string' && /^[a-f\d-]{36}$/i.test(value.folderId) ? value.folderId : undefined,
    readOnlyRoot: value?.readOnlyRoot === true,
    downloads: (Array.isArray(value?.downloads) ? value.downloads : []).filter(validDownloadStage),
    pending: journal(value?.pending), deferred: (Array.isArray(value?.deferred) ? value.deferred : []).flatMap(j => journal(j) ?? []),
    cleanup: (Array.isArray(value?.cleanup) ? value.cleanup : []).filter(j => j && absolute(j.source) && absolute(j.dest) &&
      j.source !== j.dest && Array.isArray(j.files)).map(j => ({ ...j, files: j.files.filter(f => f && absolute(f.path) &&
        safePath(j.source, f.path) && validStamp(f.stamp) && validCreated(f.target, j.dest) &&
        relative(j.source, f.path) === relative(j.dest, f.target.path)) })) }
}

export const kindDir = (root: string, kind: ModelKind): string => kind === 'asr' ? root : join(root, 'llm')
export const official = (kind: ModelKind, name: string): boolean => Boolean(kind === 'asr' ? findModelSpec(name) : findLocalLlmSpec(name))
const folderTag = '.wavesubs-library-id'
async function readFolderId(dir: string): Promise<string> {
  const path = join(dir, folderTag)
  const info = await lstat(path)
  if (info.isFile() && info.size === 36) {
    const id = await readFile(path, 'utf8')
    if (/^[a-f\d-]{36}$/i.test(id)) return id
  }
  throw new LocalizedError('library.conflict', { file: path })
}
async function identifyFolder(dir: string): Promise<Pick<LibrarySettings, 'folderId' | 'readOnlyRoot'>> {
  try { return { folderId: await readFolderId(dir), readOnlyRoot: false } }
  catch (err) { if (!missing(err)) throw err }
  const id = randomUUID()
  try { await writeFile(join(dir, folderTag), id, { flag: 'wx', flush: true }); return { folderId: id, readOnlyRoot: false } }
  catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EEXIST') return { folderId: await readFolderId(dir), readOnlyRoot: false }
    if (['EROFS','EACCES','EPERM'].includes(code ?? '')) return { folderId: undefined, readOnlyRoot: true }
    throw err
  }
}
const extension = (kind: ModelKind): string => kind === 'asr' ? '.bin' : '.gguf'
const sameStamp = (a: Stamp, b: Stamp): boolean =>
  a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs && a.ino === b.ino && a.dev === b.dev
const sameFile = (a: Stamp, b: Stamp): boolean => a.dev === b.dev && a.ino === b.ino
const fileDir = (root: string, item: { kind: ModelKind; atRoot?: boolean }): string => item.atRoot ? root : kindDir(root, item.kind)
const missing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT'
const inside = (a: string, b: string): boolean => {
  const rel = relative(a, b)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}
function fileStamp({ size, mtimeMs, ctimeMs, ino, dev }: Stamp): Stamp {
  return { size, mtimeMs, ctimeMs, ino, dev }
}
const stampOf = async (path: string): Promise<Stamp> => fileStamp(await stat(path))
const safePath = (root: string, path: string): boolean =>
  (dirname(path) === root || dirname(path) === join(root, 'llm')) &&
  !basename(path).startsWith('.') && /\.(bin|gguf)$/i.test(path)
async function plainParent(root: string, path: string): Promise<boolean> {
  return safePath(root, path) && (await lstat(dirname(path)).catch(() => null))?.isDirectory() === true
}
async function fileHash(path: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path, { signal })) hash.update(chunk)
  return hash.digest('hex')
}
async function checkedHash(path: string, signal?: AbortSignal): Promise<{ stamp: Stamp; digest: string }> {
  const stamp = await stampOf(path)
  const digest = await fileHash(path, signal)
  if (!sameStamp(stamp, await stampOf(path))) throw new LocalizedError('library.changed', { file: basename(path) })
  return { stamp, digest }
}
async function hasHeader(path: string, kind: ModelKind): Promise<boolean> {
  const file = await open(path, 'r')
  try {
    const header = Buffer.alloc(4)
    await file.read(header, 0, 4, 0)
    return header.toString('latin1') === (kind === 'asr' ? 'lmgg' : 'GGUF')
  } finally { await file.close() }
}
async function diskFiles(root: string, kind: ModelKind, forMove = false, atRoot = false): Promise<DiskFile[]> {
  const dir = fileDir(root, { kind, atRoot })
  const files: DiskFile[] = []
  // Never traverse a linked subfolder when moving or deleting model files.
  if (kind === 'llm' && (await lstat(dir).catch(() => null))?.isSymbolicLink() && forMove) return files
  let names
  try { names = await readdir(dir, { withFileTypes: true }) }
  catch (err) { if (missing(err) || !forMove) return files; throw err }
  for (const entry of names) {
    const name = entry.name
    if (!entry.isFile() || name.startsWith('.') || !name.toLowerCase().endsWith(extension(kind)) || name === VAD_MODEL_FILE) continue
    const path = join(dir, name)
    // A chosen folder can contain unrelated .bin files. Only move a known model or a matching model header.
    if (forMove && !official(kind, name) && !(await hasHeader(path, kind))) continue
    try { files.push({ kind, name, path, atRoot, stamp: await stampOf(path) }) }
    catch (e) { if (forMove || !missing(e)) throw e }
  }
  return files
}

export class ModelLibrary {
  // A remount, hard link, or backup restore may change filesystem metadata without changing any bytes.
  private hashes = new Map<string, { stamp: Stamp; result: Promise<{ stamp: Stamp; digest: string }> }>()

  private async digestAt(path: string, current: Stamp): Promise<string> {
    let cached = this.hashes.get(path)
    if (!cached || !sameStamp(current, cached.stamp)) {
      cached = { stamp: current, result: checkedHash(path) }
      this.hashes.set(path, cached)
    }
    try { return (await cached.result).digest }
    catch (err) { if (this.hashes.get(path) === cached) this.hashes.delete(path); throw err }
  }

  private async matches(path: string, current: Stamp, entry: Entry): Promise<boolean> {
    if (sameStamp(current, entry.stamp)) return true
    if (current.size !== entry.stamp.size) return false
    return (await this.digestAt(path, current).catch(() => null)) === entry.digest
  }

  constructor(private storage: Storage, private defaultRoot: string,
    private probe: (kind: ModelKind, path: string) => Promise<void>) {}

  get root(): string { return this.storage.library.root ?? this.defaultRoot }

  trackDownload(stage: DownloadStage, active: boolean): void {
    const data = this.storage.library
    const downloads = (data.downloads ?? []).filter(d => d.token !== stage.token)
    if (active) downloads.push(stage)
    this.storage.saveLibrary({ ...data, downloads })
  }

  async online(): Promise<boolean> {
    if (!this.storage.library.root) return true // A fresh install creates its default directory on first download.
    const expected = this.storage.library.folderId
    if (expected) return (await readFolderId(this.root).catch(() => null)) === expected
    return stat(this.root).then(s => s.isDirectory(), () => false)
  }

  async writable(kind: ModelKind): Promise<string> {
    const dir = kindDir(this.root, kind)
    if (!await this.online()) throw new LocalizedError('library.offline', { path: this.root })
    if (this.storage.library.readOnlyRoot) throw new LocalizedError('library.readOnly')
    if (!this.storage.library.root) await mkdir(this.root, { recursive: true })
    if (kind === 'llm') {
      if ((await lstat(dir).catch(() => null))?.isSymbolicLink()) throw new LocalizedError('library.conflict', { file: dir })
      try { await mkdir(dir) } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e }
    }
    await access(dir, constants.W_OK)
    return dir
  }

  async canDelete(kind: ModelKind, name: string): Promise<void> {
    if (!await this.online()) throw new LocalizedError('library.offline', { path: this.root })
    if (this.storage.library.readOnlyRoot) throw new LocalizedError('library.readOnly')
    const dir = kindDir(this.root, kind)
    const path = join(dir, name)
    if (!official(kind, name) || !await plainParent(this.root, path) ||
        (await lstat(path).catch(() => null))?.isSymbolicLink() ||
        this.storage.library.entries.some(e => e.origin === 'external' && relative(e.location, path) === ''))
      throw new LocalizedError('library.conflict', { file: path })
    if (this.storage.library.root) await this.resolve(kind, name)
  }

  private entryPath(e: Entry): string {
    return e.origin === 'external' ? e.location : join(fileDir(this.root, e), e.location)
  }

  // Downloaded files and verified copies have a known identity. A catalogue filename in
  // another person's folder is only a candidate until its contents have been checked.
  async catalogue(kind: ModelKind, name: string): Promise<{ installed: boolean; local?: ModelInfo['local'] }> {
    if (!await this.online()) return { installed: false }
    const path = join(kindDir(this.root, kind), name)
    if (kind === 'llm' && (await lstat(dirname(path)).catch(() => null))?.isSymbolicLink()) return { installed: false }
    const info = await lstat(path).catch(() => null)
    if (!info?.isFile()) return { installed: false }
    const e = this.storage.library.entries.find(e => e.kind === kind && e.origin === 'folder' && !e.atRoot && e.location === name)
    if (e && await this.matches(path, info, e)) return { installed: true }
    if (!e && !this.storage.library.root) {
      const spec = kind === 'asr' ? findModelSpec(name) : findLocalLlmSpec(name)
      if (spec && await this.digestAt(path, info).catch(() => null) === spec.sha256) {
        const data = this.storage.library
        if (!data.root && !data.entries.some(entry => entry.kind === kind && entry.id === name))
          this.storage.saveLibrary({ ...data, entries: [...data.entries,
            { id: name, kind, origin: 'folder', location: name, stamp: fileStamp(info), digest: spec.sha256 }] })
        return { installed: true }
      }
    }
    return { installed: false, local: { origin: 'folder', path, status: 'verify', canDelete: !this.storage.library.root } }
  }

  async downloaded(kind: ModelKind, name: string, digest: string): Promise<void> {
    const checked = await checkedHash(join(kindDir(this.root, kind), name))
    if (checked.digest !== digest) throw new LocalizedError('error.modelChecksum')
    const stamp = checked.stamp
    const data = this.storage.library
    const entries = data.entries.filter(e => !(e.kind === kind && e.origin === 'folder' && !e.atRoot && e.location === name))
    entries.push({ id: name, kind, origin: 'folder', location: name, stamp, digest })
    this.storage.saveLibrary({ ...data, entries })
  }

  async rows(kind: ModelKind): Promise<ModelInfo[]> {
    const entries = this.storage.library.entries.filter(e => e.kind === kind)
    const online = await this.online()
    const files = online ? await diskFiles(this.root, kind) : []
    if (online && kind === 'llm') files.push(...await diskFiles(this.root, kind, false, true))
    const rows: ModelInfo[] = []
    const add = (id: string, path: string, origin: Entry['origin'], size: number, status: NonNullable<ModelInfo['local']>['status']): void => {
      rows.push({ file: id, name: basename(path), sizeMB: Math.max(1, Math.round(size / 1048576)),
        local: { origin, path, status }, installed: status === 'ready', downloading: false,
        downloadUrls: [], fitness: 'ok', ramGB: 0, quality: 0, speed: 0, requirement: '', detail: '' })
    }
    for (const e of entries) {
      if (e.origin === 'folder' && !e.atRoot && official(kind, e.location)) continue
      const path = this.entryPath(e)
      const current = online || e.origin === 'external' ? await stampOf(path).catch(() => null) : null
      add(e.id, path, e.origin, current?.size ?? e.stamp.size,
        !current ? 'missing' : await this.matches(path, current, e) ? 'ready' : 'verify')
    }
    for (const f of files) {
      if ((!f.atRoot && official(kind, f.name)) || entries.some(e => relative(this.entryPath(e), f.path) === '')) continue
      add(f.atRoot ? 'root/' + f.name : f.name, f.path, 'folder', f.stamp.size, 'verify')
    }
    return rows
  }

  async verify(kind: ModelKind, input: string, opts: { id?: string; bookmark?: string; select?: boolean; asReference?: boolean } = {}): Promise<string> {
    const path = await realpath(input)
    const name = basename(path)
    if (!name.toLowerCase().endsWith(extension(kind)) || (kind === 'llm' && /-\d{5}-of-\d{5}\.gguf$/i.test(name)) || !(await stat(path)).isFile() ||
        !(await hasHeader(path, kind))) throw new LocalizedError('library.invalid', { file: name, format: kind === 'asr' ? 'Whisper GGML (.bin)' : 'GGUF (.gguf)' })
    const entries = this.storage.library.entries
    const existing = opts.id ? entries.find(e => e.id === opts.id && e.kind === kind) : undefined
    if (opts.id && (!existing || existing.origin !== 'external')) throw new LocalizedError('error.unknownModel', { file: opts.id })
    const ownedDir = kindDir(this.root, kind)
    const canonical = !(kind === 'llm' && (await lstat(ownedDir).catch(() => null))?.isSymbolicLink()) &&
      relative(await realpath(ownedDir).catch(() => ownedDir), dirname(path)) === ''
    const atRoot = !canonical && kind === 'llm' && relative(await realpath(this.root).catch(() => this.root), dirname(path)) === ''
    const same = entries.find(e => e.kind === kind && (!opts.asReference || e.origin === 'external') && relative(this.entryPath(e), path) === '')
    if (existing && same && same.id !== existing.id) throw new LocalizedError('library.conflict', { file: name })
    const known = existing ?? same
    const before = await stampOf(path)
    const managed = (canonical || atRoot) && !opts.asReference && known?.origin !== 'external'
    if (managed && !await this.online()) throw new LocalizedError('library.offline', { path: this.root })
    const id = known?.id ?? (managed ? (atRoot ? 'root/' + name : name) : 'ref:' + randomUUID())
    let digest = known?.digest
    let stamp = before
    if (!known || relative(this.entryPath(known), path) !== '' || !await this.matches(path, before, known)) {
      try { await this.probe(kind, path) }
      catch (cause) {
        const error = new LocalizedError('library.invalid', { file: name, format: kind === 'asr' ? 'Whisper GGML (.bin)' : 'GGUF (.gguf)' })
        error.cause = cause
        throw error
      }
      const checked = await checkedHash(path)
      stamp = checked.stamp
      digest = checked.digest
      if (!sameFile(before, stamp) || before.size !== stamp.size || before.mtimeMs !== stamp.mtimeMs)
        throw new LocalizedError('library.changed', { file: name })
    }
    const next = this.storage.library.entries.filter(e => !known || e.kind !== kind || e.id !== known.id)
    const catalogue = kind === 'asr' ? findModelSpec(name) : findLocalLlmSpec(name)
    if (managed && canonical && catalogue && digest !== catalogue.sha256) throw new LocalizedError('error.modelChecksum')
    next.push({ id, kind, origin: managed ? 'folder' : 'external', atRoot: managed && atRoot || undefined,
      location: managed ? name : path, stamp, digest: digest!, bookmark: opts.bookmark ?? known?.bookmark })
    const data = this.storage.library
    const identity = managed && data.root && !data.folderId && !data.readOnlyRoot ? await identifyFolder(data.root) : {}
    this.storage.saveLibrary({ ...this.storage.library, ...identity, entries: next }, opts.select ? { kind, id } : undefined)
    return id
  }

  async resolve(kind: ModelKind, id: string): Promise<{ path: string; cacheKey: string }> {
    const entry = this.storage.library.entries.find(e => e.kind === kind && e.id === id)
    if (entry?.origin !== 'external' && !await this.online()) throw new LocalizedError('library.offline', { path: this.root })
    if (entry) {
      const path = this.entryPath(entry)
      const current = await stampOf(path).catch(() => null)
      if (!current) throw new LocalizedError('library.offline', { path })
      if (!await this.matches(path, current, entry)) throw new LocalizedError('library.changed', { file: basename(path) })
      return { path, cacheKey: entry.origin === 'folder' && official(kind, id) ? id : 'sha256-' + entry.digest }
    }
    if (id !== basename(id)) throw new LocalizedError('error.unknownModel', { file: id })
    const path = join(kindDir(this.root, kind), id)
    if (!(await stat(path).catch(() => null))?.isFile()) throw new LocalizedError('library.offline', { path })
    if (!official(kind, id) || this.storage.library.root) throw new LocalizedError('library.changed', { file: id })
    const spec = kind === 'asr' ? findModelSpec(id) : findLocalLlmSpec(id)
    const checked = await checkedHash(path)
    if (checked.digest !== spec?.sha256) throw new LocalizedError('error.modelChecksum')
    const data = this.storage.library
    if (!data.entries.some(e => e.kind === kind && e.id === id)) {
      this.storage.saveLibrary({ ...data, entries: [...data.entries, { id, kind, origin: 'folder', location: id, ...checked }] })
    }
    return { path, cacheKey: id }
  }

  forget(kind: ModelKind, id: string, selected: boolean): void {
    const data = this.storage.library
    if (!data.entries.some(e => e.id === id && e.kind === kind && e.origin === 'external')) throw new LocalizedError('error.unknownModel', { file: id })
    this.storage.saveLibrary({ ...data, entries: data.entries.filter(e => !(e.kind === kind && e.id === id)) }, selected ? { kind } : undefined)
  }

  private async inventory(): Promise<DiskFile[]> {
    const files = (await Promise.all([diskFiles(this.root, 'asr', true), diskFiles(this.root, 'llm', true), diskFiles(this.root, 'llm', true, true)])).flat()
    const entries = this.storage.library.entries
    // The default directory belongs to Wave Subs. A user-selected directory may be a shared model collection.
    return files.filter(f => !entries.some(e => e.origin === 'external' && relative(e.location, f.path) === '') &&
      (!this.storage.library.root || entries.some(e => e.origin === 'folder' && relative(this.entryPath(e), f.path) === '')))
  }

  async plan(dir: string): Promise<ModelFolderPlan> {
    const dest = await realpath(dir)
    const src = await realpath(this.root).catch(() => this.root)
    const original = await stat(src).catch(() => null)
    const sourceOnline = await this.online()
    if (sourceOnline && (relative(src, dest) === '' || (original?.ino && sameFile(original, await stat(dest))))) throw new LocalizedError('library.nested')
    if (!(await stat(dest)).isDirectory()) throw new LocalizedError('library.offline', { path: dest })
    await access(dest, constants.R_OK)
    let moveUnavailable: ModelFolderPlan['moveUnavailable']
    if (inside(src, dest) || inside(dest, src)) moveUnavailable = 'nested'
    else if (!await access(dest, constants.W_OK).then(() => true, () => false)) moveUnavailable = 'readonly'
    let files: DiskFile[] = []
    if (sourceOnline && !moveUnavailable) {
      try { files = await this.inventory() } catch { moveUnavailable = 'unreadable' }
    }
    return { dir: dest, count: files.length, bytes: files.reduce((n, f) => n + f.stamp.size, 0), sourceOnline, moveUnavailable }
  }

  // Journal names are generated by this app. Remove only our temporary file and our exact reservation.
  async recover(): Promise<number> {
    const { pending, deferred = [], cleanup = [], downloads = [] } = this.storage.library
    if (!pending && !deferred.length && !cleanup.length && !downloads.length) return 0
    const retryDownloads = []
    for (const stage of downloads) {
      try { await cleanupDownload(stage) } catch { retryDownloads.push(stage) }
    }
    const remaining: PendingMove[] = []
    for (const journal of [...deferred, ...(pending ? [pending] : [])]) {
      if (!await stat(journal.dir).catch(() => null)) { remaining.push(journal); continue }
      try { await this.cleanPartial(journal) } catch { remaining.push(journal) }
    }
    const unfinished: Cleanup[] = []
    let retained = 0
    for (const job of cleanup) {
      if (relative(job.source, this.root) === '') { retained += job.files.length; continue }
      const retry: OriginalFile[] = []
      for (const f of job.files) {
        if (!await plainParent(job.source, f.path) || !await plainParent(job.dest, f.target.path)) {
          retry.push(f); continue
        }
        try {
          const source = await lstat(f.path).catch(e => { if (missing(e)) return null; throw e })
          if (!source) continue
          const target = await lstat(f.target.path)
          // A replacement (including a remounted volume) belongs to the user. Leave both files.
          if (!source.isFile() || !target.isFile() || sameFile(source, target) ||
              !sameStamp(source, f.stamp) || !sameStamp(target, f.target.stamp) ||
              this.storage.library.entries.some(e => e.origin === 'external' && relative(e.location, f.path) === '')) {
            retained++; continue
          }
          await rm(f.path)
        } catch { retry.push(f) }
      }
      if (retry.length) { unfinished.push({ ...job, files: retry }); retained += retry.length }
    }
    this.storage.saveLibrary({ ...this.storage.library, pending: undefined, downloads: retryDownloads.length ? retryDownloads : undefined,
      deferred: remaining.length ? remaining : undefined, cleanup: unfinished.length ? unfinished : undefined })
    return retained
  }

  private async cleanPartial(pending: PendingMove): Promise<void> {
    if (!/^wavesubs-[a-f\d-]{36}$/i.test(pending.token)) return
    for (const d of [pending.dir, join(pending.dir, 'llm')]) {
      if ((await lstat(d).catch(() => null))?.isDirectory()) await rm(join(d, '.' + pending.token + '.part'), { force: true })
    }
    // Undo only files this interrupted operation created. Existing or edited files stay.
    for (const f of pending.created ?? []) {
      if (!await plainParent(pending.dir, f.path)) continue
      const s = await lstat(f.path).catch(e => { if (missing(e)) return null; throw e })
      if (s?.isFile() && sameFile(s, f.stamp) && s.size === f.stamp.size && s.mtimeMs === f.stamp.mtimeMs &&
          (await checkedHash(f.path)).digest === f.digest && sameStamp(s, await stampOf(f.path))) await rm(f.path)
    }
    if (pending.target && await plainParent(pending.dir, pending.target)) {
      const marker = Buffer.from(pending.token)
      const info = await lstat(pending.target).catch(() => null)
      if (info?.isFile() && info.size === marker.length) {
        const file = await open(pending.target, 'r')
        try { if ((await file.readFile()).equals(marker)) await rm(pending.target) } finally { await file.close() }
      }
    }
  }

  async change(dir: string, move: boolean, bookmark: string | undefined, signal: AbortSignal,
    progress: (p: ModelMoveProgress) => void): Promise<{ retained: number }> {
    await this.recover()
    const plan = await this.plan(dir)
    if (move && !plan.sourceOnline) throw new LocalizedError('library.offline', { path: this.root })
    if (move && plan.moveUnavailable) throw new LocalizedError(plan.moveUnavailable === 'nested' ? 'library.nested' :
      plan.moveUnavailable === 'readonly' ? 'library.readOnly' : 'library.offline', { path: this.root })
    const dest = plan.dir
    const data = this.storage.library
    if (!move) {
      this.storage.saveLibrary({ ...data, root: dest, bookmark, ...await identifyFolder(dest) })
      return { retained: 0 }
    }
    const files = await this.inventory()
    const destinationStamp = await stat(dest)
    const pending: PendingMove = { dir: dest, token: 'wavesubs-' + randomUUID(), bookmark, created: [] }
    const copied = new Map<string, Stamp>()
    const digests = new Map<string, string>()
    const todo = []
    // Preflight every conflict before writing. An identical existing file takes zero additional space.
    for (const f of files) {
      signal.throwIfAborted()
      const parent = fileDir(dest, f)
      if ((await lstat(parent).catch(() => null))?.isSymbolicLink()) throw new LocalizedError('library.conflict', { file: parent })
      const target = join(parent, f.name)
      const exists = await lstat(target).catch(e => { if (missing(e)) return null; throw e })
      if (exists) {
        if (!exists.isFile() || exists.size !== f.stamp.size) throw new LocalizedError('library.conflict', { file: f.name })
        const { digest } = await checkedHash(f.path, signal)
        const verified = await checkedHash(target, signal)
        if (digest !== verified.digest) throw new LocalizedError('library.conflict', { file: f.name })
        digests.set(f.path, digest)
        copied.set(f.path, verified.stamp)
      }
      else todo.push(f)
    }
    const needed = todo.reduce((n, f) => n + f.stamp.size, 0)
    const space = await statfs(dest, { bigint: true })
    if (BigInt(needed) > space.bavail * space.bsize) throw new LocalizedError('library.space', { mb: Math.ceil(needed / 1048576) })
    this.storage.saveLibrary({ ...data, pending })
    let done = 0
    try {
      for (const f of todo) {
        signal.throwIfAborted()
        const parent = fileDir(dest, f)
        if (parent !== dest) await mkdir(parent).catch(e => { if (e.code !== 'EEXIST') throw e })
        const target = join(parent, f.name)
        if (!await plainParent(dest, target)) throw new LocalizedError('library.conflict', { file: parent })
        const temp = join(parent, '.' + pending.token + '.part')
        const input = createReadStream(f.path)
        const hash = createHash('sha256')
        let last = 0
        input.on('data', chunk => {
          hash.update(chunk)
          done += chunk.length
          if (Date.now() - last > 120) { progress({ file: f.name, done, total: needed }); last = Date.now() }
        })
        await pipeline(input, createWriteStream(temp, { flags: 'wx', flush: true }), { signal })
        const digest = hash.digest('hex')
        digests.set(f.path, digest)
        const verified = await checkedHash(temp, signal)
        if (digest !== verified.digest) throw new LocalizedError('error.modelChecksum')
        signal.throwIfAborted()
        pending.target = target
        pending.created!.push({ path: target, ...verified })
        this.storage.saveLibrary({ ...this.storage.library, pending })
        // Reserve exclusively, then atomically replace our reservation. Works on exFAT as well as NTFS/APFS.
        await writeFile(target, pending.token, { flag: 'wx' })
        await rename(temp, target)
        copied.set(f.path, await stampOf(target))
        progress({ file: f.name, done, total: needed })
      }
      for (const f of files) {
        if (!sameStamp(await stampOf(f.path), f.stamp) ||
            !sameStamp(await stampOf(join(fileDir(dest, f), f.name)), copied.get(f.path)!)) {
          throw new LocalizedError('library.changed', { file: f.name })
        }
      }
      signal.throwIfAborted()
      const entries = data.entries.map(e => {
        if (e.origin !== 'folder') return e
        const old = this.entryPath(e)
        const original = files.find(f => f.path === old)
        return original && digests.get(old) === e.digest ? { ...e, stamp: copied.get(old)! } : e
      })
      for (const f of files) {
        const spec = f.kind === 'asr' ? findModelSpec(f.name) : findLocalLlmSpec(f.name)
        if (f.atRoot || !spec || digests.get(f.path) !== spec.sha256 || entries.some(e => e.kind === f.kind && e.id === f.name)) continue
        entries.push({ id: f.name, kind: f.kind, origin: 'folder', location: f.name,
          stamp: copied.get(f.path)!, digest: spec.sha256 })
      }
      const originals = files.filter(f => entries.some(e => e.kind === f.kind && e.origin === 'folder' &&
        fileDir(dest, e) === fileDir(dest, f) && e.location === f.name && e.digest === digests.get(f.path)))
      const job = { source: this.root, dest, bookmark: data.bookmark, destBookmark: bookmark,
        files: originals.map(f => ({ path: f.path, stamp: f.stamp, target: { path: join(fileDir(dest, f), f.name),
          stamp: copied.get(f.path)!, digest: digests.get(f.path)! } })) }
      if (!sameFile(destinationStamp, await stat(dest))) throw new LocalizedError('library.offline', { path: dest })
      this.storage.saveLibrary({ ...this.storage.library, root: dest, bookmark, entries, ...await identifyFolder(dest), pending: undefined,
        deferred: data.deferred, cleanup: [...(data.cleanup ?? []), job] })
      const retained = await this.recover()
      return { retained: retained + files.length - originals.length }
    } catch (err) {
      await this.recover().catch(() => {}) // A disconnected destination can be cleaned when it returns.
      throw err
    }
  }
}
