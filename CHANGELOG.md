# Changelog

[中文版](./CHANGELOG.zh-CN.md)

## 1.0.8 — 2026-09-20

- Settings: "Check for updates automatically" is now "Check for updates at launch", with the note "Checks for a new version once when the app starts". It only checks once, at launch; the old wording suggested it kept checking while running.

## 1.0.7 — 2026-09-20

- **Translate on-screen text (macOS).** A new switch in the conversion settings (requires translation to be on). The system Vision OCR reads the picture once a second; lines are grouped, tracked across frames and handed to the translation model, which decides what the viewer needs to understand — signs, notes, text messages and chat bubbles, notices, documents, title cards, name plates — and translates it. The result is written into the ASS at the position of the original (SRT places it at the top). No model to download; a 24-minute episode takes two to three minutes longer, in parallel with speech recognition.
- **The translation sits next to the original and covers it only as a last resort.** Four placements are tried in order: directly below the original → in the free space to its left or right → at the top of the frame → over the original. Yielding runs in three rounds: first avoid every piece of original text on screen, then at least avoid the block being translated, and if both fail the font is reduced and the search repeats. Smaller type is better than hiding the original. Only a full screen of e-mail, messages or documents is replaced by a dark plate; two-line date cards and huge titles are always placed beside the original.
- **The bottom always belongs to the dialogue.** When a dialogue subtitle is on screen, on-screen text never enters the height it occupies, measured from the actual number of dialogue lines.
- **Every visible block gets a translation.** Up to eight fit on one screen; a block is kept even when the dialogue says the same thing (an empty bubble next to a translated one just looks like a bug); when none of the three placements fit, the text is placed at the minimum size rather than dropped.
- **What must not appear does not appear:** opening and closing credits (whole runs removed by job-title density; the character / voice-actor list at the end is recognized too), subtitles burned into the source (recognized by the geometry of a fixed centred band in the lower half), station logos and channel watermarks, emoticons garbled by OCR in chat bubbles, and translations identical to the original (English copied verbatim, characters shared by Chinese and Japanese, Japanese name captions that were merely converted from traditional to simplified characters).
- Editor: speech subtitles and on-screen text are two tabs, each with its own insert, edit and delete; the preview overlays on-screen text at its computed position and size.
- The finished card shows the number of on-screen text lines; the switch is also available on the Batch page.
- **The glossary now applies to on-screen text as well.** It used to reach only the dialogue, so the same name could differ between the two tracks; changing the glossary now retranslates dialogue and on-screen text together.
- **Small models translated only the first few words of long lines.** With Qwen3 1.7B on an NHK documentary episode, "ことし6月東北地方の大連市で…" came out as "This June" and "招待されたのは28の国と…" as "Those invited were": the whole episode was the first phrase of each line. The cause was the alignment anchor in the prompt, which asks the model to copy the first four characters of the source before translating; small models applied that to the translation too. The prompt now states that the anchor is only for checking and that the translation must cover the whole line. Tested with 1.7B: all 12 lines of the sample come out complete. Prompt revision +1, so cached translations are redone.
- **Whole batches from small models are no longer thrown away.** With Tiny + Qwen3 1.7B on an NHK documentary episode, 36 of 397 dialogue lines had no translation and 62 "translations" were the Japanese source copied back. Two causes: (1) small models often return one array per line, JSONL, or get cut off mid-output, and the parser accepted only a single complete array, so a batch of 20 good translations was discarded and retried in smaller batches and line by line — where small models most often copy the source back; (2) the "source language left in the translation" check ran only in the first round, so copies from the smaller-batch and single-line rounds went straight into the subtitles, showing the same Japanese line twice in bilingual mode. Objects are now extracted one by one and every salvageable row is kept, and copied-back source is rejected in every round. In the same episode, lines with no translation or a copied-back source fell from 98 to 56; the rest are transcripts so garbled that the model refused three times (a Tiny problem; Large v3 Turbo has none).
- **Small models no longer hand the source back as the translation.** Re-sending the three transcripts of that episode and saving the raw model output showed 1.7B copying the Japanese source verbatim in 16–26 % of lines on the first pass, and whole batches when the transcript had errors; dozens of lines were still blank after three retries. On the five hardest batches (three runs each), adding only a "do not copy" instruction changed nothing (40 % → 40 %), adding only an example pair reached 58 %, both together 88 %, and raising the temperature did nothing. The prompt now carries an example pair chosen by source and target language plus "even if the source is a speech transcript with errors or broken grammar, translate the most plausible meaning". Prompt revision +1, so cached translations are redone.
- **One proper noun, one spelling.** Translation runs in batches with no memory between them, so a name could appear as 韦伯 in one batch and 威伯 in the next. A final pass groups translations by the recurring proper nouns in their source and rewrites the minority spelling to the majority one.
- **Translations stick to where the original currently is.** Tracking across frames looked only at the text, so a block that moved (a chat log scrolling up as a new message arrives, a camera panning across a sign) stayed attached to the same track while the stored position was the median of all frames — a position it never actually had. On one screen of chat, all four translations hung on the wrong bubbles. Tracks are now cut into segments by position: a shift of more than half a line height starts a new segment, and each segment gets the position its original really occupied.
- **Consecutive repeats of the same text are judged once.** After the segmentation the same bubble could become four or five entries; judging them separately took several times longer and, with no memory between batches, produced two or three different wordings — the viewer saw the translation change every time the bubble scrolled one step. Identical text less than 30 seconds apart is chained and judged once, the rest copy the result.
- **The same file twice gives the same subtitles.** Judging now uses greedy decoding with a fixed seed; it used to be random, and three runs of one episode gave three different on-screen text counts.
- **The Models page gives per-language guidance.** Each recognition model shows meaning retention (the share of recognized lines whose meaning is intact) for English, European languages and Japanese · Korean · Chinese with a verdict (recommended / usable / marginal / not advised), plus a "choose by language" note above the list. The figures are measured: 30-minute excerpts of *Spotlight* (English), *Ballon* (German) and NHK's *The 13 Lords of the Shogun* (Japanese) through the product pipeline, 50 sentences each judged blind. Tiny gets the meaning wrong in over a third of sentences in all three; Small is enough only for English; Japanese, Korean and Chinese want Large v3 Turbo.
- **Check for updates.** A new row under Settings › About checks once, five seconds after launch, and on demand; when a newer version exists it offers "Download the new version", "View release notes" and "Skip this version", and the Settings entry in the sidebar shows a dot. The Help menu has "Check for updates…" as well. There is no server: the app reads a static `latest.json` attached to the GitHub Release (produced by the release chain, see RELEASE.md). Copies installed with Homebrew or Scoop get their own upgrade command instead of a download button; the App Store build does not check. The check can be turned off in Settings; GitHub sees only an IP address and the operating system type.
- **Steadier automatic language detection:** instead of only the first 30 seconds (where an opening theme could be read as English and turn a whole episode into English gibberish), 20-second windows are sampled where speech is densest and vote. A few seconds slower; a language set by hand is unaffected.
- Consistent subtitle styling: on-screen text was bold while dialogue was regular, which read as two typefaces on the same frame; they now match.
- **On-screen text translation now works on Windows too**, using the text recognition built into Windows (Windows.Media.Ocr, present since Windows 10). The package only gains a PowerShell script, no model; the recognized boxes go through exactly the same pipeline as on macOS (grouping, tracking, judging, layout). The Windows language pack for the spoken language must be installed with "Optical character recognition" ticked; with no OCR language installed the feature is hidden, and with only other languages installed it falls back to the system language and says so in the log. Windows OCR gives no confidence values, so 0.6 is assumed and blocks that flash for a single frame are dropped by the existing rule. Quality is below macOS Vision: vertical Japanese is mostly missed and decorative typefaces are read poorly.
- **Windows: speech recognition no longer ships with OpenBLAS.** Since 1.0.0 the package used the official `whisper-blas-bin` build, whose OpenBLAS crashed on some machines the moment the model loaded ("whisper-cli failed (exit code 3221225477)"); upstream whisper.cpp#3654 reports the same and is unfixed. Switched to the official build without BLAS: ggml has its own AVX2 / AVX-512 kernels and the common Base / Small models are just as fast, with 51 MB less on disk (about 10 MB smaller download). The bundling script now refuses any whisper directory that contains BLAS.
- **The Windows Models page no longer treats the machine as a Mac.** The hardware line used to say "This Mac: Intel" (AMD machines too), every model was labelled "runs but slow" (the rule for Intel Macs without Metal), the advice said "Apple Silicon" throughout and the button read "Reveal in Finder". The CPU model is now read as-is, and fitness verdicts and requirement lines have separate Mac and Windows rules.
- A failed task can copy its complete log with one click, so reporting a problem no longer needs screenshots.
- **Dropdown menus are readable in dark mode on Windows.** The pop-up list of a native select is drawn by Chromium from the select's background colour and the option's text colour: the select background was a translucent white that became beige over the pop-up, while the text kept the light colour of dark mode — the language and model lists were unreadable except for the selected row. Options now have an opaque background with matching text, the select's colour scheme follows the theme, and the dropdowns on the Convert, Batch, Cloud and Settings pages are all fixed.
- **Fresh install, no model yet: download in place.** Previously you found out a model was needed only after dropping a file, a "Go to downloads" link took you to the Models page, the dropped file was gone when you came back, and the page showed five or six models with no hint which to pick. The Convert page's empty state now recommends a model for this machine (by memory and chip: Large v3 on Apple Silicon, Large v3 Turbo on a 16 GB Windows PC) and offers "Download and continue"; progress runs in place and you can start as soon as it finishes. Dropping a file first leads to the same prompt with the file kept. Local translation with no model is handled the same way. The Batch page now also refuses to start without a recognition model, instead of failing every file one by one.
- **Conversion settings are split into a Recognition box and a Translation box.** Eight or nine rows used to share one card, mixing recognition, translation and output. Now: Recognition = subtitle source → recognition model → language (the language spoken); Translation = translation service (none / local model / cloud, chosen first) → translation model (downloadable right there when missing) → translate into → on-screen text → subtitle content, the later rows appearing only once the service is ready. The subtitle format sits next to Start in the action bar, because it is an output setting that belongs to neither box. The Batch page has the same two boxes, with a recognition model selector in the first. For a subtitle file, the language row describes only the language of the original subtitles.
- While a file is dragged over the drop zone, the highlighted background's corners no longer misalign with the frame: the zone used to scale up by 0.6 %, four or five pixels at this width. It no longer scales; the dashed border becomes solid and the background fills the zone.
- The stray horizontal line above the action bar is gone (it was the card's internal divider, left behind when the action bar moved outside the card).
- **No row of meaningless options when there is no model.** Without a recognition model the language, translation and format rows have nothing to act on: the card shows only the subtitle source and the download prompt, and the options appear once the model is there. Without a local translation model, the on-screen text and subtitle content rows stay hidden and the prompt sits under the translation service row, so switching to cloud translation is right there. The Batch page follows the same logic.
- **A dropped file survives switching tabs.** The Convert page used to unmount when you switched away, so after downloading a model on the Models page the file was gone and had to be dropped again. It is now only hidden, with all changed options kept; only Cancel returns to the empty state.
- **Button states redrawn.** The primary button and selected segments took their background straight from two stops of the wallpaper gradient — pastel colours in light mode where white text was already marginal, and brightening by 8 % on hover turned them into an unreadable pale block. Solid controls now derive a fixed lightness from the theme hue (46 % light / 58 % dark) with their own hover and pressed steps, so white text stays legible in all ten palettes and both modes; plain buttons give feedback when pressed; switches gained hover and disabled states; buttons, segments, switches and dropdowns share a keyboard focus ring (shown only when reached with Tab, which matters on Windows).

## 1.0.6 — 2026-09-12

- **Model downloads fixed for mainland China.** hf-mirror.com no longer proxies files (it just redirects back to huggingface.co), so the mirror added in 1.0.3 was useless there. Every model can now be downloaded from ModelScope (Alibaba Cloud CDN): the six Whisper models from two mirror repositories verified byte-for-byte against the official files, Qwen from its official repository. ModelScope is tried first when the system language is Simplified Chinese or the time zone is in China; elsewhere huggingface.co stays first.
- Downloads are verified against their SHA-256 after completion (the official checksums are stored in the catalog); a mismatch is deleted and retried, so a file of unknown origin is never used as a model.
- The Silero VAD model ships inside the installer, so timing refinement no longer depends on a download.
- A failed download now says "none of the download sources could be reached" and lists every source URL with copy buttons.

## 1.0.5 — 2026-09-12

- **Conversions can be cancelled.** The progress card of a single file and the running file in the batch queue both have a Cancel button that immediately stops the running ffmpeg / whisper / translation request (previously you could only wait or force-quit); a cancelled batch file returns to "waiting" and the queue continues with the next one.
- **Estimated time remaining**, derived from the pace of the current stage (recognition, translation), shown next to the stage name.
- **The finished card shows the device used for recognition**, such as "Apple M1", "NVIDIA GeForce RTX 3060 (Vulkan)" or "CPU", so you can see at a glance whether the GPU was used.
- **Translation on Windows uses the GPU:** the bundled llama-server is now a Vulkan build, so translation runs on any GPU with a Vulkan driver (NVIDIA / AMD / Intel) and falls back to the CPU otherwise; speech recognition on Windows stays on the CPU for now (whisper.cpp only offers a very large CUDA build).
- **A failed model download states the actual cause** (such as `getaddrinfo ENOTFOUND` or a certificate error) and lists every download URL for that model so you can fetch it with a browser or download manager and drop it into the model folder; the Qwen translation models gained a ModelScope source, tried automatically when the official source and the mirror are both unreachable.

## 1.0.4 — 2026-09-09

- Model downloads no longer sit at 0 % at the start: the app shows "Connecting to server…" first, and if the official source does not answer within 3 seconds it connects to the mirror in parallel and takes whichever answers first; the winning source is remembered on disk and used directly for later downloads and after restarts.
- Windows interface language: the system display language setting (registry PreferredUILanguages) is now read first, then the preferred languages reported by Electron; Settings › Language lists the raw language tags the system reports, for comparison.
- Unified window structure on both platforms: a 38 px window bar at the top holds the macOS traffic lights and the Windows minimize / maximize / close buttons, and the content card starts below it, so on Windows the window buttons no longer overlap the card border.

## 1.0.3 — 2026-09-08

- **Model downloads work in mainland China:** when huggingface.co is unreachable the download switches to the hf-mirror.com mirror, and once it has succeeded later files go straight to the mirror; downloads now use the system network stack and honour the system proxy settings. When both fail, a clear message replaces "TypeError: fetch failed".
- Steadier interface language detection: in addition to the system's preferred-language list, the system region and runtime locale are consulted, fixing Chinese Windows systems that showed English; the startup log prints the detected system languages.
- Website: Windows visitors are now highlighted and offered the Windows download first (the highlight and the link were swapped); the download section explains the SmartScreen prompt.

## 1.0.2 — 2026-09-07

- New feedback entry points: the Help menu and Settings › About open the website feedback form (no account needed) and GitHub Discussions; the App Store build also offers "Rate on the App Store".
- The app builds its own menu instead of Electron's default Help menu, which pointed at Electron's documentation; menu labels follow the interface language (32 languages).
- About shows the real version number (it was hard-coded to 0.1.0).
- The app only opens its own website, repository and App Store review links; any other external URL is refused.

## 1.0.1 — 2026-09-06

- Translation targets extended from 5 to 29 languages (French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian, Malay and more), with language names shown in the interface language; on first launch the target defaults to the system language instead of always Chinese.
- The default strength of the interface grain texture drops from 0.5 to 0.1: large gradients still show no banding, but the frosted look is gone. Existing users who never changed the setting get the new default; a manual setting is kept.
- Fixed the grain texture being blocked by the content security policy in release builds, so it never actually rendered (included in 1.0.0).
- In a sandboxed environment where the source directory is not writable, subtitles are written to "Movies/Wave Subs" and the interface says so (App Store build).

## 1.0.0 — 2026-09-06

First public release. Previously used internally under the working name SubFlow.

### Features

- **Job cache and stage reuse:** recognition / extraction results are cached by file identity plus every parameter that affects them; a failed translation or a change of export format reruns in seconds. Translation reuse is decided by a strict four-tuple (engine including the exact model, target language, prompt version, glossary hash), so **changing the model or the glossary always retranslates and old output is never mixed in**; cache use is always shown in the interface and the CLI.
- **Subtitle editor:** edit text and timing in a table, insert, delete, smart merge (no space inserted at CJK boundaries), undo, autosave; lines whose source was edited are marked "translation may be stale" and only those are retranslated. **With video preview:** what Chromium can play is played directly; what it cannot (HEVC / DTS in MKV) is turned into a frame sequence plus audio by the bundled ffmpeg for per-line preview, with the subtitle overlay reflecting edits live.
- **Quality report:** every finished job is checked — speech coverage, gaps, over-long cues, reading speed too fast, missing translations, source text left in the translation, reversed timing; thresholds from measurements on six full films. Shown for single files and batches, with click-to-jump.
- **Glossary:** fixed translations for names and places, shared by single-file and batch runs; only the entries hit by the current batch are injected.
- **Three subtitle sources:** local speech recognition (whisper.cpp, Metal-accelerated), embedded subtitle tracks, external subtitle files.
- **18 external subtitle formats:** SRT / ASS / SSA / WebVTT / SAMI / MicroDVD / SubViewer / MPL2 / VPlayer / JACOsub / RealText / STL / PJS / LRC and more, with automatic encoding detection (UTF-8 / GBK / Big5 / Shift-JIS / EUC-KR).
- **Translation:** local Qwen3 (free, offline) or any OpenAI-compatible cloud API, with the Anthropic and Azure protocols supported.
- **Batch conversion:** a sequential queue in which one failed file does not stop the batch; every file can **override** the source, audio track, language, service and format set globally.
- **Export** SRT / ASS, translation only or bilingual.

### Timing quality

Tuned repeatedly against the official embedded subtitles of six films (Japanese and Italian, same-language and cross-language):

- Frame-level mask F1 **82.1 % → 83.8 %**
- Cue-start F1 **57.7 % → 59.4 %**, mean start error 348 ms → **328 ms**
- Share of starts within ±250 ms: 59.4 % → **62.5 %**

Key changes: a robust per-genre lead time measured on real films, extra split points at kana / kanji boundaries for Japanese, the start-shift limit raised from 10 to 40 seconds (some subtitles used to hang 25 seconds before anyone spoke), and split guards that avoid unreadable fragments.

### Platforms

macOS (Apple Silicon) and Windows (x64) with matching features. The Windows build comes as an NSIS installer and a portable ZIP.

### Distribution

- **ffmpeg, whisper.cpp and llama.cpp ship inside the app**; no Homebrew or other dependencies to install.
- The bundled ffmpeg is a self-built **minimal LGPL build** (all GPL encoders removed); see [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
- Signed with a Developer ID and notarized by Apple: download, double-click, open.
- Interface in 32 languages.

### Upgrading from SubFlow

The first launch migrates old settings and downloaded models automatically. **The cloud API key has to be entered again**: the keychain item is named after the app, and the old ciphertext cannot be decrypted under the new name. Details in DEVELOPMENT.md.
