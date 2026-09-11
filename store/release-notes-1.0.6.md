## Wave Subs 1.0.6

**模型下载（中国大陆根治）**
- hf-mirror.com 已不再代理文件，只是跳回 huggingface.co，所以之前的"镜像"在大陆实际上下不了。现在全部模型都能从 ModelScope（魔搭，阿里云 CDN）下载：whisper 六个模型用两个与官方逐字节一致的镜像仓，Qwen 用官方仓；系统语言为简体中文或时区在中国时 ModelScope 排第一位，其它地区仍先走 huggingface.co
- 下载完成后核对 sha256，不一致就删掉重来，不会把来路不明的文件当模型用
- Silero VAD 模型随安装包自带，时间校正不再依赖联网下载
- 下载失败提示改为"所有下载来源都连不上"，并列出可复制的各来源地址，可用浏览器或下载工具自行下载后放进模型文件夹

**Model downloads (fix for mainland China)**
- hf-mirror.com no longer proxies files (it just redirects back to huggingface.co), so the "mirror" added in 1.0.3 never worked there. Every model can now be downloaded from ModelScope (Alibaba Cloud CDN): the six whisper models from two mirror repos verified byte-for-byte against the official files, Qwen from its official repo. ModelScope is tried first when the system language is Simplified Chinese or the time zone is in China; elsewhere huggingface.co stays first
- Downloads are verified against their sha256 after completion; a mismatch is deleted and retried, so a tampered file is never used as a model
- The Silero VAD model now ships inside the app, so timing refinement no longer depends on a download
- A failed download says "none of the download sources could be reached" and lists every source URL with copy buttons; fetch the file with a browser or download manager and drop it into the model folder

---

**下载 / Downloads**

| | 文件 / File | 说明 / Notes |
|---|---|---|
| macOS | `Wave.Subs-1.0.6-arm64.dmg` | Apple Silicon，已公证 / notarized |
| macOS | `Wave.Subs-1.0.6-arm64-mac.zip` | 同上，ZIP / same, as ZIP |
| Windows | `Wave.Subs.Setup.1.0.6.exe` | x64 安装程序（未签名，SmartScreen 提示时点「更多信息 → 仍要运行」）/ x64 installer, not yet code-signed |
| Windows | `Wave.Subs-1.0.6-win.zip` | 便携版 / portable |

校验值见 `SHA256SUMS.txt`。包管理器 / package managers: `brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`
