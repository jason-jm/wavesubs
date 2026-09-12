#!/bin/bash
# 开发态编译随包的原生小工具（目前只有 macOS 的 vision-ocr）。打包时 bundle-deps.ts 会另编一份进 vendor/bin。
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname)" != "Darwin" ]; then echo "vision-ocr 只有 macOS 版，跳过"; exit 0; fi
mkdir -p native/vision-ocr/build
xcrun swiftc -O -o native/vision-ocr/build/vision-ocr native/vision-ocr/vision-ocr.swift
echo "已编译 native/vision-ocr/build/vision-ocr"
