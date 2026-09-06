# App Store Connect 填写材料

> 所有文案均可直接粘贴。截图用 `docs/assets/shots/*.png`（2880×1800，App Store 接受的 16:10 尺寸），
> 中文商店用 `zh-Hans-dark-*.png`，其它地区用 `en-dark-*.png`。建议顺序：editor → batch → home-done → glossary → models。

## 基本信息

| 字段 | 值 |
|---|---|
| 名称 | Wave Subs |
| 副标题（30 字内） | 本地字幕：识别、翻译、编辑 / Local subtitles: transcribe, translate, edit |
| Bundle ID | com.wavesubs.desktop |
| SKU | wavesubs-mac |
| 类别 | 主类别 视频 (Video)；次类别 效率 (Productivity) |
| 年龄分级 | 4+（无用户生成内容、无网络交互内容） |
| 价格 | 免费（若之后收费，在这里改） |
| 版权 | © 2026 Jiesi Ma |
| 支持网址 | https://github.com/jason-jm/wavesubs/issues |
| 营销网址 | https://jason-jm.github.io/wavesubs/ |
| 隐私政策网址 | https://jason-jm.github.io/wavesubs/#privacy |

## 关键词（100 字符以内，逗号分隔）

**中文：** 字幕,翻译,语音识别,Whisper,SRT,ASS,视频字幕,离线,本地,批量,日语,英语,动漫
**English:** subtitles,srt,ass,whisper,transcribe,translate,offline,local,captions,video,batch,anime,japanese

## 宣传文本（170 字符，可随时改，不需要审核）

**中文：** 在你自己的 Mac 上识别、对齐、翻译、编辑视频字幕。不上传任何文件，离线可用，整季批量处理。
**English:** Transcribe, align, translate and edit subtitles on your own Mac. Nothing is uploaded, works offline, batch whole seasons.

## 描述（4000 字符以内）

### 中文

Wave Subs 把一个视频变成一份可以直接用的字幕——全部在你自己的电脑上完成。

**三种字幕来源**
• 本地语音识别：whisper.cpp 在 Apple Silicon 上用 Metal 加速，自动检测语种
• 视频内嵌字幕轨：MKV/MP4 里的文本字幕直接抽出，按语言自动选轨
• 外部字幕文件：SRT、ASS、VTT 等 18 种格式，编码自动识别

**时间轴精修**
语音活动检测加响度分析，把识别出的句子贴回真实的说话时刻。参数用六部整片对照官方字幕反复校准，不是随手拍的。

**翻译，你说了算**
默认用本地 Qwen3 模型，免费离线；也可以接入任何 OpenAI 兼容的云端接口（费用由服务商收取）。术语表让整季的人名前后一致。

**编辑器，带视频预览**
改文字、调时间、增删合并、撤销、自动保存。点任意一行，直接听这句话怎么说的——HEVC、DTS 这类格式也能预览。字幕叠加实时反映你的修改。

**质检报告**
每个文件跑完都体检：漏识别的段落、超长条、语速过快、缺译文、译文残留原文，直接告诉你该看哪。

**批量**
把整个文件夹拖进来。全部文件用同一套设置，个别文件可以单独指定字幕轨、音轨或引擎。

**不做重复的活**
识别结果和译文分层缓存：换个导出格式、换个翻译模型重跑只要几秒；换了模型或术语表则严格重翻，绝不混用旧译文。

**隐私**
没有账号、没有统计、没有服务器。视频文件从不上传。只有当你自己配置了云端翻译，字幕文本才会发给你选择的服务商。

系统要求：macOS 12 或更新，Apple Silicon。首次使用会引导下载识别模型（约 1.6～3 GB）。

### English

Wave Subs turns a video into subtitles you can actually use — entirely on your own Mac.

**Three subtitle sources**
• Local speech recognition: whisper.cpp with Metal acceleration on Apple Silicon, automatic language detection
• Embedded subtitle tracks: text tracks inside MKV/MP4 are extracted directly, picked by language
• External subtitle files: 18 formats including SRT, ASS and VTT, with encoding auto-detected

**Timing refinement**
Voice activity detection plus loudness analysis snap recognized lines back to when they were actually spoken. Tuned against the official subtitles of six full-length films.

**Translation on your terms**
A local Qwen3 model by default — free and offline — or any OpenAI-compatible API (billed by the provider). A glossary keeps names consistent across a whole season.

**An editor with video preview**
Fix text, adjust timing, insert, delete, merge, undo, autosave. Click any line to hear exactly how it was said — HEVC and DTS files preview too. The subtitle overlay reflects your edits live.

**Quality report**
Every file gets a health check: missed passages, overlong lines, unreadable speed, missing or half-done translations — it tells you exactly where to look.

**Batch**
Drop in a folder. Every file follows the shared settings; override the subtitle track, audio track or engine only where needed.

**Never redo work**
Recognition and translation are cached separately: re-export or retry in seconds; change the model or glossary and it retranslates strictly, never mixing old output in.

**Privacy**
No account, no analytics, no server. Video files are never uploaded. Only when you configure cloud translation yourself is subtitle text sent to the provider you chose.

Requires macOS 12 or later on Apple Silicon. On first launch you'll be guided to download a recognition model (about 1.6–3 GB).

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
