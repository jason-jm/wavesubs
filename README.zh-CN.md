# Wave Subs

[English](./README.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Русский](./README.ru.md) · [Bahasa Indonesia](./README.id.md) · [Bahasa Melayu](./README.ms.md) · [Tiếng Việt](./README.vi.md) · [ไทย](./README.th.md)

**看片找不到字幕？** Wave Subs 用本地 AI 直接从影片生成 SRT / ASS 字幕，并翻译成你的语言。识别、时间轴、翻译、画面文字、编辑全部在你自己的电脑上完成：不上传、不用账号、免费开源。macOS（Apple Silicon）与 Windows。

[![Release](https://img.shields.io/github/v/release/jason-jm/wavesubs?label=download)](https://github.com/jason-jm/wavesubs/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/macOS%2012%2B%20Apple%20Silicon%20%7C%20Windows%2010%2B-lightgrey)

**官网：** https://wavesubs.com （11 种语言） · [下载](https://github.com/jason-jm/wavesubs/releases/latest) · [更新日志](CHANGELOG.zh-CN.md) · [隐私政策](https://wavesubs.com/privacy.html)

![带视频预览的字幕编辑器](docs/assets/shots/zh-Hans-dark-editor.jpg)

## 怎么用

1. **拖进一部影片、一个字幕文件，或者整个文件夹。** MKV、MP4、MOV、TS、AVI，凡是 ffmpeg 能读的都行，纯音频文件也可以。影片自带文本字幕轨的，会自动发现并直接使用。
2. **本地 AI 识别对白并对齐。** whisper.cpp 在你的电脑上识别语音，自动判断语种；每一条字幕都贴回真正说话的那一刻。
3. **翻译并导出。** 本地 Qwen3 模型译成你的语言（也可以接你自己的云端服务），成品以 SRT 或 ASS 写在影片旁边，并附带一份质检结论，告诉你哪几行值得看一眼。

M 系列 Mac 上用 Large v3 Turbo 识别一部两小时电影约 3～6 分钟，本地翻译再加几分钟。整季拖进去挂着跑就行。

## 你会得到什么

### 三种字幕来源

- **语音识别。** Whisper 模型家族（Tiny 到 Large v3），由 whisper.cpp 运行，Apple Silicon 上 Metal 加速。识别覆盖 Whisper 支持的近百种语言。语种自动判断：在人声最密的几处各取 20 秒投票，片头音乐不会把整集判错；也可以自己指定。
- **内嵌字幕轨。** MKV / MP4 里的文本字幕轨会被发现并优先使用（比识别更快、完全准确）；有多条时逐文件选。图形字幕（PGS、VobSub、DVB）不能作为来源。
- **外部字幕文件。** 18 种格式：SRT、ASS / SSA、WebVTT、SAMI、MicroDVD、SubViewer、MPL2、VPlayer、JACOsub、RealText、STL、PJS、LRC、TTML / DFXP、SBV 等。编码自动识别（UTF-8、UTF-16、GBK、Big5、Shift-JIS、EUC-KR、Windows-1252）。

### 跟着人声走的时间轴

- 用语音活动检测（Silero VAD）和响度分析把每条字幕的起止贴回真实说话时刻；参数对照六部整片的官方字幕校准，不是拍脑袋。
- 没人说话处 Whisper 编造的句子会被剔除，只有音符的 ♪ 条丢掉，结巴式复读（やばいやばいやばい）折叠。
- 过长的条在自然边界切分，日语有专门的假名 / 汉字交界规则。

### 翻译

- **29 种目标语言：** 中文（简体、繁体）、英语、日语、韩语、法语、德语、西班牙语、葡萄牙语、意大利语、荷兰语、俄语、乌克兰语、波兰语、捷克语、匈牙利语、瑞典语、丹麦语、挪威语、芬兰语、希腊语、土耳其语、希伯来语、阿拉伯语、印地语、泰语、越南语、印尼语、马来语。首次启动默认译成系统语言。
- **默认本地。** Qwen3 1.7B 到 32B 通过 llama.cpp 在你的电脑上运行，应用内下载。免费、离线、没有额度。
- **需要时接云端。** 任何 OpenAI 兼容接口，用你自己的密钥；内置 OpenAI、Anthropic Claude、Google Gemini、DeepSeek、通义千问、智谱 GLM、Moonshot、火山方舟、硅基流动、OpenRouter、Azure OpenAI 的快速填写。密钥用系统的凭据存储加密保存。发出去的只有字幕文本，从不是视频。
- **术语表。** 人名、术语的译法定一次，整季前后一致。只注入当批命中的条目，对白和画面文字共用一份。
- **同一个名字只有一种写法。** 收尾时按源文里反复出现的专名分组，把少数写法改成多数写法，不会第三集叫「韦伯」、第四集叫「威伯」。
- **为字幕而不是为段落设计。** 分批翻译带对齐锚，译文不会串到相邻一行；半句就译成半句；听写有错的句子也按最可能的意思译出来，不留空；模型把原文照抄回来的，每一轮重试都会拦下。
- **导出：** 仅译文、双语或仅原文，SRT 或 ASS。

### 画面文字

打开「翻译画面中的文字」，招牌、便签、短信和聊天气泡、告示、文件、标题卡、集数标题、人物名牌也会被读出来翻译。

- 用系统自带的文字识别：macOS 的 Vision、Windows 的 Windows.Media.Ocr。不下载任何模型；24 分钟一集多花两三分钟，与语音识别并行。
- 译文贴在原文旁边：先放正下方，再放左右，再挪到画面顶部，实在没位置才盖在原文上。绝不进入对白字幕占用的高度，宁可字号缩小也不遮挡。只有整屏的邮件、短信、文件才铺一块不透明底板换掉原文。
- 不该出的不出：片头片尾名单（含演员表、声优表）、片源烧录的字幕、台标和水印、地图番号和书脊这类密集小字、走廊里反复入镜的门牌、被识别读坏的颜文字、译文和原文一样的。
- ASS 里按原文位置定位，SRT 放在顶部。编辑器里语音字幕和画面文字分两个页签；同一个文件跑两遍得到同一份结果。

### 带视频预览的编辑器

- 在表格里改文字和时间，插入、删除、合并、撤销，自动保存。
- 点任意一行，直接听这句话怎么说的。浏览器播不了的格式（HEVC、DTS、TrueHD）由随包的 ffmpeg 预览。
- 质检发现可以点击跳转。改过原文的行会被标出，重译只补这些行。
- 随时再导出：SRT 或 ASS，仅译文、双语或仅原文。

### 每个文件一份质检报告

每个完成的文件都有结论（通过 / 值得看一眼 / 有问题）和理由：语音覆盖率、漏段、超长条、语速过快、缺译文、译文残留原文、起止颠倒。阈值来自整片基准，每条发现都链接到编辑器里的那一行。

### 整季一起跑

- 拖进一个文件夹。文件逐个处理，一个失败不影响整批，随时可以取消。
- 全部文件用同一套设置，任何文件可以单独指定字幕来源、音轨、语言、翻译服务或格式。
- 进度显示当前阶段和预计剩余时间；完成卡片告诉你识别用的是哪块设备（Apple M 系列 GPU、Vulkan 显卡或 CPU）。
- 什么都不做第二遍。识别结果按文件身份加全部影响参数缓存，重新导出或换格式只要几秒。译文只在引擎与模型、目标语言、提示词版本、术语表全部一致时复用，否则整个重来，绝不混入旧译文。

### 模型在应用内下载

- 首次启动，转换页直接推荐适合这台机器的模型并给出「下载并继续」，下完立刻能开始。
- 模型页按你的内存标出每个模型合适 / 可用 / 跑不动，并给出它对你的语言有多准（见下）。下载来自 Hugging Face 或 ModelScope（中国大陆优先），下载后核对 SHA-256；所有来源都连不上时列出直接地址，自己下好放进模型文件夹即可。

### 界面

32 种界面语言（阿拉伯语、孟加拉语、简体中文、繁体中文、捷克语、丹麦语、荷兰语、英语、芬兰语、法语、德语、希腊语、希伯来语、印地语、匈牙利语、印尼语、意大利语、日语、韩语、马来语、挪威语、波斯语、波兰语、葡萄牙语、罗马尼亚语、俄语、西班牙语、瑞典语、泰语、土耳其语、乌克兰语、越南语），浅色与深色模式，十套配色，完整的键盘焦点。应用启动时检查一次新版本（设置里可关），有新版本给下载按钮；用 Homebrew 或 Scoop 装的给对应的升级命令。

## 按语言挑识别模型

Whisper 各模型的差距主要在语言而不在大小。下表是意思保留率：识别出的对白里意思完整的比例，用英语电影《聚焦》、德语电影《气球》、日语 NHK 大河剧《镰仓殿的 13 人》各截 30 分钟走产品管线，每部抽 50 句盲评。公开评测里韩语、普通话与日语同档；西班牙语、意大利语、葡萄牙语比德语略好，法语、荷兰语、波兰语略差。

| 模型 | 下载 | 运行占用内存 | 英语 | 欧洲语言 | 日语 · 韩语 · 中文 |
|---|---|---|---|---|---|
| Tiny | 75 MB | 0.5 GB | 68 % | 49 % | 37 % |
| Base | 142 MB | 0.7 GB | 79 % | 61 % | 57 % |
| Small | 466 MB | 1.2 GB | 92 % | 81 % | 66 % |
| Medium | 1.5 GB | 2.6 GB | 91 % | 81 % | 79 % |
| Large v3 Turbo | 1.6 GB | 2.2 GB | 95 % | 96 % | 89 % |
| Large v3 | 3.0 GB | 4.5 GB | 96 % | 94 % | 88 % |

应用里 85 % 以上标「推荐」，75 % 标「可用」，60 % 标「勉强」，再低标「不建议」。一句话：英语 Small 就够，欧洲语言 Small 可用，日语、韩语、中文至少 Large v3 Turbo。整片实测 Large v3 Turbo 与 Large v3 质量只差一个百分点，速度却快约三倍，所以多数机器上默认推荐它。

| 你的机器 | 识别 | 翻译 | 说明 |
|---|---|---|---|
| Mac 8 GB | Small 或 Large v3 Turbo | Qwen3 1.7B | 够用；跑 Turbo 时别同时开太多程序 |
| Mac 16 GB | Large v3 Turbo | Qwen3 8B | 默认推荐，质量与速度的平衡点 |
| Mac 32 GB | Large v3 | Qwen3 14B | 识别质量最高，翻译更准 |
| Mac 48 GB 及以上 | Large v3 | Qwen3 32B | 翻译质量最高，速度较慢 |
| Windows PC 16 GB | Large v3 Turbo | Qwen3 4B | CPU 识别，耗时是 Apple Silicon 的数倍 |
| Windows PC 32 GB | Large v3 Turbo | Qwen3 8B | 大模型可跑，请预留时间 |

本地翻译模型：Qwen3 1.7B（下载 1.8 GB，运行 2.5 GB）、4B（2.4 GB，3.5 GB）、8B（4.9 GB，6 GB）、14B（9.0 GB，10.5 GB）、32B（19.7 GB，22 GB）。识别与翻译先后进行，不会同时占用两份内存。

## 实测效果

2026 年 9 月用 70 部整片（NAS 上的官方字幕轨与知名字幕组字幕作 ground truth，日语 36 部、英语 21 部、其余 13 部）跑出的数字：

- **识别（Whisper Large v3）：** 英语 19 部平均词错误率 17.4 %（纪录片 / 访谈约 6 %，官方剧集 10～13 %）；日语 18 部逐字 CER 19.1 %、读音 CER 13.8 %，约三分之一的「错」只是写法差异（分かった / わかった）。德语、挪威语、意大利语的官方字幕多为压缩改写，不能按逐字比。
- **翻译（日→中，本地 Qwen3）：** 以人工字幕原文为输入时，语义准确率 8B 93.5 %、14B 94.4 %、32B 93.9 %，默认 8B 是稳妥的选择；端到端（识别→翻译）约 83～85 %，差距几乎全部来自识别错误。
- **时间轴：** 逐帧掩码 F1 81.8 %，字幕起点落在人工字幕 ±250 ms 内的比例 57 %；不同片源的人工字幕本身就有 100～300 ms 的提前量差异。

## 隐私

没有账号、没有统计、没有服务器。视频从不离开你的电脑；识别、对齐、翻译、画面文字、编辑全部本地完成，模型下载好之后断网也能用。

只有三件事会用到网络，每一件都由你决定：

1. **下载模型**，来自 Hugging Face 或 ModelScope，在你点下载时。
2. **云端翻译**，只在你自己配置了服务商时；它收到的是字幕文本，费用由它直接向你收取。
3. **启动时的更新检查**，从本仓库的 GitHub Release 取一个很小的 JSON 文件。设置里可以关掉，App Store 版根本不查。

完整政策：https://wavesubs.com/privacy.html

## 配置要求与安装

| | macOS | Windows |
|---|---|---|
| 要求 | macOS 12 或更新，Apple Silicon（M1 及之后） | Windows 10 或更新，x64，建议 16 GB 内存 |
| 下载 | [DMG 或 ZIP](https://github.com/jason-jm/wavesubs/releases/latest)，已由 Apple 公证 | [安装程序或便携 ZIP](https://github.com/jason-jm/wavesubs/releases/latest) |
| 包管理器 | `brew install --cask jason-jm/wavesubs/wavesubs` | `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs`<br>`scoop install wavesubs` |
| 加速 | Metal（识别与翻译） | 识别在 CPU；翻译用任何有 Vulkan 驱动的显卡，没有则 CPU |

ffmpeg、whisper.cpp、llama.cpp 已随包附带，装完就能用。识别模型 75 MB 到 3 GB，本地翻译模型 1.8 到 20 GB，都在应用内按需下载。不支持 Intel Mac：本地识别依赖 Metal，Intel 机器上慢到不实用。

**Windows：** 安装包尚未代码签名，首次运行 SmartScreen 会提示「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可。每个文件的校验值在发布页的 `SHA256SUMS.txt`。要翻译画面文字，先在 Windows 设置里装好片中语言的语言包并勾选「光学字符识别」。

## 已知限制

- Windows 上的画面文字识别弱于 macOS，竖排日文基本读不出。
- 名单之外成排的人名（话剧海报上的演员名、比制作名单早半分钟单独打出的主演名）仍会被译出来。
- 8B 及以下的本地模型对机构名、历史术语等专有名词不稳，术语表是可靠的办法。
- 片源自己把画面文字的译文烧在画面上时，会和本程序的译文并存。
- 没有 Intel Mac 与 Windows ARM64 版本；Windows 的识别只走 CPU。

## 常见问题

**哪些视频可以生成字幕？** MKV、MP4、MOV、TS、AVI 等常见格式；HEVC、DTS、TrueHD 这类浏览器播不了的编码也没问题，随包的 ffmpeg 什么都能解。纯音频文件同样可以。

**支持哪些语言？** 识别覆盖 Whisper 支持的近百种语言并自动检测；翻译目标 29 种；界面 32 种语言。

**真的不需要联网吗？** 是的。只有第一次下载模型、你自己配置的云端翻译，以及可关闭的更新检查会用到网络。

**准吗？** 见上文「按语言挑识别模型」与「实测效果」。按语言挑模型，每个文件都附带质检结论。

**影片里已经有字幕轨了呢？** 内嵌的文本字幕轨会被发现并优先使用，直接进入翻译。图形字幕（PGS / VobSub）除外。

**在中国大陆下载模型失败。** 全部模型都能从 ModelScope 下载，系统语言为简体中文或时区在中国时会优先尝试它。所有来源都失败时，错误提示会列出直接地址，用浏览器或下载工具下载即可。

**和在线字幕生成网站比有什么区别？** 在线工具要你上传整部影片、按分钟计费、通常有时长上限。Wave Subs 不上传、不收费、不限时长，速度取决于你的电脑。

## 反馈与支持

- [问题反馈与功能建议](https://github.com/jason-jm/wavesubs/issues)在 GitHub 上提，没有 GitHub 账号可以用[官网反馈表单](https://wavesubs.com/feedback.html)。任务失败时有「复制日志」按钮，把日志贴进反馈里。
- [讨论区](https://github.com/jason-jm/wavesubs/discussions)聊用法和配置。
- [更新日志](CHANGELOG.zh-CN.md)看每个版本改了什么。

## 许可

Wave Subs 以 [MIT 许可证](./LICENSE)发布。随包分发的第三方组件（LGPL 的 ffmpeg、MIT 的 whisper.cpp 与 llama.cpp、Whisper 与 Qwen 模型等）各自的许可见 [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md)。

*从源码构建、命令行用法与代码结构见 [DEVELOPMENT.md](./DEVELOPMENT.md)（英文）。*
