## Wave Subs 1.0.3

**模型下载在中国大陆可用了**
- huggingface.co 连不上时自动切换到镜像 hf-mirror.com，成功一次后后续文件直接走镜像
- 下载改走系统网络栈，认系统代理设置；两边都失败时给出明确提示，不再是 "TypeError: fetch failed"

**其它**
- 界面语言检测更稳：修复部分 Windows 上中文系统显示英文的问题
- 官网：Windows 访客现在高亮并优先显示 Windows 版下载；下载区注明 SmartScreen 提示的处理方法

**Model downloads now work from mainland China**
- Falls back to the hf-mirror.com mirror automatically when huggingface.co is unreachable, and keeps using the mirror once it succeeded
- Downloads go through the system network stack and honour system proxy settings; a clear message replaces "TypeError: fetch failed" when neither host is reachable

**Also**
- More robust interface-language detection (fixes some Windows setups showing English on a Chinese system)
- Website: Windows visitors now get the Windows download highlighted first; the SmartScreen "More info → Run anyway" step is explained under the download

---

**下载 / Downloads**

| | 文件 / File | 说明 / Notes |
|---|---|---|
| macOS | `Wave.Subs-1.0.3-arm64.dmg` | Apple Silicon，已公证 / notarized |
| macOS | `Wave.Subs-1.0.3-arm64-mac.zip` | 同上，ZIP / same, as ZIP |
| Windows | `Wave.Subs.Setup.1.0.3.exe` | x64 安装程序（未签名，SmartScreen 提示时点「更多信息 → 仍要运行」）/ x64 installer, not yet code-signed |
| Windows | `Wave.Subs-1.0.3-win.zip` | 便携版 / portable |

校验值见 `SHA256SUMS.txt`。包管理器 / package managers: `brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`
