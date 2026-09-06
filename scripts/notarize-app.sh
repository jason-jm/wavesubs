#!/bin/bash
# 断点续做：electron-builder 签完名但公证那步失败时，不用重打——
# 直接公证 release/mac-arm64 里的 .app、装订，再用 --prepackaged 出 DMG/ZIP，最后公证 DMG。
set -euo pipefail
PROFILE="${APPLE_KEYCHAIN_PROFILE:-WAVESUBS_NOTARY}"
APP="release/mac-arm64/Wave Subs.app"
ZIP="$(mktemp -d)/WaveSubs-notarize.zip"
echo "打包提交 $APP"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
spctl -a -t exec -vv "$APP" 2>&1 | tail -2
# identity=null：绝不能让 electron-builder 重签，重签会作废刚装订的票据
npx electron-builder --mac --arm64 --prepackaged release/mac-arm64 -c.mac.identity=null -c.mac.notarize=false
bash scripts/notarize-dmg.sh
