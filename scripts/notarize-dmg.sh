#!/bin/bash
# 给 electron-builder 产出的 DMG 补签名 + 公证 + 装订。
# electron-builder 只公证并装订 .app；DMG 本身不签不装订的话，离线环境下 Gatekeeper
# 无法验证下载的镜像，spctl 会报 "no usable signature"。里面的 App 已经公证过，
# 这次提交 Apple 通常几分钟就过。
set -euo pipefail
PROFILE="${APPLE_KEYCHAIN_PROFILE:-WAVESUBS_NOTARY}"
DMG="$(ls -t release/*.dmg | head -1)"
IDENTITY="$(security find-identity -v -p codesigning | grep 'Developer ID Application' | head -1 | awk '{print $2}')"
[ -n "$IDENTITY" ] || { echo "钥匙串里没有 Developer ID Application 身份"; exit 1; }
echo "签名 $DMG（$IDENTITY）"
codesign --force --sign "$IDENTITY" --timestamp "$DMG"
echo "提交公证…"
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl -a -t open --context context:primary-signature -vv "$DMG" 2>&1 | tail -2
