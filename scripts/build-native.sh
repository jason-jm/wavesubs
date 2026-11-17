#!/bin/bash
# Build the same Vision helper for development and packaging.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname)" != "Darwin" ]; then echo "vision-ocr 只有 macOS 版，跳过"; exit 0; fi
out=${1:-native/vision-ocr/build/vision-ocr}
target=$(node -p "require('./package.json').build.mac.minimumSystemVersion")
mkdir -p "$(dirname "$out")"
xcrun --sdk macosx swiftc -O -target "arm64-apple-macosx$target" \
  -o "$out" native/vision-ocr/vision-ocr.swift
echo "Built $out for macOS $target (arm64)"
