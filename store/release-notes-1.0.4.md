## Wave Subs 1.0.4

**下载体验**
- 点击下载后先显示「正在连接服务器…」，不再对着 0% 干等
- 官方源 3 秒没回应就并行连镜像，谁先回应用谁；赢过的来源记住并落盘，之后的下载和重启后都直接走它

**Windows**
- 界面语言优先读取系统「显示语言」设置，修复中文系统显示英文的问题；「设置 → 语言」下方列出系统报告的语言标签，方便对照
- 统一两个平台的窗口结构：顶部一条窗口栏，最小化 / 最大化 / 关闭画在栏里，内容从栏下面开始，不再压在卡片边框上

**Downloads**
- The button now shows "Connecting to server…" first instead of sitting at 0%
- If the official host does not answer within 3 seconds the mirror is tried in parallel and whichever responds first wins; the winning host is remembered on disk for later downloads and launches

**Windows**
- Interface language now follows the Windows "display language" setting first (fixes English UI on Chinese systems); Settings → Language lists the language tags the system reports
- One window layout for both platforms: a top title-bar strip hosts the minimize / maximize / close buttons, and content starts below it instead of colliding with the card border

---

**下载 / Downloads**

| | 文件 / File | 说明 / Notes |
|---|---|---|
| macOS | `Wave.Subs-1.0.4-arm64.dmg` | Apple Silicon，已公证 / notarized |
| macOS | `Wave.Subs-1.0.4-arm64-mac.zip` | 同上，ZIP / same, as ZIP |
| Windows | `Wave.Subs.Setup.1.0.4.exe` | x64 安装程序（未签名，SmartScreen 提示时点「更多信息 → 仍要运行」）/ x64 installer, not yet code-signed |
| Windows | `Wave.Subs-1.0.4-win.zip` | 便携版 / portable |

校验值见 `SHA256SUMS.txt`。包管理器 / package managers: `brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`
