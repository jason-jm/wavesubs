$ErrorActionPreference = 'Stop'
$qa = Join-Path $env:RUNNER_TEMP 'wavesubs-qa'
New-Item $qa -ItemType Directory | Out-Null
function Get-VerifiedFile($url, $name, $sha) {
  $file = Join-Path $qa $name
  curl.exe -fsSL --retry 3 --output $file $url
  if ($LASTEXITCODE -ne 0 -or (Get-FileHash $file -Algorithm SHA256).Hash -ne $sha) { throw "Download or SHA-256 failed for $name" }
  return $file
}
$old = Get-VerifiedFile 'https://github.com/jason-jm/wavesubs/releases/download/v1.0.9/Wave.Subs.Setup.1.0.9.exe' 'legacy.exe' 'fb743bdf4829c7cdce666fad9d1c678465a82c31d1679d3a7658a1b46d977685'
$env:WAVESUBS_QA_TINY = Get-VerifiedFile 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin' 'tiny.bin' 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21'
$env:WAVESUBS_QA_LLM = Get-VerifiedFile 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf' 'qwen.gguf' '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db'
$env:WAVESUBS_QA_AUDIO = Get-VerifiedFile 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/f049fff95a089aa9969deb009cdd4892b3e74916/samples/jfk.wav' 'speech.wav' '59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e'
$env:WAVESUBS_QA_LIBRARY = Join-Path $env:LOCALAPPDATA 'WaveSubs QA 模型'
$installDir = Join-Path $qa 'Installed'
function Install-TestPackage($installer) {
  $p = Start-Process -FilePath $installer -ArgumentList '/S',"/D=$installDir" -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "NSIS failed: $($p.ExitCode)" }
}
function Test-Stage($stage, $exe) {
  node scripts/check-packaged.mjs $stage $exe $qa
  if ($LASTEXITCODE -ne 0) { throw "Failed acceptance stage $stage" }
}
$app = Join-Path $installDir 'Wave Subs.exe'
Install-TestPackage $old
Test-Stage 'legacy' $app
$version = (Get-Content package.json | ConvertFrom-Json).version
Install-TestPackage (Resolve-Path "release/Wave Subs Setup $version.exe")
foreach ($stage in 'upgrade','custom','restart','offline') { Test-Stage $stage $app }
$portable = Join-Path $qa 'Portable'
Expand-Archive -LiteralPath "release/Wave Subs-$version-win.zip" -DestinationPath $portable
Test-Stage 'reconnected' (Join-Path $portable 'Wave Subs.exe')
