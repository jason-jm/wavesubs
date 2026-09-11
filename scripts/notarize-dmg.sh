#!/bin/bash
# 给 electron-builder 产出的 DMG 补签名 + 公证 + 装订。
# electron-builder 只公证并装订 .app；DMG 本身不签不装订的话，离线环境下 Gatekeeper
# 无法验证下载的镜像，spctl 会报 "no usable signature"。里面的 App 已经公证过，
# 这次提交 Apple 通常几分钟就过。
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
# electron-builder 公证失败时曾以退出码 0 结束，链条会带着未公证的 App 走到这里——先验票据
xcrun stapler validate "$APP" >/dev/null 2>&1 || { echo "App 没有公证票据，先跑 bash scripts/notarize-app.sh"; exit 1; }
DMG="$(ls -t release/*.dmg | head -1)"
IDENTITY="$(security find-identity -v -p codesigning | grep 'Developer ID Application' | head -1 | awk '{print $2}')"
[ -n "$IDENTITY" ] || { echo "钥匙串里没有 Developer ID Application 身份"; exit 1; }
echo "签名 ${DMG}（${IDENTITY}）"
codesign --force --sign "$IDENTITY" --timestamp "$DMG"
echo "提交公证…"
submit_with_retry "$DMG"
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl -a -t open --context context:primary-signature -vv "$DMG" 2>&1 | tail -2
