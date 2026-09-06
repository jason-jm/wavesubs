# 发布与推广文案

> 全部是草稿，发布前请过一遍。链接统一用官网 https://jason-jm.github.io/wavesubs/ ，
> 下载走 GitHub Releases。建议节奏：第 1 天 Show HN + r/macapps + V2EX；第 2 天 Product Hunt（周二到周四早上 PT 00:01 上线最好）；
> 之后按社区反馈更新 FAQ。

---

## Product Hunt

**Name:** Wave Subs
**Tagline (60):** Local-first subtitles: transcribe, translate, edit — on your Mac
**Description:**
Wave Subs turns any video into usable subtitles without uploading a single byte. Whisper runs locally with Metal acceleration; timing is refined against real speech (tuned on six full-length films vs. official subs); translation uses a local Qwen3 model or any OpenAI-compatible API you bring; a glossary keeps names consistent across a season. Batch a whole folder, get a quality verdict per file, then fix lines in an editor that plays the exact moment back — even HEVC/DTS MKVs. Free, MIT-licensed, macOS (Apple Silicon) and Windows.

**First comment (maker):**
Hi PH! I built Wave Subs because every "AI subtitle" tool I tried either uploaded my files to someone's server or produced timing that drifted half a second off by the second act. So: everything runs on-device (whisper.cpp + llama.cpp + a self-built LGPL ffmpeg are bundled — zero setup), and the timing pass was tuned by comparing against official subtitles of six full films. Happy to answer anything about the timing work, the caching (change models → it strictly retranslates, never mixes), or why the Mac App Store version is coming a bit later (sandboxing).

---

## Hacker News — Show HN

**Title:** Show HN: Wave Subs – local-first video subtitles (Whisper + LLM translation, MIT)
**URL:** https://jason-jm.github.io/wavesubs/
**Text (first comment):**
Wave Subs is an Electron app for macOS (Apple Silicon) and Windows that takes a video → transcribes with whisper.cpp locally → refines timing with VAD + loudness analysis → translates with a local Qwen3 model (or your own OpenAI-compatible endpoint) → exports SRT/ASS. It also extracts embedded MKV/MP4 subtitle tracks (picking by language) and reads 18 subtitle formats.

Things I think are worth a look:
- Timing: Whisper's segment boundaries are loose. The refinement pass snaps cues to actual speech regions and was tuned against official subtitles for six full-length films (metrics and the bench harness are in the repo).
- Caching with strict invalidation: recognition and translation are cached separately; translation reuse requires an exact match on (engine incl. model, target language, prompt revision, glossary hash) — so switching models can never leave you looking at the old model's output.
- Preview for formats Chromium can't play: the editor asks the bundled ffmpeg for a few seconds of frames + AAC for the line you clicked.
- Quality report per file: coverage vs. detected speech, gaps > 8 s, reading speed, untranslated/residual lines, with thresholds from the film baselines.

Privacy: no account, no analytics, nothing uploaded unless you configure a cloud translation provider yourself. MIT licensed; ffmpeg is a self-built LGPL binary.

---

## Reddit — r/macapps

**Title:** [Free, open source] Wave Subs — local Whisper subtitles with translation, batch, and an editor with video preview (Apple Silicon)
**Body:**
Made a Mac app for generating and translating subtitles entirely on-device. Drop a video (or a whole season folder) → Whisper transcription with Metal → timing cleanup → translation via a local model or your own API → SRT/ASS. If the MKV already has a text subtitle track it uses that instead (picked by language). There's an editor where you click a line and hear that exact moment, plus a quality report telling you which files to double-check.
Free, MIT, no account, nothing uploaded. Notarized DMG. Windows build too.
Site: https://jason-jm.github.io/wavesubs/ · Source: https://github.com/jason-jm/wavesubs

**Also consider:** r/software, r/DataHoarder（强调 NAS 整季批量与内嵌轨抽取）, r/LanguageLearning（强调双语字幕）, r/anime（谨慎，先看版规）

---

## X / Twitter（thread）

1/ Wave Subs is out: video → subtitles → translation, all on your own Mac. Whisper + local LLM, nothing uploaded. Free & open source. https://jason-jm.github.io/wavesubs/
2/ The part I spent the most time on: timing. Whisper's boundaries drift; the refinement pass snaps them to real speech, tuned against official subs of six full films. [附 editor 截图]
3/ Batch a whole season. Each file gets a quality verdict — coverage, gaps, reading speed, missing translations — so you know which ones to check. [附 batch 截图]
4/ Editor with preview: click a line, hear that exact second, even for HEVC/DTS MKVs a browser can't play. The overlay reflects your edits live.
5/ Change translation model? It retranslates strictly — never mixes old output. Glossary keeps names consistent across a season. MIT, macOS (Apple Silicon) + Windows. Mac App Store version in review soon.

---

## V2EX（分享创造）

**标题：** Wave Subs：本地跑的视频字幕工具，识别 + 对齐 + 翻译 + 编辑，开源免费
**正文：**
自己做的一个 Mac/Windows 应用，解决的是「NAS 上一堆没中字的片子」这件事：拖进视频 → whisper.cpp 本地识别（Metal 加速）→ 时间轴精修 → 本地 Qwen3 或自己的 API 翻译 → 导出 SRT/ASS。MKV 里已经有字幕轨的话直接抽（按语言选轨），不用识别。

几个花了功夫的地方：
- 时间轴：用六部整片对照官方字幕反复调参，不是拿 Whisper 原始时间戳直接用
- 缓存：识别结果和译文分开缓存，换导出格式秒出；换模型或术语表严格重翻，不会混用旧译文
- 编辑器带预览：点一行直接听那一秒，HEVC/DTS 的 MKV 也行（随包 ffmpeg 解）
- 每个文件跑完给质检结论：覆盖率、漏段、语速、缺译

没有账号没有统计，视频不上传。MIT 开源，ffmpeg 是自己编的 LGPL 版。
官网：https://jason-jm.github.io/wavesubs/ 源码：https://github.com/jason-jm/wavesubs
欢迎拍砖，特别是时间轴和翻译质量方面。

---

## 少数派 / 微博 / 即刻 / 小红书（短文案）

Wave Subs 上线了：在你自己的电脑上把视频变成字幕——识别、对齐、翻译、编辑一条龙，整季批量，不上传任何文件。免费开源，macOS（Apple Silicon）和 Windows。
👉 https://jason-jm.github.io/wavesubs/
（配图：编辑器 + 批量两张截图）

---

## 常见追问的预备回答

- **为什么不支持 Intel Mac？** 本地识别靠 Metal，Intel 上慢到不实用。
- **Windows 为什么提示未知发布者？** 还没买代码签名证书，SmartScreen 对新程序都会提示；Releases 页有校验值。
- **准确率如何？** 取决于模型与音频质量；Large v3 Turbo 对日/英清晰对白很好，嘈杂/多人重叠会差。质检报告会标出可疑段落。
- **和 Whisper 网页服务/剪映比？** 本地、离线、不限时长不收费；内嵌轨抽取和整季批量是它们没有的。
- **App Store 版什么时候？** 正在准备（沙盒改造已完成），审核通过即上架。
