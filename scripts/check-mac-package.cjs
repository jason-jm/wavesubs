// electron-builder afterPack hook. Also accepts a packaged .app on the command line.
const { execFileSync } = require('node:child_process')
const { openSync, readSync, closeSync, readdirSync, statSync } = require('node:fs')
const { join, relative } = require('node:path')
const target = require('../package.json').build.mac.minimumSystemVersion
const helpers = ['ffmpeg', 'ffprobe', 'whisper-cli', 'whisper-vad-speech-segments', 'llama-server', 'vision-ocr']
const machoMagic = new Set([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca])

function isMachO(file) {
  const fd = openSync(file, 'r')
  try {
    const header = Buffer.alloc(4)
    return readSync(fd, header, 0, 4, 0) === 4 && machoMagic.has(header.readUInt32BE())
  } finally {
    closeSync(fd)
  }
}

function* machOFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) yield* machOFiles(file)
    else if (entry.isFile() && isMachO(file)) yield file
  }
}

function versionNumber(version) {
  const [major, minor = 0, patch = 0] = version.split('.').map(Number)
  return major * 65536 + minor * 256 + patch
}

function checkMacPackage(app) {
  const contents = join(app, 'Contents')
  const plist = join(contents, 'Info.plist')
  const declared = execFileSync('plutil', ['-extract', 'LSMinimumSystemVersion', 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim()
  if (declared !== target) throw new Error(`Info.plist declares macOS ${declared}, expected ${target}`)
  const bin = join(contents, 'Resources', 'vendor', 'bin')
  for (const helper of helpers) {
    const path = join(bin, helper)
    if (!(statSync(path).mode & 0o111) || !isMachO(path)) throw new Error(`${helper} is not a Mach-O executable`)
    // Monterey lacks the macOS 14 camera constant and the macOS 13.3 BLAS ABI.
    // Guarded weak imports from the current SDK can still be used on newer systems.
    const undefinedSymbols = execFileSync('nm', ['-arch', 'arm64', '-um', path], { encoding: 'utf8' })
    const unavailable = undefinedSymbols.split('\n').find(line => line.includes('(undefined) external ') && (
      (versionNumber(target) < versionNumber('14.0') && line.includes('_AVCaptureDeviceTypeContinuityCamera')) ||
      (versionNumber(target) < versionNumber('13.3') && line.includes('$NEWLAPACK'))
    ))
    if (unavailable) throw new Error(`${helper} requires a symbol unavailable on macOS ${target}: ${unavailable.trim()}`)
  }

  let count = 0
  for (const file of machOFiles(contents)) {
    const info = execFileSync('vtool', ['-arch', 'arm64', '-show-build', file], { encoding: 'utf8' })
    const platform = /\bplatform\s+(\w+)/.exec(info)?.[1]
    const minimum = /\bminos\s+(\d+(?:\.\d+){0,2})/.exec(info)?.[1]
    if (platform !== 'MACOS' || !minimum || versionNumber(minimum) > versionNumber(target)) {
      throw new Error(`${relative(app, file)}: expected arm64 macOS <= ${target}, found ${platform} ${minimum}. Rebuild native tools with npm run build:mac-deps.`)
    }
    count++
  }
  console.log(`Verified ${count} Mach-O files for arm64 macOS ${target} in ${app}`)
}

module.exports = function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
    checkMacPackage(join(appOutDir, packager.appInfo.productFilename + '.app'))
  }
}

if (require.main === module) checkMacPackage(process.argv[2])
