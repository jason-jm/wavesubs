# Developing Wave Subs

This file is for people who build the app from source. If you only want to use Wave Subs, the [README](./README.md) and the [website](https://wavesubs.com) are all you need.

Wave Subs is an Electron app (TypeScript, React) around a domain core that also drives a command-line entry point. Speech recognition is whisper.cpp, voice activity detection is Silero VAD, local translation is llama.cpp serving Qwen3 GGUF models, and media handling is ffmpeg. All of these ship inside the app as subprocess binaries.

## Repository conventions

- Everything public in the repository is in English: commit messages, `README.md`, `CHANGELOG.md`, issue templates. The other `README.<lang>.md` files are translations of the English README; the Chinese changelog lives in `CHANGELOG.zh-CN.md`.
- Nothing unrelated to the program lives in the repository: marketing material (posters, store screenshots, social copy), the per-version release notes and the Homebrew cask source are kept in local folders next to the checkout (`../marketing/`, `../store/`). `scripts/make-latest.ts` reads the release notes from `../store/` (override with `WAVESUBS_STORE_DIR`).
- The release chain (signing, notarization, GitHub Release, `latest.json`, website, Homebrew, Scoop) is documented in [RELEASE.md](./RELEASE.md).

## Development setup

```bash
brew install ffmpeg whisper-cpp
npm install
# Download a Whisper model (kept in models/ during development)
curl -L -o models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

Other models (`ggml-small.bin`, `ggml-medium.bin`, `ggml-large-v3-turbo.bin`, `ggml-large-v3.bin`) go in `models/` as well. The on-screen text helper for macOS (`vision-ocr`, a small Swift program around the Vision framework) is built with `npm run build:native`; on Windows the helper is a PowerShell script in `native/win-ocr/` and needs no build step.

Environment variables that help while developing:

| Variable | Effect |
|---|---|
| `WAVESUBS_MODELS_DIR` | Point the app at an empty directory to reproduce the first-run flow |
| `WAVESUBS_DEBUG_PORT` | Open a DevTools protocol port (used by the screenshot scripts) |
| `WAVESUBS_UPDATE_URL` | Read a local `latest.json` instead of the GitHub Release asset when testing the update check |

## Usage

```bash
# GUI (development mode)
npm run dev

# CLI: transcribe to a source-language SRT next to the video
npm run cli -- /path/to/movie.mkv

# List audio and subtitle tracks in a file
npm run cli -- /path/to/movie.mkv --list-tracks

# Use embedded subtitle track 3, translate to bilingual Chinese ASS
npm run cli -- /path/to/movie.mkv --sub-track 3 --translate --content bilingual --format ass

# Translate an existing subtitle file (format and encoding auto-detected)
npm run cli -- /path/to/movie.chs.ass --translate --target zh

# Type check
npm run typecheck
```

## Platform notes

| | macOS | Windows |
|---|---|---|
| Architecture | Apple Silicon (arm64) | x64 |
| Minimum version | macOS 12 | Windows 10 |
| Package | DMG / ZIP | NSIS installer / portable ZIP |
| Bundled dependencies | self-built LGPL ffmpeg + static whisper/llama | official prebuilt LGPL ffmpeg (shared) + whisper (non-BLAS) / llama (Vulkan) |
| Acceleration | Metal | Recognition on CPU; translation on a Vulkan GPU when one is present (CPU fallback) |
| On-screen text OCR | Vision framework (`vision-ocr`, built at bundle time) | `Windows.Media.Ocr` through PowerShell 5.1 (`native/win-ocr/win-ocr.ps1`) |
| Signing | Developer ID + notarization | not code-signed yet (SmartScreen warns) |

The feature set is identical on both platforms. The Windows build cross-compiles on macOS without Wine (`npm run release:win`). The platforms differ in three places, each branched in code:

- Window chrome: macOS uses `hiddenInset` with the traffic lights inside the sidebar; Windows uses `titleBarOverlay` (button colours follow the theme).
- Binary lookup: Windows appends `.exe`; whisper and llama each get their own directory because both ship a `ggml.dll` of a different version and Windows resolves DLLs from the executable's directory first.
- Font stacks: both system font stacks live in the same CSS.

Things that can only be verified on a real Windows machine are listed in [RELEASE.md](./RELEASE.md).

## Packaging and signing

```bash
npm run dist          # electron-vite build → electron-builder → scripts/sign.ts
```

electron-builder is configured with `identity: null`; all signing is done inside-out by `scripts/sign.ts`, which picks an identity in this order: `WAVESUBS_SIGN_IDENTITY` (or `CSC_NAME`) → a Developer ID Application certificate in the keychain → a self-signed certificate whose name contains `Wave Subs` → ad-hoc.

**Ad-hoc signing makes the keychain prompt repeatedly**: its designated requirement is the executable's cdhash, which changes with every build, and keychain items record exactly that requirement. After each rebuild, the first use of cloud translation (safeStorage decrypting the API key) prompts "Wave Subs wants to use your confidential information stored in 'Wave Subs Safe Storage'".

For local development, create a fixed certificate once: Keychain Access → Certificate Assistant → Create a Certificate…, name `Wave Subs Self-Signed`, identity type "Self-Signed Root", certificate type "Code Signing". Public releases use a Developer ID Application certificate, which never prompts on the user's side.

## Migrating user data from the SubFlow name

The product was called SubFlow until 2026-08-23.

`app.getPath('userData')` derives from `app.getName()`, so the rename moves it from `~/Library/Application Support/subflow` to `.../Wave Subs`. `src/main/migrate.ts` moves the old settings on startup (**before** `new SettingsStore()`), renaming the model directory instead of copying it — it is several GB.

**The one thing that cannot migrate is the cloud API key.** safeStorage's master key lives in the keychain item `subflow Safe Storage`, whose name also follows `app.getName()`; after the rename Electron creates a fresh `Wave Subs Safe Storage` with a new random key, so the old ciphertext is mathematically unrecoverable. Migration therefore drops the `apiKeyEnc` field — keeping ciphertext that can never be decrypted would only make the settings page claim a key is configured. `hasApiKey` then honestly returns false and the existing "configure a key" prompt appears.

## Self-checks

All must be green before a release (see RELEASE.md). Each one pins a class of silent failure — wrong output without an error:

| Script | What it pins |
|---|---|
| `check-i18n` | all 32 languages have every key, placeholders match |
| `check-css` | layout invariants at the computed-style level (catches selector-specificity accidents) |
| `check-batch` | batch merge rules + automatic track selection by language |
| `check-cache` | **cache invalidation matrix**: model / glossary / prompt changes force a retranslation |
| `check-glossary` | glossary injection and hit filtering; an empty glossary leaves the prompt byte-identical |
| `check-qc` | QC rules in both directions (report what should be reported, stay quiet otherwise) |
| `check-editor` | editor operations (time parsing round-trip, merge, stale marks, undo) |
| `check-preview` | Range parsing + real ffmpeg segment generation (including broken inputs) |
| `check-download` | model download: mirror fallback, region ordering, cancellation, checksum failures |
| `check-timing` | timing post-processing (music-only cues, repeated-phrase collapse) |
| `check-translate` | batch response parsing of malformed model output; copied-back source rejected in every round; prompt composition |
| `check-terms` | proper-noun consistency pass |
| `check-signs` | on-screen text: line grouping / tracking / credit windows / burned-in band geometry, judge alignment anchors and read-aloud override, on-screen cap, ASS/SRT output |
| `check-output` | output fallback matrix (writable in place, read-only fallback, no fallback error) |
| `check-update` | version comparison, `latest.json` parsing, release-notes language fallback |
| `check-site` | website: all 11 language pages, assets, language auto-redirect matrix |

`bench/` holds the subtitle quality benchmark (WER / CER / timing against official subtitles). The evaluation corpus stays local and is not part of the repository.

## Code layout

```
src/main/core/        domain core (Electron-free, reused by the CLI)
  jobstore.ts         job cache: source stage / translation reuse, 4-tuple invalidation
  pipeline.ts         job orchestration: probe → extract → transcribe → signs → translate → write
  media.ts            ffprobe/ffmpeg wrapper: probing, audio extraction
  preview.ts          segment preview: frame sequence + AAC (for formats Chromium can't play)
  asr/                whisper.cpp subprocess wrapper, model catalog, VAD
  translate/          local llama-server and cloud providers, prompt, batch parser, glossary, term consistency
  signs/              on-screen text: OCR helpers, block grouping/tracking, judging, layout
  subtitle/           Cue model, SRT/ASS serialization, import of external formats, timing, QC
src/main/index.ts     Electron main process + IPC
src/main/updates.ts   check for updates (static latest.json on the GitHub Release)
src/main/media-protocol.ts  wsmedia:// media protocol (Range + path allowlist)
src/preload/          typed API exposed through contextBridge
src/renderer/         React UI
src/shared/           types, i18n (32 locales), target languages, palettes, update manifest parsing
native/               vision-ocr (Swift, macOS) and win-ocr (PowerShell, Windows)
scripts/              CLI entry, self-checks, bundling, signing, website generator, screenshot tooling
```
