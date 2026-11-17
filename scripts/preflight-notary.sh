#!/bin/bash
# 发布前 3 秒预检：公证凭据现在能不能用。钥匙串锁定或 profile 丢失时，电子构建会在签完名、
# 等了十几分钟之后才在公证那步炸——这里先炸，省下那十几分钟。
set -euo pipefail
PROFILE="${APPLE_KEYCHAIN_PROFILE:-WAVESUBS_NOTARY}"
if ! xcrun notarytool history --keychain-profile "$PROFILE" >/dev/null; then
  echo "Apple 公证预检失败。请根据上方 Apple 返回的具体原因处理后重试。" >&2
  exit 1
fi
echo "公证凭据可用（${PROFILE}）"
