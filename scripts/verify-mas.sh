#!/bin/bash
# App Store 包的自检：签名身份、沙盒 entitlements、描述文件、Helper 与随包二进制的继承 entitlements。
# 本机 Gatekeeper 不会接受商店签名的包（那是商店的事），所以这里不做 spctl。
set -u
PKG="$(ls -t release/*.pkg 2>/dev/null | head -1)"
[ -n "$PKG" ] || { echo "release/ 里没有 .pkg"; exit 1; }
fail=0; ok() { echo "  ✓ $1"; }; bad() { echo "  ✗ $1"; fail=1; }

echo "pkg：$(basename "$PKG")"
sig=$(pkgutil --check-signature "$PKG" 2>&1)
grep -q "3rd Party Mac Developer Installer" <<<"$sig" && ok "pkg 由 Mac Installer Distribution 证书签名" || bad "pkg 签名不对：$(echo "$sig" | head -3 | tr '\n' ' ')"

T=$(mktemp -d)
pkgutil --expand-full "$PKG" "$T/x" >/dev/null 2>&1
APP=$(find "$T/x" -maxdepth 3 -name "Wave Subs.app" -type d | head -1)
[ -n "$APP" ] && ok "pkg 内含 Wave Subs.app" || { bad "pkg 里找不到 Wave Subs.app"; rm -rf "$T"; exit 1; }

echo "App："
info=$(codesign -dvvv "$APP" 2>&1)
grep -q "^Authority=Apple Distribution" <<<"$info" && ok "Apple Distribution 签名" || bad "签名身份不是 Apple Distribution"
ent=$(codesign -d --entitlements :- "$APP" 2>/dev/null)
for k in com.apple.security.app-sandbox com.apple.security.network.client com.apple.security.network.server \
         com.apple.security.files.user-selected.read-write com.apple.security.assets.movies.read-write \
         com.apple.security.cs.allow-jit com.apple.security.application-groups com.apple.application-identifier com.apple.developer.team-identifier; do
  grep -q "$k" <<<"$ent" && ok "entitlement $k" || bad "缺 entitlement $k"
done
grep -q "TZ7V6PMGV6.com.wavesubs.desktop" <<<"$ent" && ok "application-groups = TZ7V6PMGV6.com.wavesubs.desktop" || bad "application-groups 值不对"
grep -q "disable-library-validation\|allow-dyld-environment" <<<"$ent" && bad "残留 Developer ID 版才允许的 entitlement" || ok "无 Developer ID 版专用 entitlement"
[ -f "$APP/Contents/embedded.provisionprofile" ] && ok "内嵌描述文件" || bad "缺 embedded.provisionprofile"
/usr/libexec/PlistBuddy -c "Print :ElectronTeamID" "$APP/Contents/Info.plist" 2>/dev/null | grep -q TZ7V6PMGV6 && ok "Info.plist ElectronTeamID" || bad "Info.plist 缺 ElectronTeamID"

echo "Helper 与随包二进制（必须继承沙盒）："
for h in "$APP"/Contents/Frameworks/*Helper*.app "$APP"/Contents/Resources/vendor/bin/*; do
  e=$(codesign -d --entitlements :- "$h" 2>/dev/null)
  n=$(basename "$h")
  if grep -q "com.apple.security.inherit" <<<"$e" && grep -q "com.apple.security.app-sandbox" <<<"$e"; then ok "$n"; else bad "$n 缺 inherit/app-sandbox"; fi
done
codesign --verify --deep --strict "$APP" 2>&1 | grep -q "" && ok "codesign --deep --strict 通过" || bad "深度校验失败"
rm -rf "$T"
exit $fail
