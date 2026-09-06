#!/bin/bash
# 发布前最后一道：四项验证 + 校验值。任何一项不过就非零退出，别把半成品传上去。
set -u
APP="release/mac-arm64/Wave Subs.app"
DMG="$(ls -t release/*.dmg 2>/dev/null | head -1)"
fail=0
ok()  { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; fail=1; }

echo "App："
# codesign 的信息走 stderr；先攒进变量再 grep，避免 grep -q 提前退出给 codesign 一个 SIGPIPE
info=$(codesign -dvvv "$APP" 2>&1)
grep -q "^Authority=Developer ID Application" <<<"$info" && ok "Developer ID 签名" || bad "签名不是 Developer ID"
grep -q "flags=.*runtime" <<<"$info" && ok "Hardened Runtime" || bad "缺 runtime 标志"
xcrun stapler validate "$APP" >/dev/null 2>&1 && ok "公证票据已装订" || bad "没有公证票据"
spctl -a -t exec "$APP" >/dev/null 2>&1 && ok "Gatekeeper 接受（模拟下载）" || bad "Gatekeeper 拒绝"
residue=0; for b in "$APP"/Contents/Resources/vendor/bin/*; do residue=$((residue + $(otool -L "$b" 2>/dev/null | grep -c "/opt/homebrew\|/usr/local"))); done
[ "$residue" -eq 0 ] && ok "随包二进制无 Homebrew 残留" || bad "随包二进制引用了 Homebrew 路径 ($residue)"

echo "DMG："
[ -n "$DMG" ] || { bad "没有 DMG"; DMG=/dev/null; }
xcrun stapler validate "$DMG" >/dev/null 2>&1 && ok "DMG 票据已装订" || bad "DMG 没有票据"
spctl -a -t open --context context:primary-signature "$DMG" >/dev/null 2>&1 && ok "DMG Gatekeeper 接受" || bad "DMG Gatekeeper 拒绝"
# DMG 里的 App 必须就是 release/mac-arm64 里这份（同一 cdhash）
mnt=$(hdiutil attach -nobrowse -readonly "$DMG" 2>/dev/null | grep -o "/Volumes/.*" | head -1)
if [ -n "$mnt" ]; then
  [ -d "$mnt/Wave Subs.app" ] || bad "DMG 根目录里没有 Wave Subs.app（内容：$(ls "$mnt" | tr "\n" " ")）"
  inner=$(codesign -dvvv "$mnt/Wave Subs.app" 2>&1 | grep -o "CDHash=[0-9a-f]*")
  outer=$(grep -o "CDHash=[0-9a-f]*" <<<"$info")
  [ -n "$inner" ] && [ "$inner" = "$outer" ] && ok "DMG 内 App 与已验证的 App 一致" || bad "DMG 内 App 与外面的不一致（${inner:-读不到} vs ${outer:-读不到}）"
  hdiutil detach "$mnt" -quiet 2>/dev/null
fi

echo "产物与校验值："
(cd release && shasum -a 256 *.dmg *mac.zip *.exe *win.zip 2>/dev/null) | tee release/SHA256SUMS.txt | sed 's/^/  /'
exit $fail
