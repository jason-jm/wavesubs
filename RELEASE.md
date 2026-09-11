# 发布流程

两个平台：macOS（Apple Silicon，DMG）与 Windows（x64，NSIS 安装包 + ZIP）。

## 一次性准备

### 1. 安装 Developer ID 证书

已装好两张，名字相同 `Developer ID Application: Jiesi Ma (TZ7V6PMGV6)`，Team ID **TZ7V6PMGV6**：

| 哈希 | 签发者 | 到期 | 用途 |
|---|---|---|---|
| `19C4D60E…` | G2 中间证书 | **2031-09-06** | **发布用这张** |
| `ED957324…` | 第一代中间证书 | 2027-02-01 | Xcode 一键签发的短命版，只签过首次公证验证 |

**同名证书并存时 `codesign --sign "<名字>"` 会报 ambiguous**，electron-builder 自动选身份也不可靠。
首次发布验证完成后把旧的从本机钥匙串删掉（只删本地，**不要在 Apple 后台吊销**——吊销会让它签过的一切失效）：

```bash
security delete-identity -Z ED957324537B891150F011D4CC62893DC85BB2CC ~/Library/Keychains/login.keychain-db
```

两个踩过的坑：

- **Xcode 里一键签发的 Developer ID 证书走的是第一代中间证书，只到 2027-02-01**。要五年版必须在
  developer.apple.com 网页上用 CSR 申请（CSR 用 openssl 生成、私钥 `security import -T /usr/bin/codesign`
  进登录钥匙串即可，不必用钥匙串访问的向导）。
- **网页签发的 G2 证书装好后 `find-identity -v` 不认（"Matching" 有、"Valid" 没有）**，原因是本机没有
  G2 中间证书。不用下载：任何一个 G2 签名的第三方应用里都嵌着它，
  `codesign -d --extract-certificates <app>` 取出 `codesign1` 再 `security import` 即可
  （Apple 官方指纹 `5B45F61068B29FCC8FFFF1A7E99B78DA9E9C4635`）。

换机器时在钥匙串访问里把 G2 那张导出为 `.p12`（含私钥）再导入。

### 2. 存公证凭据

需要 Apple ID、**App 专用密码**（在 appleid.apple.com 生成，不是登录密码）、Team ID：

```bash
xcrun notarytool store-credentials "WAVESUBS_NOTARY" --apple-id "<你的 Apple ID>" --team-id "TZ7V6PMGV6" --password "<App 专用密码>"
```

验证凭据可用（返回空列表而不是报错即可）：

```bash
xcrun notarytool history --keychain-profile "WAVESUBS_NOTARY"
```

electron-builder（当前 26.15）能直接读这个钥匙串 profile，密码不需要进环境变量——
发布命令前加 `APPLE_KEYCHAIN_PROFILE=WAVESUBS_NOTARY` 即可（见下）。

### 3. 编译随包 ffmpeg（只需一次，除非升级版本）

```bash
~/Documents/Wave Subs/vendor/build-ffmpeg.sh
```

产出最小 LGPL 版本。**不要**改用 Homebrew 的 ffmpeg——那是 GPL v3，随闭源应用分发会违规。

## 每次发布

```bash
npm run check-i18n && npm run check-css && npm run check-batch && npm run check-cache && npm run check-glossary && npm run check-qc && npm run check-editor && npm run check-preview && npm run check-output && npm run typecheck
APPLE_KEYCHAIN_PROFILE=WAVESUBS_NOTARY npm run release
```

`npm run release` 会依次：编译 → `scripts/bundle-deps.ts` 打包随附二进制并自检依赖 →
electron-builder 签名（Hardened Runtime + entitlements）、公证、装订 .app、产出 DMG 与 ZIP →
`scripts/notarize-dmg.sh` 给 DMG 补签名、公证、装订（electron-builder 不管 DMG，
不补这步 DMG 本身 `spctl` 会报 "no usable signature"）。

产物在 `release/`。

公证那步失败（典型报错 `No Keychain password item found`，钥匙串瞬时不可读）时**不用重打**：
`bash scripts/notarize-app.sh` 会公证并装订已签好的 .app，再用 `--prepackaged` 出 DMG/ZIP 并公证 DMG。

## 发布前必查

```bash
# 1. 签名与公证是否都成型
codesign -dv --verbose=4 "release/mac-arm64/Wave Subs.app" 2>&1 | grep -E "Authority|TeamIdentifier|flags"
#    Authority 应是 Developer ID Application，flags 应含 runtime

# 2. 公证是否已装订到 App 上（这步过不了，用户下载后仍会被拦）
xcrun stapler validate "release/mac-arm64/Wave Subs.app"

# 3. Gatekeeper 实测：模拟"从网上下载"再打开
xattr -w com.apple.quarantine "0081;00000000;Safari;" "release/Wave Subs-1.0.0-arm64.dmg"
spctl -a -vvv -t install "release/Wave Subs-1.0.0-arm64.dmg"
#    应输出 accepted / source=Notarized Developer ID

# 4. 随包二进制没有指向 Homebrew 的残留（bundle-deps 已自检，这里再确认一次）
for f in "release/mac-arm64/Wave Subs.app/Contents/Resources/vendor/bin/"*; do
  otool -L "$f" | grep -q "/opt/homebrew" && echo "✗ $f 仍依赖 Homebrew"
done
```

**最关键的一步**：在一台**没装 Homebrew、也没装过 Wave Subs** 的 Mac 上，
从浏览器下载 DMG、双击、拖进「应用程序」、打开、跑通一次完整转换。
本机测试永远发现不了"忘了打包某个依赖"——因为本机什么都有。

## 官网下载页要写清楚的

- 系统要求：macOS 12 或更高，**Apple Silicon**（目前不含 Intel 版）
- 安装包体积与应用体积（含随附二进制约 320MB）
- 语音识别与翻译模型需在应用内按需下载（large-v3 约 3GB）
- 默认全部本地运行、不上传任何内容；仅在用户主动配置云端翻译时才会把**字幕文本**
  发给所选服务商
- 链接到 [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md)（LGPL 义务要求可获取）

## Windows 版

### 依赖准备（升级依赖版本时才需要重跑）

Windows 不自己编译，直接用官方预编译包。两种来源：

- **本机发版**：手动下载到 `~/Documents/Wave Subs/vendor/win/`（文件名见下表），`npm run release:win` 会用它们。
- **GitHub Actions**（`.github/workflows/windows.yml`，推 `v*` 标签或手动触发）：`tsx scripts/bundle-deps-win.ts --fetch`
  按脚本里钉死的官方地址下载并校验 sha256（当前：BtbN ffmpeg n9.0.1 LGPL shared、whisper.cpp v1.9.1、llama.cpp b10865）。
  升级依赖时改脚本里的 `url` / `sha256`（sha256 可从 GitHub Release 资产的 digest 字段取）。
  这条流水线是申请 SignPath 开源代码签名的前置条件：签名的二进制必须来自公开可复核的构建。

手动下载时的文件名：

| 文件 | 来源 |
|---|---|
| `ffmpeg-win.zip` | BtbN 的 `ffmpeg-master-latest-win64-lgpl-**shared**.zip` |
| `whisper-win.zip` | whisper.cpp release `v1.9.1` 的 `whisper-blas-bin-x64.zip`（CPU；上游 Windows 只提供 CUDA 版 GPU 包，677MB，暂不随包） |
| `llama-win.zip` | llama.cpp release 的 `llama-*-bin-win-vulkan-x64.zip`（自带 CPU 后端，无 Vulkan 设备时自动回落） |

**ffmpeg 必须拿 lgpl 而不是 gpl 版本**，理由和 macOS 一样。
`scripts/bundle-deps-win.ts` 会在打包时校验这一点，拿错会直接失败。
用 shared 而非静态版是因为静态版 ffmpeg.exe 与 ffprobe.exe 各内嵌一整套编解码器，
两个加起来 220MB，shared 版共用 DLL 只要 129MB。

### 构建

```bash
npm run release:win
```

可以在 macOS 上交叉构建，NSIS 与 ZIP 都能产出，不需要 Wine。

### Windows 版特有的注意点

- **whisper 与 llama 的 ggml DLL 必须分目录**。两边带的是同名不同版本的
  `ggml.dll` / `ggml-base.dll`，而 Windows 找 DLL 以 exe 所在目录优先，
  平铺在一起会串版本。`tools.ts` 因此注册三个查找目录而不是一个。
- **代码签名**用 Authenticode（EV 或 OV 证书），与 macOS 的 Developer ID 是两套东西。
  没有证书时 SmartScreen 会对新发布的程序显示「未知发布者」警告，
  需要靠下载量累积信誉，或买 EV 证书直接获得信任。
- 目前只出 x64。ARM64 版 Windows 需要另一套预编译依赖。

### 必须在真实 Windows 上验证的

macOS 上做不了、只能到 Windows 机器上确认：

1. `ggml-cpu-*.dll` 能否被正确按 CPU 型号加载（whisper 与 llama 都是运行时 dlopen）
2. 含中文、空格的路径能否正常处理（视频路径会原样传给 ffmpeg）
3. 首次运行 SmartScreen 的实际表现
4. 完整跑通一次：导入视频 → 识别 → 翻译 → 导出

## 尚未做、发布后值得补

- macOS 的 Intel（x64）与 Universal 包
- Windows ARM64
- 自动更新（electron-updater + 更新源）
- 崩溃上报

## Mac App Store 版

与官网版同一份代码，差别只在打包：`mas` 目标 + 沙盒 entitlements（`build/entitlements.mas.plist`
与 `.inherit.plist`），签名用 *Apple Distribution* 证书，产物是 `.pkg`，不走公证走 App Review。

```bash
npm run release:mas        # 需要 build/WaveSubs_MAS.provisionprofile 与 Apple Distribution 证书
```

沙盒对行为的唯一影响：应用只拿到用户拖入/选中的文件本身的访问权，写不了视频旁边的字幕文件时，
`core/output.ts` 会把成品落到 `~/Movies/Wave Subs`（entitlement `assets.movies.read-write`），
界面显示真实路径。拖入整个文件夹则原地写入。

后台准备步骤、商店文案、隐私问卷、审核备注全部在 `store/app-store-metadata.md`。
截图用 `docs/assets/shots/*.png`（2880×1800）。

**随包 ffmpeg 是 LGPL**，与 App Store 条款的兼容性存在争议（用户已知悉并选择保留）。
