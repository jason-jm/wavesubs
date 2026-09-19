# 1.0.8 推广帖（小红书中文 · X 英文），全部可直接复制

> 图在 `store/social/posts/`：`update/` 是「更新了什么」（版本说明书风：白纸点阵、巨大版本号、新功能/修复/Windows 三色标签、统计大字），`raw/` 是「看生肉找不到字幕」（字幕文件风：奶油底、.srt 文件页签、「生肉」红章→「熟了」绿章、剧照上压真字幕、步骤写成 SRT 的 cue）。两组都是浅色主题，截图是浅色界面。
> 小红书用 `zh-01-cover.jpg` 做封面、其余按序号做内页（3:4，2160×2880）；X 用 `en-x1-cover.jpg` 做第 1 条配图，`en-x2-*.jpg`、`en-x3-*.jpg` 配后面的推文（16:9，2400×1350）。
> 链接统一 **https://wavesubs.com**；Release 页 https://github.com/jason-jm/wavesubs/releases/latest。
> 图片和文案由 `scripts/build-posts.py` 与本文件生成、维护；数字都来自 CHANGELOG 里写明的实测。

---

## 小红书 · 帖子 1：更新了什么

**封面** `update/zh-01-cover.jpg`，内页 `zh-02` → `zh-07`（画面文字 → 小模型翻译 → 按语言挑模型 → 第一次用 → 检查更新 → Windows）

**标题（≤20 字）：**
```
字幕神器更新：画面里的字也翻了
```
**正文：**
```
Wave Subs 更新到 1.0.8 了，两周里改动最大的一次，Mac 和 Windows 都有 🆕

🪧 翻译画面中的文字
招牌、便签、短信、聊天气泡、告示、标题卡、人物名牌，逐秒读画面，翻好按原文的位置写进字幕，不遮对白。用系统自带的文字识别，不用下载任何模型，一集多花两三分钟

🔧 小模型翻译修好了
用 1.7B 翻日语纪录片，整批译文被丢、原文被照抄成译文——两个根因都找到了。同一集里没译文或照抄的对白从 98 条降到 6 条，最难的几批第一轮真正译出来的比例从 40% 到 88%

📊 模型页按语言给参考
每个识别模型标出英语、欧洲语言、日语韩语中文的意思保留率（三部片各 30 分钟盲评）。一句话：英语 Small 就够，欧洲语言 Small 可用，日韩中至少 Large v3 Turbo，Tiny 别用于日语

🆕 第一次用不用先找模型：拖了文件直接给推荐模型和「下载并继续」
🔔 有新版本会在设置里提示，给下载按钮和更新说明
🪟 Windows：一部分机器一加载模型就崩的问题修了（换掉了 OpenBLAS）、深色下拉菜单看得清了、失败可一键复制日志

免费开源没有内购，官网搜 wavesubs，已经装了的下次打开会看到更新提示
#字幕 #AI字幕 #看剧 #Mac软件 #Windows软件 #开源软件 #生肉 #追剧
```

---

## 小红书 · 帖子 2：看生肉，找不到字幕？

**封面** `raw/zh-01-cover.jpg`，内页 `zh-02` → `zh-06`（三步 → 画面文字 → 编辑器 → 整季批量 → 隐私）

**标题（≤20 字）：**
```
看生肉找不到字幕？本地AI直接生成
```
**正文：**
```
追的剧、想看的纪录片、老电影，翻遍字幕站都没有中字？别等字幕组了 🎬

Wave Subs：把影片拖进去 → 本地 AI 识别对白 → 时间轴对齐到真实说话时刻 → 翻译成中文 → SRT/ASS 字幕直接放在影片旁边，任何播放器都认

✅ 连画面里的字都翻：招牌、短信、告示、标题卡按原文位置写进字幕
✅ 全程不联网、不上传、不要账号
✅ 一季 24 集拖一个文件夹进去整季跑，人名整季一致
✅ 自带编辑器，点任意一行直接听这句怎么说的
✅ 完全免费、开源、没有内购

两小时电影在 M 系列芯片上识别大约 3～6 分钟；Windows 也能用，CPU 跑会慢一些
Mac（M 系列）和 Windows 都有，官网搜 wavesubs
#生肉 #字幕 #AI字幕 #看剧 #追剧 #日剧 #动漫 #Mac软件 #开源软件
```

---

## X · Post 1: What's new（英文线程）

配图：第 1 条 `update/en-x1-cover.jpg`；第 3 条 `update/en-x2-numbers.jpg`；第 4 条 `update/en-x3-models.jpg`

```
1/ Wave Subs 1.0.8 is out — the biggest update in two weeks, on macOS and Windows.

New: it now translates the text on screen too. Signs, notes, text messages, chat bubbles, title cards, name plates — read once a second and written into the subtitles at the position of the original. 🧵
```
```
2/ It never covers the dialogue and only covers the original text as a last resort. Credits, station logos and burned-in subtitles stay out. It uses the OS text recognition (Vision on macOS, the built-in OCR on Windows) — nothing to download, two to three extra minutes per episode.
```
```
3/ Small local models got a lot better at translating. With the 1.7B model, whole batches used to be thrown away and source lines came back untranslated. Both causes are fixed: lines with no translation in one episode went from 98 to 6, and first-pass yield on the hardest batches from 40% to 88%.
```
```
4/ The Models page now tells you which model your language needs: meaning retention for English, European languages and Japanese · Korean · Chinese, blind-judged on 30-minute samples of three films. Short version: English → Small is enough; Japanese, Korean, Chinese → Large v3 Turbo or better.
```
```
5/ Also: a first-run flow that recommends a model and downloads it in place, an update check in Settings, and Windows fixes (a model-loading crash on some machines, dark-mode dropdowns, one-click log copy).

Free, open source, no account.
https://wavesubs.com
```

---

## X · Post 2: Watching raws with no subtitles?（英文线程）

配图：第 1 条 `raw/en-x1-cover.jpg`；第 2 条 `raw/en-x2-flow.jpg`；第 3 条 `raw/en-x3-editor.jpg`

```
1/ Watching raws because nobody subtitled that show, documentary or old film in your language?

Wave Subs: drop the file in → local AI recognizes the dialogue → timing snapped to the actual speech → translated into your language → SRT/ASS next to the video. No upload, no account, free & open source. 🧵
```
```
2/ It even translates the text on screen: signs, text messages, notices, title cards are written into the subtitles at the position of the original, never covering the dialogue.
```
```
3/ Built-in editor with video preview: click any line to hear exactly how it was said, fix the text or timing, export again. Drop in a whole season and a glossary keeps the names consistent across episodes.
```
```
4/ Everything runs on your machine. A two-hour film takes about 3–6 minutes to recognize on Apple Silicon; Windows works too (CPU, slower).

macOS (Apple Silicon) + Windows · MIT licensed
https://wavesubs.com
```
