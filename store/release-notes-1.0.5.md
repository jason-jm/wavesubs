## Wave Subs 1.0.5

**转换过程**
- 可以取消了：单文件的进度卡片和批量队列里正在跑的文件都有「取消」按钮，立刻停掉正在跑的抽音频 / 识别 / 翻译；批量里被取消的文件退回「等待中」，队列继续处理后面的
- 显示预计剩余时间：按当前阶段（识别、翻译）的推进速度估算
- 完成后显示这次识别用的设备，如「Apple M1」「NVIDIA GeForce RTX 3060 (Vulkan)」或「CPU」，一眼看出有没有用上 GPU

**Windows**
- 翻译走 GPU：随包的 llama-server 换成 Vulkan 构建，NVIDIA / AMD / Intel 显卡装有 Vulkan 驱动就用它，没有就自动回落 CPU；语音识别暂时仍在 CPU 上

**模型下载**
- 下载失败时给出具体原因，并列出该模型的全部下载地址供复制：用浏览器或下载工具下好、放进模型文件夹即可使用
- Qwen 翻译模型新增 ModelScope（魔搭）来源，官方源与镜像都连不上时自动尝试

**Conversion**
- Jobs can be cancelled: the progress card and the running item in the batch queue have a Cancel button that stops the audio extraction / recognition / translation immediately; a cancelled batch item goes back to "waiting" and the queue moves on
- Estimated time remaining, extrapolated from the pace of the current stage (recognition, translation)
- The result card shows which device did the recognition, e.g. "Apple M1", "NVIDIA GeForce RTX 3060 (Vulkan)" or "CPU", so you can tell at a glance whether the GPU was used

**Windows**
- Translation on the GPU: the bundled llama-server is now the Vulkan build. NVIDIA / AMD / Intel GPUs with a Vulkan driver are used, otherwise it falls back to the CPU automatically; speech recognition still runs on the CPU for now

**Model downloads**
- A failed download now reports the actual cause and lists every download URL for that model with copy buttons: fetch the file with a browser or download manager and drop it into the model folder
- Qwen translation models gain a ModelScope source, tried automatically when neither the official host nor the mirror is reachable

---

**下载 / Downloads**

| | 文件 / File | 说明 / Notes |
|---|---|---|
| macOS | `Wave.Subs-1.0.5-arm64.dmg` | Apple Silicon，已公证 / notarized |
| macOS | `Wave.Subs-1.0.5-arm64-mac.zip` | 同上，ZIP / same, as ZIP |
| Windows | `Wave.Subs.Setup.1.0.5.exe` | x64 安装程序（未签名，SmartScreen 提示时点「更多信息 → 仍要运行」）/ x64 installer, not yet code-signed |
| Windows | `Wave.Subs-1.0.5-win.zip` | 便携版 / portable |

校验值见 `SHA256SUMS.txt`。包管理器 / package managers: `brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`
