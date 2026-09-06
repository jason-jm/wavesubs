# App Store Connect 填写材料（ASO 版，1.0.1）

> 全部可直接粘贴。截图在 `store/screenshots/<语言>/`（2880×1800，11 种语言各 8 张，App Store 最多传 10 张）。
> 建议顺序：editor → translate-models → batch → home-done → glossary。
> ASO 原则：名称与副标题里的词不要在关键词里重复；关键词逗号分隔、不加空格、不用复数重复。

## 名称 / 副标题（每种商店语言分别填）

| 商店语言 | 名称（30 字内） | 副标题（30 字内） |
|---|---|---|
| 简体中文 | Wave Subs：AI 字幕生成与翻译 | 看片找不到字幕？本地生成、离线免费 |
| English (U.S.) | Wave Subs: AI Subtitle Maker | Make & translate SRT from video |
| 日本語 | Wave Subs：AI 字幕生成・翻訳 | 動画から字幕を作成、オフライン無料 |
| 한국어 | Wave Subs: AI 자막 생성·번역 | 영상에서 자막 생성, 오프라인 무료 |

## 关键词（100 字符以内，逗号分隔，不含名称/副标题里已有的词）

**简体中文：** `字幕,SRT,ASS,视频字幕,自动字幕,whisper,语音识别,动漫,电影,日语,英语,批量,MKV,编辑器`
**English：** `srt,ass,captions,transcribe,whisper,offline,local,video,movie,anime,japanese,batch,mkv,free`

## 宣传文本（170 字符，可随时改，不需要审核）

**简体中文：** 看片找不到字幕？把影片拖进来：本地 AI 识别对白、生成 SRT/ASS 字幕，并翻译成你的语言。无需联网，永久免费。
**English：** Can't find subtitles? Drop in a video: local AI recognizes the dialogue, generates SRT/ASS subtitles and translates them into your language. No internet needed, free forever.

## 描述（4000 字符以内）

### 简体中文

看片找不到字幕？Wave Subs 用本地 AI 直接从影片生成 SRT / ASS 字幕，并自动翻译成你的语言。全部在你自己的 Mac 上完成——无需联网，永久免费。

三步出字幕
• 拖进影片：MKV、MP4、MOV、TS 都行；影片自带的文本字幕轨会被自动发现并直接使用
• 本地 AI 识别并对齐：whisper.cpp 在 Apple Silicon 上用 Metal 加速，自动检测语种；时间轴按真实说话时刻精修，参数用六部整片对照官方字幕校准
• 翻译并导出：导出 SRT 或 ASS，放到影片旁边任何播放器都认；跑完附带质检结论

自动翻译到你的语言
29 种目标语言：中文简繁、英、日、韩、法、德、西、葡、俄、泰、越、印尼、马来等。默认用本地运行的 Qwen3 模型，免费、不联网；也可以接入任何 OpenAI 兼容接口（费用由服务商收取）。术语表让整季的人名前后一致。

字幕编辑器，带视频预览
改文字、调时间、增删合并、撤销、自动保存。点任意一行直接听这句话怎么说的——HEVC、DTS 这类格式也能预览。字幕叠加实时反映修改。

质检报告
每个文件跑完都体检：漏识别的段落、超长条、语速过快、缺译文、译文残留原文，直接告诉你该看哪。

整季批量
把整个文件夹拖进来，全部文件用同一套设置，个别文件可以单独指定字幕轨、音轨或引擎。

不做重复的活
识别结果和译文分层缓存：换个导出格式、换个翻译模型重跑只要几秒；换了模型或术语表则严格重翻，绝不混用旧译文。

为什么坚持本地
在线字幕工具要你上传整部影片、按分钟计费。Wave Subs 没有账号、没有统计、没有服务器，视频从不上传，不限时长。模型下载好之后断网也能用。

系统要求：macOS 12 或更新，Apple Silicon。首次使用会引导下载识别模型（1.6～3 GB）。

### English

Can't find subtitles for a video? Wave Subs generates SRT / ASS subtitles directly from the video using local AI, then auto-translates them into your language. Everything runs on your own Mac — no internet needed, free forever.

Three steps to subtitles
• Drop in the video: MKV, MP4, MOV, TS — all fine; an embedded text subtitle track is detected and used directly
• Local AI recognizes and aligns: whisper.cpp with Metal acceleration on Apple Silicon, automatic language detection; timing snapped to when lines are actually spoken, tuned against official subtitles of six full films
• Translate and export: SRT or ASS next to the video, readable by any player, with a quality verdict attached

Auto-translated into your language
29 target languages: Chinese (Simplified/Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian, Malay and more. A locally running Qwen3 model by default — free and offline — or any OpenAI-compatible API (billed by the provider). A glossary keeps names consistent across a season.

An editor with video preview
Fix text, adjust timing, insert, delete, merge, undo, autosave. Click any line to hear exactly how it was said — HEVC and DTS preview too. The overlay reflects your edits live.

Quality report
Every file gets a health check: missed passages, overlong lines, unreadable speed, missing or half-done translations — it tells you exactly where to look.

Batch a whole season
Drop in a folder; every file follows the shared settings, and individual files can override the subtitle track, audio track or engine.

Never redo work
Recognition and translation are cached separately: re-export or retry in seconds; change the model or glossary and it retranslates strictly, never mixing old output in.

Why local
Online subtitle tools make you upload the whole film and charge per minute. Wave Subs has no account, no analytics, no server; videos are never uploaded and there is no length limit. Once models are downloaded it works with the network off.

Requires macOS 12 or later on Apple Silicon. On first launch you'll be guided to download a recognition model (1.6–3 GB).

## 版本说明（What's New）

**1.0.1 简体中文：** 翻译目标语言扩展到 29 种，首次启动默认翻译到系统语言；界面颗粒纹理更细腻。
**1.0.1 English：** 29 translation target languages; first launch now defaults to your system language; a subtler interface texture.

## 基本信息

| 字段 | 值 |
|---|---|
| Bundle ID | com.wavesubs.desktop |
| SKU | wavesubs-mac |
| 类别 | 主类别 视频 (Video)；次类别 效率 (Productivity) |
| 年龄分级 | 4+ |
| 价格 | 免费 |
| 版权 | © 2026 Jiesi Ma |
| 支持网址 | https://github.com/jason-jm/wavesubs/issues |
| 营销网址 | https://jason-jm.github.io/wavesubs/ |
| 隐私政策网址 | https://jason-jm.github.io/wavesubs/#privacy |

## App 隐私问卷（App Privacy）

- 是否收集数据：**否**（Data Not Collected）。应用没有账号、没有统计、没有崩溃上报。
- 说明：云端翻译是用户自行配置的第三方服务，由用户直接与服务商建立关系，应用本身不收集、不转发给开发者。
- 模型下载来自 Hugging Face 公开仓库（网络请求仅此一种 + 用户配置的翻译接口）。

## 出口合规

- 使用非豁免加密：**否**（`ITSAppUsesNonExemptEncryption = false` 已写进 Info.plist）。只用系统 HTTPS。

## 审核备注（App Review Information → Notes）

Wave Subs runs entirely on-device. To test:
1. Launch the app. On first run, open "Models" and download "Large v3 Turbo" (about 1.6 GB) — this is required for speech recognition.
2. Drag any video file with speech into the "Convert" tab and press Start. An SRT file is written next to the video (or to ~/Movies/Wave Subs when the source folder is not writable in the sandbox).
3. Translation defaults to a local model (download "Qwen3 1.7B" under Models → Local translation to try it). No account or API key is needed for any feature.
The app bundles ffmpeg (LGPL) and whisper.cpp / llama.cpp (MIT); licenses are in the app bundle and at https://github.com/jason-jm/wavesubs/blob/main/THIRD-PARTY-LICENSES.md.

## 版本说明（What's New，1.0.0）

首个版本。/ Initial release.

## 需要在开发者后台先做的事

1. **Identifiers → App IDs**：注册 `com.wavesubs.desktop`（macOS），能力勾选 App Sandbox 默认即可，**App Groups** 加 `TZ7V6PMGV6.com.wavesubs.desktop`
2. **Certificates**：申请 *Apple Distribution*（签 App）与 *Mac Installer Distribution*（签 .pkg）——CSR 用之前桌面上那种方式生成
3. **Profiles**：新建 *Mac App Store* 类型的 Provisioning Profile，绑定上面的 App ID，下载后放到 `build/WaveSubs_MAS.provisionprofile`
4. **App Store Connect → 我的 App → +**：平台 macOS，名称 Wave Subs，Bundle ID 选上面注册的，SKU `wavesubs-mac`
5. 之后 `npm run release:mas` 产出 `.pkg`，用 **Transporter**（App Store 下载）上传，再在 App Store Connect 选构建版本、填以上文案、提交审核

## 当前状态（2026-09-06）

- ✅ `mas` 目标已能完整装配 App（MAS 版 Electron、沙盒 entitlements、随包二进制、Info.plist 的
  ElectronTeamID / ITSAppUsesNonExemptEncryption 均就位），停在签名一步——等 *Apple Distribution* 证书。
- ✅ 沙盒行为改造（输出兜底到 ~/Movies/Wave Subs）已在代码里，且已随官网版 1.0.0 发布（非沙盒下不触发）。
- ⏳ 待你完成：上传桌面上两张 CSR 换证书 → 注册 App ID / App Group / Provisioning Profile → App Store Connect 建 App。
  证书装进钥匙串、profile 放到 `build/WaveSubs_MAS.provisionprofile` 后，我会自动检测并跑 `release:mas` 出 `.pkg`。

## 2026-09-06 14:10：App Store 包已出、自检全绿

- 文件：`release/mas-arm64/Wave Subs-1.0.0-arm64.pkg`（135 MB）
- App 用 Apple Distribution 签名，四个 Helper 与五个随包二进制均继承沙盒；pkg 用 Mac Installer Distribution 签名
- `scripts/verify-mas.sh` 全部通过（entitlements、内嵌描述文件、ElectronTeamID、deep --strict）
- electron-builder 的 `mas` 目标把 pkg 放在 `release/mas-arm64/`，不在 `release/` 顶层
- 上传：Mac App Store 安装 Transporter → 拖入 pkg → Deliver；之后在 App Store Connect 建 App 记录、选构建、填元数据、提交审核
