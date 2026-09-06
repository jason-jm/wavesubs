# Homebrew Cask（个人 tap 用：仓库 jason-jm/homebrew-tap，文件放 Casks/wavesubs.rb）
# 用户安装：brew tap jason-jm/tap && brew install --cask wavesubs
# 每次发新版：改 version 与 sha256（release/SHA256SUMS.txt 里 DMG 那行）
cask "wavesubs" do
  version "1.0.0"
  sha256 "ff1bb41ec51397fa1b7f3fcf1c4fa61f139a7664db2ca333d742fb23e8f82efc"

  url "https://github.com/jason-jm/wavesubs/releases/download/v#{version}/Wave.Subs-#{version}-arm64.dmg"
  name "Wave Subs"
  desc "Local-first video subtitles: Whisper transcription, timing refinement, translation, editor"
  homepage "https://jason-jm.github.io/wavesubs/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on arch: :arm64
  depends_on macos: ">= :monterey"

  app "Wave Subs.app"

  zap trash: [
    "~/Library/Application Support/wavesubs",
    "~/Library/Preferences/com.wavesubs.desktop.plist",
    "~/Library/Saved Application State/com.wavesubs.desktop.savedState",
  ]
end
