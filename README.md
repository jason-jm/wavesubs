# Wave Subs

**English** · [简体中文](./readme/README.zh-CN.md) · [日本語](./readme/README.ja.md) · [한국어](./readme/README.ko.md) · [Français](./readme/README.fr.md) · [Deutsch](./readme/README.de.md) · [Русский](./readme/README.ru.md) · [Bahasa Indonesia](./readme/README.id.md) · [Bahasa Melayu](./readme/README.ms.md) · [Tiếng Việt](./readme/README.vi.md) · [ไทย](./readme/README.th.md)

**Can't find subtitles for a video?** Wave Subs generates SRT / ASS subtitles from any video with local AI and translates them into your language. Recognition, timing, translation, on-screen text and editing all run on your own computer: nothing is uploaded, no account is needed, and it is free and open source. macOS (Apple Silicon) and Windows.

[![Release](https://img.shields.io/github/v/release/jason-jm/wavesubs?label=download)](https://github.com/jason-jm/wavesubs/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/macOS%2012%2B%20Apple%20Silicon%20%7C%20Windows%2010%2B-lightgrey)

**Website:** https://wavesubs.com (11 languages) · [Download](https://github.com/jason-jm/wavesubs/releases/latest) · [Changelog](CHANGELOG.md) · [Privacy policy](https://wavesubs.com/en/privacy.html)

![The subtitle editor with video preview](docs/assets/shots/en-dark-editor.jpg)

## How it works

1. **Drop in a video, a subtitle file, or a whole folder.** MKV, MP4, MOV, TS, AVI and anything else ffmpeg can read, including audio-only files. If the video already carries a text subtitle track, it is detected and used directly.
2. **Local AI recognizes the dialogue and aligns it.** whisper.cpp recognizes the speech on your machine with automatic language detection. Every cue is then snapped to the moment the line is actually spoken.
3. **Translate and export.** A local Qwen3 model translates into your language (or a cloud service, if you plug one in). The result is written as SRT or ASS next to the video, with a quality verdict that tells you which lines are worth a look.

A two-hour film takes about 3–6 minutes to recognize with Large v3 Turbo on an M-series Mac, plus a few minutes for local translation. Drop in a season and let it run.

## What you get

### Three subtitle sources

- **Speech recognition.** The Whisper model family (Tiny through Large v3) via whisper.cpp, Metal-accelerated on Apple Silicon. Recognition covers the nearly 100 languages Whisper supports. The spoken language is detected by sampling five 20-second windows where speech is densest and letting them vote, so an opening theme cannot mislabel an episode; you can also set the language yourself.
- **Embedded subtitle tracks.** Text tracks inside MKV / MP4 files are detected and preferred over recognition (faster and exact); you choose the track per file when there are several. Bitmap subtitles (PGS, VobSub, DVB) are not usable as a source.
- **External subtitle files.** 18 formats, including SRT, ASS / SSA, WebVTT, SAMI, MicroDVD, SubViewer, MPL2, VPlayer, JACOsub, RealText, STL, PJS, LRC, TTML / DFXP and SBV. The file encoding is detected automatically (UTF-8, UTF-16, GBK, Big5, Shift-JIS, EUC-KR, Windows-1252).

### Timing that follows the speech

- Cue boundaries are aligned to the actual speech with voice activity detection (Silero VAD) and loudness analysis. The parameters were calibrated against the official subtitles of six full-length films, not guessed.
- Lines that Whisper hallucinates where nobody speaks are removed, music-only ♪ cues are dropped, and stuttered repetitions (やばいやばいやばい) are collapsed.
- Long cues are split at natural boundaries, with language-specific rules for Japanese.

### Translation

- **29 target languages:** Chinese (Simplified and Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Italian, Dutch, Russian, Ukrainian, Polish, Czech, Hungarian, Swedish, Danish, Norwegian, Finnish, Greek, Turkish, Hebrew, Arabic, Hindi, Thai, Vietnamese, Indonesian and Malay. On first launch the target defaults to your system language.
- **Local by default.** Qwen3 models from 1.7B to 32B run on your machine through llama.cpp, downloaded inside the app. Free, offline, no quota.
- **Cloud if you want it.** Any OpenAI-compatible API with your own key, with quick-fill presets for OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Qwen, Zhipu GLM, Moonshot, Volcano Ark, SiliconFlow, OpenRouter and Azure OpenAI. The key is stored encrypted with the operating system's credential store. Only the subtitle text is sent, never the video.
- **Glossary.** Pin the translation of names and terms once and a whole season stays consistent. Only the entries that occur in the current batch are injected, and the glossary applies to dialogue and on-screen text alike.
- **One name, one spelling.** A final pass groups every recurring proper noun and rewrites minority spellings to the majority one, so a character is not "Weber" in episode 3 and "Webber" in episode 4.
- **Made for subtitles, not paragraphs.** Lines are translated in batches with alignment anchors so a translation can never slip onto the neighbouring line; half a sentence stays half a sentence; garbled transcripts still get the most plausible translation instead of a blank; a model that hands the source back untranslated is caught in every retry round.
- **Output:** translation only, bilingual, or source only, as SRT or ASS.

### On-screen text

Turn on "Translate on-screen text" and signs, notes, text messages and chat bubbles, notices, documents, title cards, episode titles and name plates are read off the picture and translated too.

- Uses the text recognition built into the operating system: Vision on macOS, Windows.Media.Ocr on Windows. No extra model to download; a 24-minute episode takes two to three minutes longer, in parallel with speech recognition.
- Each translation is placed next to the original: directly below, then beside it, then at the top of the frame, and over the original only as a last resort. It never enters the space the dialogue subtitle occupies, and the type shrinks before anything gets covered. Only a full screen of text (an e-mail, a message thread, a document) is replaced by an opaque plate.
- What stays out: opening and closing credits (including cast and voice-actor lists), subtitles burned into the picture, station logos and watermarks, dense labels such as map markers and book spines, a door sign that keeps recurring through a film, emoticons garbled by recognition, and translations identical to the original.
- In ASS output the text is positioned at the original; SRT puts it at the top. The editor keeps speech subtitles and on-screen text in separate tabs, and the same file always produces the same result.

### An editor with video preview

- Edit text and timing in a table; insert, delete, merge, undo; changes are saved automatically.
- Click any line to hear exactly how it was said. Formats a browser cannot play (HEVC, DTS, TrueHD) are previewed through the bundled ffmpeg.
- Quality findings are clickable. Lines whose source you edited are marked, and a retranslation touches only those lines.
- Export again at any time: SRT or ASS, translation only, bilingual or source only.

### A quality report for every file

Each finished file gets a verdict (checks passed, worth reviewing, issues found) with the reasons: speech coverage, gaps, over-long cues, reading speed too fast, missing translations, source text left in the translation, reversed timing. The thresholds come from full-film benchmarks, and every finding links to the line in the editor.

### A whole season at once

- Drop in a folder. Files are processed one after another; one failure does not stop the batch; cancel any time.
- Every file follows the shared settings, and any file can override the subtitle source, audio track, language, translation service or format.
- Progress shows the current stage and an estimated time remaining; the finished card tells you which device did the recognition (an Apple M-series GPU, a Vulkan GPU or the CPU).
- Nothing is done twice. Recognition is cached by file identity plus every parameter that affects it, so re-exporting or changing the format takes seconds. A translation is reused only when the engine and model, target language, prompt version and glossary all match; otherwise it is redone in full, and old output is never mixed in.

### Models, downloaded inside the app

- On first launch the Convert page recommends a model for your machine and offers "Download and continue"; you can start the moment the download finishes.
- The Models page labels each model fit, usable or too heavy for your memory and shows how accurate it is for your language (see below). Downloads come from Hugging Face or ModelScope (tried first in mainland China), are verified against their SHA-256, and if every source fails the app lists direct URLs so you can fetch the file yourself and drop it into the model folder.

### Interface

32 interface languages (Arabic, Bengali, Chinese Simplified and Traditional, Czech, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Malay, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Spanish, Swedish, Thai, Turkish, Ukrainian, Vietnamese), light and dark mode, ten colour palettes, full keyboard focus. The app checks for a new version once at launch (a switch in Settings turns this off) and offers a download button; copies installed with Homebrew or Scoop get the matching upgrade command instead.

## Choosing a recognition model

The Whisper models differ far more by language than by size. The table shows meaning retention: the share of recognized lines whose meaning survived intact, judged blind on 50 sentences from a 30-minute excerpt of an English film (*Spotlight*), a German film (*Ballon*) and a Japanese drama (NHK, *The 13 Lords of the Shogun*), run through the actual product pipeline. Korean and Mandarin sit in the same tier as Japanese in public benchmarks; Spanish, Italian and Portuguese do a little better than German, French, Dutch and Polish a little worse.

| Model | Download | RAM in use | English | European languages | Japanese · Korean · Chinese |
|---|---|---|---|---|---|
| Tiny | 75 MB | 0.5 GB | 68 % | 49 % | 37 % |
| Base | 142 MB | 0.7 GB | 79 % | 61 % | 57 % |
| Small | 466 MB | 1.2 GB | 92 % | 81 % | 66 % |
| Medium | 1.5 GB | 2.6 GB | 91 % | 81 % | 79 % |
| Large v3 Turbo | 1.6 GB | 2.2 GB | 95 % | 96 % | 89 % |
| Large v3 | 3.0 GB | 4.5 GB | 96 % | 94 % | 88 % |

The app labels 85 % and above *recommended*, 75 % *usable*, 60 % *marginal*, and anything lower *not advised*. In short: Small is enough for English, usable for European languages, and Japanese, Korean and Chinese want Large v3 Turbo or better. Large v3 Turbo is within a point of Large v3 in quality on full films while running about three times faster, so it is the default recommendation on most machines.

| Your machine | Recognition | Translation | Notes |
|---|---|---|---|
| Mac 8 GB | Small or Large v3 Turbo | Qwen3 1.7B | Works; keep other apps closed for Turbo |
| Mac 16 GB | Large v3 Turbo | Qwen3 8B | The default balance of quality and speed |
| Mac 32 GB | Large v3 | Qwen3 14B | Best recognition, more accurate translation |
| Mac 48 GB or more | Large v3 | Qwen3 32B | Best translation quality, slower |
| Windows PC 16 GB | Large v3 Turbo | Qwen3 4B | CPU recognition; expect several times the Apple Silicon time |
| Windows PC 32 GB | Large v3 Turbo | Qwen3 8B | Larger models run; allow extra time |

Local translation models: Qwen3 1.7B (1.8 GB download, 2.5 GB RAM), 4B (2.4 GB, 3.5 GB), 8B (4.9 GB, 6 GB), 14B (9.0 GB, 10.5 GB), 32B (19.7 GB, 22 GB). Recognition and translation run one after the other, never both at once.

## Measured accuracy

From a 70-film full-length corpus (official subtitle tracks and well-known fansub releases as ground truth; 36 Japanese, 21 English, 13 other), September 2026:

- **Recognition (Whisper Large v3):** English, 19 films, average word error rate 17.4 % (documentaries and interviews about 6 %, official series 10–13 %). Japanese, 18 films, character error rate 19.1 %, reading-level 13.8 %; about a third of the "errors" are spelling variants (分かった vs わかった). German, Norwegian and Italian official subtitles are condensed rewrites and cannot be scored verbatim.
- **Translation (Japanese → Chinese, local Qwen3):** with a human transcript as input, meaning-preservation accuracy is 93.5 % for 8B, 94.4 % for 14B and 93.9 % for 32B, so the 8B default is a sound choice. End to end (recognition → translation) it is about 83–85 %; nearly all of the gap comes from recognition errors.
- **Timing:** frame-level mask F1 81.8 %; 57 % of cue starts fall within ±250 ms of the human subtitle. Human subtitles from different releases themselves differ by 100–300 ms in lead time.

## Privacy

There is no account, no analytics and no server. The video never leaves your computer; recognition, alignment, translation, on-screen text and editing all run locally, and once the models are downloaded the app works with the network off.

Exactly three things touch the network, and each one is under your control:

1. **Model downloads**, from Hugging Face or ModelScope, when you ask for a model.
2. **Cloud translation**, only if you configure a provider yourself; it receives the subtitle text, and that provider bills you directly.
3. **The update check** at launch, which fetches a small JSON file from this repository's GitHub Release. It can be turned off in Settings, and the App Store build does not check at all.

Full policy: https://wavesubs.com/en/privacy.html

## Requirements and installation

| | macOS | Windows |
|---|---|---|
| Requirements | macOS 12 or later, Apple Silicon (M1 and later) | Windows 10 or later, x64, 16 GB RAM recommended |
| Download | [DMG or ZIP](https://github.com/jason-jm/wavesubs/releases/latest), notarized by Apple | [Installer or portable ZIP](https://github.com/jason-jm/wavesubs/releases/latest) |
| Package manager | `brew install --cask jason-jm/wavesubs/wavesubs` | `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs`<br>`scoop install wavesubs` |
| Acceleration | Metal (recognition and translation) | Recognition on the CPU; translation on any GPU with a Vulkan driver, CPU otherwise |

ffmpeg, whisper.cpp and llama.cpp are bundled: install and go. Speech recognition models are 75 MB to 3 GB, local translation models 1.8 to 20 GB; both are downloaded on demand inside the app. Intel Macs are not supported: local recognition depends on Metal, and on Intel it would be too slow to be useful.

**Windows:** the installer is not code-signed yet, so SmartScreen shows "Windows protected your PC" on first run. Click *More info → Run anyway*. Checksums for every file are in `SHA256SUMS.txt` on the release page. For on-screen text, install the Windows language pack for the spoken language with *Optical character recognition* ticked.

## Known limitations

- On Windows, on-screen text recognition is weaker than on macOS; vertical Japanese is mostly missed.
- A row of names outside the credit roll (actor names on a theatre poster, lead billing shown half a minute before the staff roll) is still translated.
- Local models up to 8B are not reliable on proper nouns such as institution names and historical terms. The glossary is the dependable fix.
- A release that already burns its own on-screen-text translation into the picture will show both.
- No Intel Mac or Windows ARM64 builds; Windows recognition is CPU-only.

## Frequently asked questions

**Which videos can it subtitle?** MKV, MP4, MOV, TS, AVI and other common formats; HEVC, DTS and TrueHD streams that browsers cannot play are fine too, because the bundled ffmpeg decodes everything. Audio-only files work as well.

**Which languages?** Recognition covers the nearly 100 languages Whisper supports, with automatic detection; there are 29 translation targets; the interface comes in 32 languages.

**Does it really work without internet?** Yes. Only the one-time model download, cloud translation you configure yourself, and the optional update check use the network.

**How accurate is it?** See *Choosing a recognition model* and *Measured accuracy* above. Pick the model by your language, and every file comes with a quality verdict.

**The video already has a subtitle track.** Embedded text tracks are detected and preferred, skipping straight to translation. Bitmap tracks (PGS / VobSub) are the exception.

**Model downloads fail in mainland China.** All models are available from ModelScope, which the app tries first when the system language is Simplified Chinese or the time zone is in China. If every source fails, the error lists direct URLs for a browser or download manager.

**How is this different from online subtitle generators?** Online tools make you upload the whole film, charge per minute and cap the length. Wave Subs uploads nothing, costs nothing and has no length limit; speed depends on your machine.

## Feedback and support

- [Bug reports and feature requests](https://github.com/jason-jm/wavesubs/issues) on GitHub, or the [feedback form](https://wavesubs.com/feedback.html) if you have no GitHub account. A failed task has a one-click *Copy log* button; paste that log into the report.
- [Discussions](https://github.com/jason-jm/wavesubs/discussions) for questions and setups.
- [Changelog](CHANGELOG.md) for what changed in each version.

## License

Wave Subs is released under the [MIT License](./LICENSE). The bundled third-party components (ffmpeg under LGPL, whisper.cpp and llama.cpp under MIT, the Whisper and Qwen models, and others) carry their own licenses, listed in [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).

*Building from source, the command-line interface and the code layout are described in [DEVELOPMENT.md](./DEVELOPMENT.md).*
