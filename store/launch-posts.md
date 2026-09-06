# 推广文案（全部可直接复制）

> 配套：分工与时间表见 [promotion-plan.md](./promotion-plan.md)。图片都在 `store/social/`：横版高清 `<语言>@2x.jpg`（2560×1280，X / 微博 / 知乎），竖版 `<语言>-9x16.jpg`（1080×1920，小红书 / 抖音 / Stories）和 `<语言>-3x4.jpg`（1080×1440，小红书信息流）；界面截图 `docs/assets/shots/<语言>-dark-*.jpg`；Product Hunt 专用 `store/producthunt/`。语言代码：zh en ja ko fr de ru id ms vi th。
> 所有链接统一用 **https://wavesubs.com**（会按浏览器语言自动跳转）；仓库 https://github.com/jason-jm/wavesubs。

---

## Show HN（Hacker News）

**标题（77 字符）：**
```
Show HN: Wave Subs – Offline subtitle generation and translation for any video
```
**URL：** `https://wavesubs.com/en/`

**正文（发在第一条评论里，HN 的 Show HN 带 URL 时正文留空）：**
```
Hi HN, I built Wave Subs because half the films and shows in my library had no subtitles in my language, and every "AI subtitle" site wanted me to upload a 20 GB MKV and pay per minute.

What it does: drop in a video → whisper.cpp recognizes the dialogue (auto language detection) → the timing is snapped to when lines are actually spoken → a local Qwen3 model (llama.cpp) translates into your language → SRT/ASS lands next to the video with a quality verdict. There's an editor with video preview (click a line to hear it, HEVC/DTS included via a bundled LGPL ffmpeg build), batch runs for a whole season, and a glossary so character names stay consistent across episodes.

Some details that took the most work:
- Timing: whisper's segment boundaries are loose. I refine them with VAD + loudness analysis and tuned the parameters against the official subtitles of six full-length films.
- Caching: recognition and translation are cached separately, keyed by (model, glossary, prompt, source). Changing the glossary retranslates strictly instead of mixing old lines in.
- Everything is local. No account, no analytics, no server. The only network calls are the one-time model download and, if you choose to, an OpenAI-compatible API for translation.

Limitations: macOS build is Apple Silicon only (Metal). The Windows build is CPU-only and noticeably slower, and it isn't code-signed yet, so SmartScreen will warn. Intel Macs aren't supported.

Electron + TypeScript, MIT licensed: https://github.com/jason-jm/wavesubs
Happy to answer questions about the timing refinement or the local-LLM translation pipeline.
```

**常见追问的回答（提前想好）：**
- *Why Electron?* — 视频预览、拖放、多语言 UI 和跨平台一次到位；识别与翻译在子进程里跑，Electron 只是壳。
- *Why not WhisperX / faster-whisper?* — 目标是免安装的桌面软件，whisper.cpp 单二进制 + Metal，用户不需要 Python 环境。
- *Accuracy vs. cloud?* — large-v3 的识别质量与云端相当；翻译取决于模型大小，8B 够看剧，32B 更好，也可以接 GPT/DeepSeek 等接口。
- *Intel Mac?* — 没有 Metal 慢到不实用，所以没出。
- *Linux?* — 代码没有平台限制，需要有人帮忙测试打包。

---

## Product Hunt

- **Name：** Wave Subs
- **Tagline（58/60）：** `Generate & translate subtitles for any video, fully offline`
- **Description（≤260）：**
  ```
  Can't find subtitles? Drop in a video: local AI recognizes the dialogue, fixes the timing, and translates it into your language (29 languages). SRT/ASS export, batch a whole season, editor with video preview. No upload, no account, free & open source.
  ```
- **Topics：** Video, Artificial Intelligence, Open Source, Mac, Productivity
- **Links：** Website https://wavesubs.com/en/ · GitHub https://github.com/jason-jm/wavesubs · App Store（审核通过后补）
- **Pricing：** Free
- **缩略图：** `store/producthunt/thumbnail-240.png`；**画廊：** `store/producthunt/gallery-0-card.png` → `gallery-1-editor.png` → `gallery-2-translate-models.png` → `gallery-3-batch.png` → `gallery-4-home-done.png`
- **发布时间：** 太平洋时间 00:01（北京 15:01），周二–周四

**Maker 首评：**
```
Hey Product Hunt! 👋

I made Wave Subs after one too many nights searching subtitle sites for a show that simply had none in my language.

It runs entirely on your computer: whisper.cpp for recognition, a local Qwen3 model for translation, a bundled ffmpeg so even HEVC/DTS files preview fine. Drop in a whole season, get SRT/ASS files next to each episode, and fix anything in the built-in editor — click a line to hear exactly how it was said.

No upload, no account, no subscription. MIT licensed.

I'd love to hear which languages and video types you throw at it — the timing refinement was tuned on films, so anime and talk-heavy shows are where I most want feedback. Thanks for checking it out!
```

---

## Reddit（每个板块单独发，隔天一个，回评论）

### r/macapps（周内白天，美区时间）
**标题：** `Wave Subs – free, open-source app that generates and translates subtitles for any video, fully offline (Apple Silicon)`
```
Made this because my media library was full of films without subtitles in my language.

Drop in a video → whisper.cpp recognizes the dialogue → timing gets snapped to actual speech → a local Qwen3 model translates → SRT/ASS lands next to the file. Editor with video preview (HEVC/DTS included), batch a whole season, glossary for names.

Nothing is uploaded, no account, no subscription. Notarized DMG, also `brew install --cask jason-jm/wavesubs/wavesubs`.

macOS 12+, Apple Silicon only (Metal). Site: https://wavesubs.com/en/ · Source: https://github.com/jason-jm/wavesubs
```

### r/LocalLLaMA（讲技术）
**标题：** `Local subtitle pipeline: whisper.cpp + Qwen3 (llama.cpp) with strict glossary-aware retranslation — open source desktop app`
```
Sharing a desktop app I built around local models, in case the pipeline details are useful to others:

- ASR: whisper.cpp (large-v3 / large-v3-turbo), Metal on Apple Silicon. Segment timing is loose, so I refine boundaries with VAD + loudness and tuned the thresholds against official subtitles of six full films.
- Translation: Qwen3 1.7B–32B GGUF via llama-server, batched by scene with a glossary injected into the prompt (names/terms stay consistent across a season). Any OpenAI-compatible endpoint works too.
- Caching: recognition and translation are cached separately, keyed by (model, glossary, prompt, source identity). Changing any of them forces a strict retranslation instead of mixing old lines in.
- The app labels each model fit/usable/too heavy for your RAM (rule: RAM ≥ model + 6 GB = fit).

Everything offline; MIT. Windows build is CPU-only (BLAS) so 4B–8B is the sweet spot there.

https://github.com/jason-jm/wavesubs · https://wavesubs.com/en/#requirements has the model/RAM table.
```

### r/opensource
**标题：** `Wave Subs (MIT): generate and translate subtitles from any video with local AI — macOS & Windows`
```
Open-source alternative to the upload-and-pay subtitle sites. whisper.cpp for recognition, llama.cpp/Qwen3 for translation, bundled LGPL ffmpeg. No telemetry, no account.

Electron + TypeScript; contributions welcome, especially Linux packaging and testing on Windows.

https://github.com/jason-jm/wavesubs
```

### r/DataHoarder
**标题：** `Generating subtitles for a whole NAS library offline — open-source tool, batch mode, keeps names consistent across a season`
```
For the "I have 4 TB of shows and half have no subs" problem: drop a folder in, every file follows shared settings, override the audio/subtitle track per file where needed, and you get SRT/ASS next to each episode with a QC verdict (coverage gaps, reading speed, missing translations).

Embedded text subtitle tracks are detected and reused instead of re-recognizing. Runs offline on your machine — nothing leaves the NAS.

macOS (Apple Silicon) + Windows, MIT: https://github.com/jason-jm/wavesubs
```

---

## X / Twitter 线程（英文）

```
1/ Can't find subtitles for a video? I built Wave Subs: drop in the file, local AI generates SRT/ASS subtitles and translates them into your language. No upload, no account, free & open source. 🧵
```
```
2/ Under the hood: whisper.cpp recognizes the dialogue, timing is snapped to when lines are actually spoken (tuned on 6 full films), then a local Qwen3 model translates. 29 target languages.
```
```
3/ The editor shows the video: click any line to hear exactly how it was said — even HEVC/DTS files a browser can't play, thanks to a bundled ffmpeg. Fix text, adjust timing, export again.
```
```
4/ Drop in a whole season. Shared settings, per-episode overrides, a glossary so character names stay consistent. Every file gets a quality verdict.
```
```
5/ macOS (Apple Silicon) + Windows. MIT licensed.
Site: https://wavesubs.com
Source: https://github.com/jason-jm/wavesubs
```
配图：第 1 条用 `store/social/en@2x.jpg`，第 3 条用 `docs/assets/shots/en-dark-editor.jpg`。

## X / 微博 / 即刻（中文）

```
看片找不到字幕？我做了一个免费开源的桌面软件 Wave Subs：把影片拖进去，本地 AI 识别对白、生成 SRT/ASS 字幕，再自动翻译成中文。全程不联网、不上传、没有账号、没有内购。

支持整季批量、术语表（人名整季一致）、带视频预览的编辑器（点任意一行直接听这句）。

macOS（Apple Silicon）+ Windows
官网 https://wavesubs.com
源码 https://github.com/jason-jm/wavesubs
```

---

## V2EX（分享创造）

**标题：** `做了个免费开源的本地 AI 字幕工具：拖入影片生成 SRT/ASS 并自动翻译，不联网`
```
起因很简单：片库里一半的片子没有中文字幕，网上的「AI 字幕」站点又要上传整部影片、按分钟收费。

Wave Subs 全部在本地跑：
- 识别：whisper.cpp（Apple Silicon 走 Metal），自动检测语种
- 时间轴：whisper 的分段边界很松，用 VAD + 响度把边界贴回真实说话时刻，参数对照六部整片的官方字幕调过
- 翻译：本地 Qwen3（llama.cpp），支持术语表，换模型/改术语表会严格重翻不混旧译文；也能接任何 OpenAI 兼容接口
- 编辑器带视频预览，HEVC/DTS 也能点一行听一句（随包 LGPL ffmpeg 解出片段）
- 整季批量，每集可单独指定字幕轨/音轨/引擎，跑完附质检结论

macOS 12+（仅 Apple Silicon）和 Windows 10+（纯 CPU，慢一些，暂无签名会有 SmartScreen 提示）。
MIT 开源，Electron + TypeScript。

官网：https://wavesubs.com
源码：https://github.com/jason-jm/wavesubs
brew install --cask jason-jm/wavesubs/wavesubs

欢迎拍砖，尤其想知道动画和对白密集的剧集上时间轴表现如何。
```

---

## 少数派（长文，可直接投稿）

**标题：** `看片找不到字幕？让本地 AI 从影片直接生成——Wave Subs 使用手记`

**导语：** 一个免费开源的 Mac/Windows 桌面软件，把影片拖进去，本地识别对白、生成 SRT/ASS 字幕并自动翻译成中文。不联网、不上传、没有账号。

**正文提纲（每节 150–250 字，配图已标）：**
1. **为什么又做一个字幕工具**：在线字幕站要上传整部影片、按分钟收费、有时长上限；本地方案（WhisperX 等）要配 Python 环境。想要一个「装完就能用」的桌面软件。
2. **三步流程**（配图 `zh-Hans-dark-home-done.jpg`）：拖入影片 → 本地识别与对齐 → 翻译导出。影片自带字幕轨会自动识别并优先使用。
3. **时间轴为什么准**：whisper 分段边界松，用 VAD 和响度分析贴回真实说话时刻；参数用六部整片对照官方字幕校准。跑完附质检结论（漏段、语速、缺译）。
4. **翻译**（配图 `zh-Hans-dark-translate-models.jpg`）：默认本地 Qwen3，29 种目标语言；术语表让人名整季一致；也可接 OpenAI 兼容接口。App 会按内存标注每个模型「合适/可用/跑不动」。
5. **编辑器**（配图 `zh-Hans-dark-editor.jpg`）：点任意一行直接听这句，HEVC/DTS 也能预览；改字调时间，质检发现可点击跳转。
6. **整季批量**（配图 `zh-Hans-dark-batch.jpg`）：一个文件夹拖进来，需要的几集再单独设置。
7. **配置建议**：Mac 16 GB 用 Large v3 Turbo + Qwen3 8B；8 GB 用 Small + Qwen3 1.7B；Windows 纯 CPU 建议 16 GB 以上（详表见官网「配置要求」）。
8. **隐私与费用**：没有账号、统计、服务器；完全免费、没有内购；MIT 开源。
9. **下载**：https://wavesubs.com ；`brew install --cask jason-jm/wavesubs/wavesubs`

---

## 知乎（回答已有问题比发文章有效）

先搜这些问题，各回答一次（回答里放官网链接和一张编辑器截图）：
- 「有什么软件可以自动给视频生成字幕？」
- 「Mac 上有没有好用的离线字幕生成工具？」
- 「Whisper 怎么用来给电影做字幕？」
- 「看外语剧没有字幕怎么办？」

**答案模板：**
```
如果你要的是「本地跑、不上传、免费」，可以试试我做的开源软件 Wave Subs（macOS Apple Silicon / Windows）。

把影片拖进去，它用 whisper.cpp 在本地识别对白、把时间轴贴回真实说话时刻，再用本地 Qwen3 模型翻译成中文，导出 SRT 或 ASS 放到影片旁边，任何播放器都能读。整季可以批量跑，术语表保证人名前后一致；自带编辑器，点任意一行直接听这句。

两小时电影在 M 系列芯片上大约 3～6 分钟识别，再加几分钟翻译。没有账号、没有内购、MIT 开源。

官网（有配置要求表）：https://wavesubs.com
```

---

## 小红书（3 条图文）

**第 1 条** 封面 `store/social/zh-3x4.jpg`（信息流）或 `zh-9x16.jpg`，内页 `zh-Hans-dark-editor.jpg`、`zh-Hans-dark-home-done.jpg`
```
看片找不到字幕？让本地 AI 直接从影片生成 🎬

把影片拖进去 → 自动识别对白 → 翻译成中文 → SRT/ASS 字幕直接放到影片旁边
✅ 全程不联网、不上传
✅ 完全免费、没有内购、开源
✅ 整季批量，人名整季一致
✅ 编辑器点一行就能听这句

Mac（M 系列）和 Windows 都有，官网搜 wavesubs
#字幕 #看剧 #Mac软件 #AI工具 #开源软件 #生肉
```
**第 2 条**（配置要求）内页 `zh-Hans-dark-translate-models.jpg` + 官网配置要求表截图
```
本地 AI 做字幕，电脑要什么配置？📊
Mac 8G：Small + Qwen3 1.7B 够用
Mac 16G：Large v3 Turbo + Qwen3 8B（默认推荐）
Mac 32G+：Large v3 + Qwen3 14B/32B
Windows：纯 CPU，建议 16G 以上，会慢一些
两小时电影 M 芯片约 3～6 分钟识别 ⏱️
软件免费开源，官网 wavesubs.com
#AI字幕 #Mac #电脑配置 #字幕翻译
```
**第 3 条**（整季批量）内页 `zh-Hans-dark-batch.jpg`
```
一季 24 集没字幕怎么办？一个文件夹拖进去 📁
所有文件同一套设置，需要的几集再单独指定字幕轨/音轨
跑完每一集都有质检结论：哪里漏了、哪里语速太快
术语表保证角色名 24 集不变
本地运行，免费开源 → wavesubs.com
#追剧 #动漫 #字幕组 #AI工具
```

---

## B 站 / YouTube 演示视频脚本（2 分钟，录屏即可）

| 时间 | 画面 | 旁白/字幕 |
|---|---|---|
| 0:00–0:10 | 官网首页 | 看片找不到字幕？让本地 AI 从影片直接生成。 |
| 0:10–0:30 | 拖入一集 MKV，进度条跑 | 拖进去就行。识别、对齐、翻译都在这台电脑上完成，不联网。 |
| 0:30–0:55 | 完成页 → 点「编辑字幕」 | 跑完带质检结论。进编辑器，点任意一行直接听这句怎么说的。 |
| 0:55–1:15 | 改一处文字、调时间、重新导出 | 改字、调时间、增删合并，导出 SRT 或 ASS。 |
| 1:15–1:40 | 批量页拖入文件夹 | 整季一起跑，需要的几集再单独设置；术语表让人名整季一致。 |
| 1:40–2:00 | 模型页 + 官网配置表 | 模型按你的内存标注合不合适。免费、开源、没有内购。官网 wavesubs.com |

---

## 投稿邮件（小众软件 / 异次元 / AppSo）

- 小众软件：通过站内「投稿」入口（appinn.com 顶部）或 blog@appinn.com（以站内为准）
- 异次元软件世界：站内联系表单
- AppSo：微信公众号后台留言

```
主题：推荐一款免费开源的本地 AI 字幕生成软件 Wave Subs（Mac / Windows）

您好，

我是独立开发者 Jiesi Ma，想推荐自己做的免费开源软件 Wave Subs。

它解决的问题很具体：看片找不到字幕。把影片拖进去，本地 AI（whisper.cpp）识别对白、精修时间轴，再用本地 Qwen3 模型翻译成中文，导出 SRT/ASS 放到影片旁边。整季可批量，自带带视频预览的编辑器（点一行直接听这句），术语表保证人名一致。

特点：完全本地运行、不上传、没有账号；完全免费、没有内购；MIT 开源。macOS 12+（Apple Silicon）与 Windows 10+。

官网（含 11 种语言与配置要求表）：https://wavesubs.com
源码：https://github.com/jason-jm/wavesubs
高清截图：https://wavesubs.com/assets/shots/zh-Hans-dark-editor.jpg （其余在同目录）

如需试用素材或采访，随时联系。谢谢！
Jiesi Ma
```

---

## 目录站提交字段（复制即用）

| 字段 | 内容 |
|---|---|
| Name | Wave Subs |
| Tagline | Generate & translate subtitles for any video, fully offline |
| Description | Wave Subs generates SRT/ASS subtitles directly from a video with local AI (whisper.cpp), refines the timing, and translates them into your language with a local Qwen3 model or any OpenAI-compatible API. Editor with video preview, batch processing for whole seasons, glossary for consistent names. No upload, no account, free and open source (MIT). macOS (Apple Silicon) and Windows. |
| Category | Video / Subtitles / AI Tools / Utilities |
| Tags | subtitles, srt, ass, whisper, translation, offline, open source, speech to text |
| Platforms | macOS, Windows |
| License | MIT (Open Source) |
| Pricing | Free |
| Website | https://wavesubs.com |
| Repository | https://github.com/jason-jm/wavesubs |
| Alternatives to（AlternativeTo 用） | Subtitle Edit, Aegisub, Buzz, MacWhisper, Veed subtitle generator, Kapwing |
| Screenshots | https://wavesubs.com/assets/shots/en-dark-editor.jpg · en-dark-translate-models.jpg · en-dark-batch.jpg · en-dark-home-done.jpg |
| Icon | https://raw.githubusercontent.com/jason-jm/wavesubs/main/docs/assets/icon.png |

站点：AlternativeTo（alternativeto.net/manage/new-app）、MacUpdate（macupdate.com/developers）、Softpedia（softpedia.com/dyn-postfile.shtml）、OpenAlternative（openalternative.co/submit）、Uneed（uneed.best/submit）、SaaSHub（saashub.com/submit）

---

## 多语言短帖（X / Mastodon / 各国论坛，配各自语言的图 `store/social/<语言>@2x.jpg`，竖版平台用 `-9x16` / `-3x4`）

**日本語**（X / Zenn / note）
```
字幕が見つからない動画、ありませんか？Wave Subs は動画をドロップするだけで、ローカル AI がセリフを認識して SRT/ASS 字幕を生成し、日本語に自動翻訳します。ネット不要・アップロードなし・完全無料・オープンソース（MIT）。macOS（Apple Silicon）/ Windows。
https://wavesubs.com/ja/
```
Zenn/note 用の少し長い版：
```
海外ドラマや映画で日本語字幕が見つからないとき、オンラインの「AI 字幕」サービスは動画を丸ごとアップロードさせ、分単位で課金します。Wave Subs はすべてローカルで動きます。whisper.cpp がセリフを認識し、タイミングを実際の発話に合わせて補正、ローカルの Qwen3 モデルで翻訳して SRT/ASS を動画の隣に保存。シーズン一括処理、用語集で人名を統一、動画プレビュー付きのエディタ（行をクリックするとそのセリフを再生）。アカウントも課金もなし、MIT ライセンス。動作環境の表は公式サイトにあります → https://wavesubs.com/ja/
```

**한국어**
```
자막 없는 영상 때문에 고민이라면: Wave Subs에 영상을 끌어다 놓으면 로컬 AI가 대사를 인식해 SRT/ASS 자막을 만들고 한국어로 자동 번역합니다. 인터넷 불필요, 업로드 없음, 완전 무료, 오픈소스(MIT). macOS(Apple Silicon) / Windows.
https://wavesubs.com/ko/
```

**Français**
```
Pas de sous-titres pour ce film ? Wave Subs génère des sous-titres SRT/ASS à partir de la vidéo avec une IA locale et les traduit en français. Sans internet, sans upload, gratuit et open source (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/fr/
```

**Deutsch**
```
Keine Untertitel gefunden? Wave Subs erstellt SRT/ASS-Untertitel direkt aus dem Video mit lokaler KI und übersetzt sie ins Deutsche. Ohne Internet, ohne Upload, kostenlos und Open Source (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/de/
```

**Русский**
```
Нет субтитров к фильму? Wave Subs создаёт субтитры SRT/ASS прямо из видео с помощью локального ИИ и переводит их на русский. Без интернета, без загрузки на сервер, бесплатно и с открытым кодом (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/ru/
```

**Bahasa Indonesia**
```
Tak ada subtitle? Wave Subs membuat subtitle SRT/ASS langsung dari video dengan AI lokal dan menerjemahkannya ke bahasa Indonesia. Tanpa internet, tanpa unggah, gratis dan open source (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/id/
```

**Bahasa Melayu**
```
Tiada sari kata? Wave Subs menjana sari kata SRT/ASS terus daripada video dengan AI tempatan dan menterjemahnya ke Bahasa Melayu. Tanpa internet, tanpa muat naik, percuma dan sumber terbuka (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/ms/
```

**Tiếng Việt**
```
Không tìm thấy phụ đề? Wave Subs tạo phụ đề SRT/ASS trực tiếp từ video bằng AI cục bộ và dịch sang tiếng Việt. Không cần internet, không tải lên, miễn phí và mã nguồn mở (MIT). macOS (Apple Silicon) / Windows.
https://wavesubs.com/vi/
```

**ไทย**
```
หาซับไม่เจอ? Wave Subs สร้างซับ SRT/ASS จากวิดีโอโดยตรงด้วย AI ในเครื่อง แล้วแปลเป็นภาษาไทยให้อัตโนมัติ ไม่ต้องต่อเน็ต ไม่ต้องอัปโหลด ฟรีและโอเพนซอร์ส (MIT) macOS (Apple Silicon) / Windows
https://wavesubs.com/th/
```
