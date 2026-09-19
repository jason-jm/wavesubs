# Homebrew cask，发布在个人 tap 仓库 jason-jm/homebrew-wavesubs 的 Casks/wavesubs.rb（改完这里同步过去）
# 用户安装：brew install --cask jason-jm/wavesubs/wavesubs
# 每次发新版：改 version 与 sha256（release/SHA256SUMS.txt 里 DMG 那行）
cask "wavesubs" do
  version "1.0.8"
  sha256 "abc6ec24c51631736dae84a8db8dacec49e7ecd0f026136f606f3f27fe763856"

  url "https://github.com/jason-jm/wavesubs/releases/download/v#{version}/Wave.Subs-#{version}-arm64.dmg"
  name "Wave Subs"
  desc "Generate SRT/ASS subtitles from any video with local AI and auto-translate them"
  homepage "https://wavesubs.com/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on arch: :arm64
  depends_on macos: :monterey

  app "Wave Subs.app"

  zap trash: [
    "~/Library/Application Support/wavesubs",
    "~/Library/Preferences/com.wavesubs.desktop.plist",
    "~/Library/Saved Application State/com.wavesubs.desktop.savedState",
  ]
end
