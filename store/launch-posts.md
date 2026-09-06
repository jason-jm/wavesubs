# 推广稿（新定位版）

定位一句话：**看片找不到字幕？Wave Subs 用本地 AI 从影片生成 SRT/ASS 字幕，自动翻译到你的语言。无需联网，全免费。**
所有稿子都围绕这一句展开：先说痛点（找不到字幕），再说结果（生成 + 翻译），最后说方式（本地、离线、免费）。
链接统一用官网：https://jason-jm.github.io/wavesubs/ （英文稿用 https://jason-jm.github.io/wavesubs/en/ ）

## Show HN（Hacker News）

**标题：** Show HN: Wave Subs – Generate and translate subtitles from any video with local AI, offline and free

**正文：**
Every time I couldn't find subtitles for a film, I ended up uploading it to some website, paying per minute, and waiting. So I built the local version.

Wave Subs takes a video, runs whisper.cpp on your own machine to recognize the dialogue, refines the timing against the actual speech (VAD + loudness, tuned on six full films with official subtitles), translates with a local Qwen3 model into any of 29 languages, and writes SRT/ASS next to the file. Nothing is uploaded; once models are downloaded it works offline. Free, MIT.

Things I spent the most time on:
- Timing. Whisper's raw timestamps drift and merge; snapping lines back to speech regions made the biggest difference in watchability.
- Caching that can't lie. Recognition and translation are cached separately, and translations are only reused when engine + model + target language + prompt version + glossary all match — switching models always retranslates.
- Formats browsers can't play. HEVC/DTS MKVs preview fine in the editor because the bundled ffmpeg does the decoding.
- A quality report per file (coverage vs. detected speech, gaps, reading speed, untranslated lines) so batch runs don't silently produce garbage.

macOS (Apple Silicon, notarized) and Windows x64. Electron + TypeScript, whisper.cpp + llama.cpp bundled, ffmpeg self-built LGPL.

https://jason-jm.github.io/wavesubs/en/ · source: https://github.com/jason-jm/wavesubs

## V2EX（分享创造）

**标题：** 看片找不到字幕？做了个本地 AI 字幕工具：从影片直接生成 SRT/ASS 并翻译，离线免费，Mac/Win

**正文：**
起因很简单：NAS 里一堆没字幕的片，在线字幕生成要上传整部影片、按分钟收费，字幕站又经常对不上版本。于是做了 Wave Subs：

- 把影片拖进去，本地 whisper.cpp 识别对白，时间轴按真实说话时刻精修（参数用六部整片对照官方字幕调的）
- 本地 Qwen3 翻译成你的语言（29 种可选），术语表保证整季人名一致；也可以接任何 OpenAI 兼容接口
- 导出 SRT / ASS 放到影片旁边；跑完带质检报告，告诉你哪里可能漏了
- 编辑器自带视频预览，HEVC/DTS 的 MKV 也能点一行听一句
- 整季批量，逐文件可单独设置

全部本地完成，不上传、不联网（模型下一次就行）、不收费、MIT 开源。macOS（Apple Silicon，已公证）和 Windows。

官网：https://jason-jm.github.io/wavesubs/
GitHub：https://github.com/jason-jm/wavesubs

欢迎拿手头最难搞的片试试，识别/翻译不准的例子发 issue 我来看。

## 少数派 / 什么值得买 风格短文（可投稿或自己发）

**标题：** 看片找不到字幕？让本地 AI 直接从影片生成并翻译——Wave Subs 上手

**导语：** 不上传、不联网、不花钱：一个把「找字幕」变成「生成字幕」的 Mac/Windows 应用。

**要点：**
1. 痛点：字幕站对不上版本、在线工具要传片要付费
2. 三步：拖进影片 → 本地识别对齐 → 翻译导出 SRT/ASS
3. 亮点：29 种目标语言、术语表、编辑器带预览、质检报告、整季批量
4. 隐私与费用：全部本地、永久免费、MIT
5. 系统要求：macOS 12+ Apple Silicon / Windows 10+ x64，首次下载模型 1.6～3 GB

## Product Hunt

**Tagline（60 字符）：** Generate & translate subtitles from any video, locally & free
**描述：** Can't find subtitles? Wave Subs recognizes dialogue with local AI, refines timing, translates into 29 languages and exports SRT/ASS — all on your own Mac or PC. No uploads, no internet needed, free forever.
**首评（Maker comment）：** 见 Show HN 正文，删掉技术细节，保留痛点 + 三步 + 隐私。
**Topics：** Productivity, Video, Artificial Intelligence, Open Source, Mac

## Reddit r/macapps · r/DataHoarder · r/anime（各发一次，别交叉发）

**r/macapps 标题：** Wave Subs – generate SRT/ASS subtitles from any video with local AI and translate them, free & notarized
**r/DataHoarder 标题：** Batch-generate subtitles for a whole library locally (whisper.cpp + local LLM translation), nothing uploaded
**r/anime 标题：** Made a free local tool that generates and translates subtitles from raw episodes (29 languages, glossary keeps names consistent)

正文用 Show HN 的前两段 + 对应板块关心的一点（macapps：公证与沙盒；DataHoarder：批量与缓存；anime：术语表与日语识别）。

## X / Twitter 线程

1/ 看片找不到字幕？我做了 Wave Subs：把影片拖进去，本地 AI 生成 SRT/ASS 字幕并翻译成你的语言。无需联网，全免费。Mac + Windows。[官网链接]
2/ 三步：拖进影片 → 本地识别 + 时间轴精修 → 翻译导出。带质检报告，哪里漏了直接告诉你。[home-done 截图]
3/ 29 种翻译目标语言，本地 Qwen3 免费；术语表让整季人名一致。[translate-models 截图]
4/ 编辑器带视频预览，HEVC/DTS 也能点一行听一句。[editor 截图]
5/ 不上传、不联网、不收费，MIT 开源。[GitHub 链接]

## 常见追问的回答

- **为什么不支持 Intel Mac？** 本地识别靠 Metal，Intel 上慢到没法用；Windows 版走 CPU（BLAS），建议 16 GB 内存。
- **识别准吗？** whisper large 系列 + 时间轴精修；每个文件带质检结论。日语动漫实测覆盖率 75～85% 属正常范围，配乐段会有假阳性。
- **和 Whisper 的 Mac 客户端们有什么区别？** 端到端：识别、对齐、翻译、编辑、批量、质检一条线，且内嵌字幕轨能直接抽出翻译，不用识别。
- **云端翻译收费吗？** 由你选的服务商收，Wave Subs 不经手；本地 Qwen3 免费。
- **Windows 未签名警告？** 还没买 Authenticode 证书，点"更多信息 → 仍要运行"；校验值在 Releases 页。
