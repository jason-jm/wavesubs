#!/bin/bash
# Build the arm64 tools used by bundle-deps. Cache sources and objects outside the app checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
vendor_src=${WAVESUBS_VENDOR_SRC:-"$root/../vendor"}
mkdir -p "$vendor_src"
vendor_src=$(cd "$vendor_src" && pwd)
MACOSX_DEPLOYMENT_TARGET=$(node -p "require('./package.json').build.mac.minimumSystemVersion")
export MACOSX_DEPLOYMENT_TARGET
build="$vendor_src/build-macos-arm64-$MACOSX_DEPLOYMENT_TARGET"
jobs=${JOBS:-$(getconf _NPROCESSORS_ONLN)}
mkdir -p "$build"

build_ffmpeg() {
  local version=8.1.1
  local archive="$vendor_src/ffmpeg-$version.tar.xz"
  local sha256=b6863adde98898f42602017462871b5f6333e65aec803fdd7a6308639c52edf3
  if [[ ! -f "$archive" ]]; then
    local download
    download=$(mktemp "$archive.XXXXXX")
    if ! curl --fail --location --output "$download" "https://ffmpeg.org/releases/ffmpeg-$version.tar.xz" ||
       ! echo "$sha256  $download" | shasum -a 256 -c -; then
      rm -f "$download"
      return 1
    fi
    mv "$download" "$archive"
  fi
  echo "$sha256  $archive" | shasum -a 256 -c -
  # FFmpeg's makefiles require an in-tree build when the source path contains spaces.
  if [[ ! -f "$build/ffmpeg-$version/configure" ]]; then tar -xf "$archive" -C "$build"; fi
  (
    cd "$build/ffmpeg-$version"
    local target="-target arm64-apple-macos$MACOSX_DEPLOYMENT_TARGET"
    ./configure --cc=clang --cxx=clang++ --arch=arm64 --cpu=apple-m1 \
      --extra-cflags="$target" --extra-objcflags="$target" --extra-ldflags="$target" \
      --disable-shared --enable-static --disable-programs --enable-ffmpeg --enable-ffprobe \
      --disable-doc --disable-network --disable-debug --disable-nonfree \
      --disable-indev=avfoundation --enable-audiotoolbox --enable-videotoolbox
    make -j"$jobs" ffmpeg ffprobe
    mkdir -p "$vendor_src/ffmpeg-lgpl/bin"
    install -m 755 ffmpeg ffprobe "$vendor_src/ffmpeg-lgpl/bin/"
  )
}

build_ggml_tool() {
  local repo=$1 revision=$2
  shift 2
  local src="$vendor_src/$repo" obj="$build/$repo"
  if [[ ! -e "$src" ]]; then
    git init -q "$src"
  fi
  if [[ -d "$src/.git" ]] && ! git -C "$src" rev-parse --verify HEAD >/dev/null 2>&1; then
    git -C "$src" fetch --depth 1 "https://github.com/ggml-org/$repo.git" "$revision"
    git -C "$src" checkout -q --detach FETCH_HEAD
  fi
  if [[ $(git -C "$src" rev-parse HEAD) != "$revision" ]]; then
    echo "$src: expected $revision. Set WAVESUBS_VENDOR_SRC to use a separate source directory." >&2
    return 1
  fi
  local options=()
  if [[ "$repo" == whisper.cpp ]]; then
    options=(-DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF)
  else
    # The app connects to llama-server over HTTP on loopback.
    options=(-DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_TESTS=OFF -DLLAMA_OPENSSL=OFF
             -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF)
  fi
  # Upstream selects the macOS 13.3 ILP64 BLAS ABI. Use Accelerate's original CBLAS
  # declarations so both the CPU and Metal builds can load on Monterey.
  local blas_flags="-UACCELERATE_NEW_LAPACK -UACCELERATE_LAPACK_ILP64"
  cmake -S "$src" -B "$obj" -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET="$MACOSX_DEPLOYMENT_TARGET" \
    -DBUILD_SHARED_LIBS=OFF -DGGML_BACKEND_DL=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
    -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DGGML_BLAS=ON -DGGML_BLAS_VENDOR=Apple \
    -DCMAKE_C_FLAGS="$blas_flags" -DCMAKE_CXX_FLAGS="$blas_flags" "${options[@]}"
  cmake --build "$obj" --parallel "$jobs" --target "$@"
  mkdir -p "$vendor_src/ggml-tools"
  local tool
  for tool in "$@"; do install -m 755 "$obj/bin/$tool" "$vendor_src/ggml-tools/$tool"; done
}

case ${1:-all} in
  ffmpeg) build_ffmpeg ;;
  ggml|all)
    if [[ ${1:-all} == all ]]; then build_ffmpeg; fi
    build_ggml_tool whisper.cpp f049fff95a089aa9969deb009cdd4892b3e74916 whisper-cli whisper-vad-speech-segments
    build_ggml_tool llama.cpp ccc8fd2baa64ab26c7210b02765d3604069ec7ee llama-server
    ;;
  *) echo "Usage: $0 [all|ffmpeg|ggml]" >&2; exit 2 ;;
esac
