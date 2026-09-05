# 第三方组件与许可证

Wave Subs 随安装包分发下列第三方软件。本文件是分发这些组件的**许可证义务的一部分**，
必须随应用一起提供（安装包内位于 `Contents/Resources/`，官网下载页也应可访问）。

## FFmpeg —— LGPL v2.1 或更高

- 版本：**8.1.1**
- 用途：解码音轨为 PCM、抽取内嵌字幕轨、识别容器与轨道信息。**从不用于编码视频。**
- 分发形式：独立可执行文件（`ffmpeg` / `ffprobe`），由 Wave Subs 以子进程方式调用，
  未静态或动态链接进 Wave Subs 自身。

**这是我们自行编译的最小 LGPL 版本，不是 Homebrew 的默认版本。** Homebrew 的 ffmpeg
带 `--enable-gpl --enable-version3`（含 x264、x265），随闭源应用分发会构成 GPL 违规。
Wave Subs 只解码不编码，那些编码器一个都用不到，因此我们去掉了全部 GPL 组件。

实际 configure 参数：

```
--prefix=<安装目录> --disable-shared --enable-static --disable-programs --enable-ffmpeg --enable-ffprobe --disable-doc --disable-network --disable-debug --enable-audiotoolbox --enable-videotoolbox --disable-nonfree
```

**源码获取**：上述版本的完整源码可从 <https://ffmpeg.org/releases/ffmpeg-8.1.1.tar.xz>
获取。我们未对源码做任何修改，仅使用上面列出的 configure 参数重新编译。
如需我们使用的确切构建脚本，见项目内 `scripts/` 说明或向我们索取。

LGPL v2.1 全文：<https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html>

## whisper.cpp —— MIT

- 版本：1.9.1（`whisper-cli`、`whisper-vad-speech-segments`）
- 用途：本地语音识别、Silero VAD 语音区间检测
- 主页：<https://github.com/ggml-org/whisper.cpp>

## llama.cpp —— MIT

- 版本：b10050（`llama-server`）
- 用途：本地大模型翻译（OpenAI 兼容接口）
- 主页：<https://github.com/ggml-org/llama.cpp>

## ggml —— MIT

whisper.cpp 与 llama.cpp 共用的张量计算库（`libggml`、`libggml-base` 等）。

## OpenSSL 3 —— Apache License 2.0

随 `llama-server` 一同分发（`libssl`、`libcrypto`）。
主页：<https://www.openssl.org/>

## Electron / Chromium / Node.js

Electron 38，采用 MIT 许可；其包含的 Chromium 与 Node.js 各自适用其原有许可证。
完整清单见应用包内 Electron 自带的 `LICENSES.chromium.html`。

## 模型文件（不随安装包分发，由用户在应用内下载）

| 模型 | 许可证 | 来源 |
|---|---|---|
| Whisper（ggml 格式） | MIT | OpenAI / ggml-org |
| Silero VAD | MIT | snakers4/silero-vad |
| Qwen3 系列 GGUF | Apache 2.0 | Qwen 官方 HuggingFace 仓库 |

模型均由用户在「模型」页按需下载，不包含在安装包内。
