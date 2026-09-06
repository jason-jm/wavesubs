## Wave Subs 1.0.2

**反馈更方便了**
- 「帮助」菜单和「设置 → 关于」里可以直接打开官网反馈表单（不用注册账号）和 GitHub 讨论区；App Store 版还能一键去 App Store 评价
- 应用菜单改为自建，替换掉 Electron 默认那套指向 Electron 文档的「帮助」菜单；菜单文案跟随界面语言（32 种）
- 「关于」里显示真实版本号（之前写死为 0.1.0）
- 应用只允许打开官网、仓库与 App Store 评价链接，其它外部地址一律拒绝

**Feedback made easy**
- The Help menu and Settings → About now open the website feedback form (no account needed) and GitHub Discussions; the App Store build can also jump straight to "Rate on the App Store"
- The app now builds its own menu instead of Electron's default Help menu, which pointed at Electron's own docs; menu labels follow the interface language (32 languages)
- About shows the real version number (it was hard-coded to 0.1.0)
- The app only opens its own website, repository and App Store review links; any other external URL is refused

---

**下载 / Downloads**

| | 文件 / File | 说明 / Notes |
|---|---|---|
| macOS | `Wave.Subs-1.0.2-arm64.dmg` | Apple Silicon，已公证 / notarized |
| macOS | `Wave.Subs-1.0.2-arm64-mac.zip` | 同上，ZIP / same, as ZIP |
| Windows | `Wave.Subs.Setup.1.0.2.exe` | x64 安装程序（暂未签名，SmartScreen 会提示「更多信息 → 仍要运行」）/ x64 installer, not yet code-signed |
| Windows | `Wave.Subs-1.0.2-win.zip` | 便携版 / portable |

校验值见 `SHA256SUMS.txt`。也可以用包管理器：`brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`

Checksums in `SHA256SUMS.txt`. Package managers: `brew install --cask jason-jm/wavesubs/wavesubs` · `scoop bucket add wavesubs https://github.com/jason-jm/scoop-wavesubs && scoop install wavesubs`
