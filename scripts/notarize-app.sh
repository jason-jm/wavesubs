#!/bin/bash
# 断点续做：electron-builder 签完名但公证那步失败时，不用重打——
# 直接公证 release/mac-arm64 里的 .app、装订，再用 --prepackaged 出 DMG/ZIP，最后公证 DMG。
set -euo pipefail
PROFILE="${APPLE_KEYCHAIN_PROFILE:-WAVESUBS_NOTARY}"

# 公证上传对网络抖动很敏感（connectTimeout 见过不止一次），失败就隔 30 秒再试，最多 3 次
submit_with_retry() {
  local n
  for n in 1 2 3; do
    if xcrun notarytool submit "$1" --keychain-profile "$PROFILE" --wait; then return 0; fi
    echo "第 $n 次提交失败，30 秒后重试…"; sleep 30
  done
  return 1
}
APP="release/mac-arm64/Wave Subs.app"
ZIP="$(mktemp -d)/WaveSubs-notarize.zip"
echo "打包提交 $APP"
ditto -c -k --keepParent "$APP" "$ZIP"
submit_with_retry "$ZIP"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
spctl -a -t exec -vv "$APP" 2>&1 | tail -2
# identity=null：绝不能让 electron-builder 重签，重签会作废刚装订的票据
# --prepackaged 要指向 .app 本身；指向父目录会把整个文件夹当 App 塞进 DMG
npx electron-builder --mac --arm64 --prepackaged "$APP" -c.mac.identity=null -c.mac.notarize=false
bash scripts/notarize-dmg.sh
