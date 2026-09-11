#!/bin/bash
# 发布前 3 秒预检：公证凭据现在能不能用。钥匙串锁定或 profile 丢失时，电子构建会在签完名、
# 等了十几分钟之后才在公证那步炸——这里先炸，省下那十几分钟。
set -euo pipefail
PROFILE="${APPLE_KEYCHAIN_PROFILE:-WAVESUBS_NOTARY}"
if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null 2>&1; then
  echo "公证凭据 profile「${PROFILE}」现在读不到（钥匙串锁定？被撤销？）。"
  echo "重新存一次：xcrun notarytool store-credentials \"$PROFILE\" --apple-id <Apple ID> --team-id TZ7V6PMGV6"
  exit 1
fi
echo "公证凭据可用（${PROFILE}）"
