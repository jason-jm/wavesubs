<#
Wave Subs - on-screen text recognition on Windows (Windows.Media.Ocr, built into the OS, no model download)

Usage:
  powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File win-ocr.ps1 -Langs ja-JP,en-US -Files list.txt
  powershell ... -File win-ocr.ps1 -ListLangs

-Files is a UTF-8 text file with one image path per line: thousands of frame paths do not fit on a command line.
Output is JSON Lines, one line per frame: {"i":index,"file":"name","boxes":[{"t":text,"c":confidence,"x":..,"y":..,"w":..,"h":..}]}
Coordinates are normalized with a top-left origin, the same as vision-ocr on macOS. Non-ASCII text is written as
\uXXXX escapes, so every output line is plain ASCII whatever the console code page is.
Exit codes: 0 ok; 2 bad arguments; 3 no OCR language installed on this Windows
(Settings > Time & language > Language > add a language with "Optical character recognition").

Runs only in Windows PowerShell 5.1, which ships with Windows: it is based on .NET Framework and can project
WinRT directly. PowerShell 7 cannot.

KEEP THIS FILE PURE ASCII. Windows PowerShell 5.1 reads a script that has no byte-order mark in the system code
page. On Chinese, Japanese or Korean Windows that is a double-byte code page, and UTF-8 text in the file can
swallow the quote or newline that follows it, which breaks parsing. bundle-deps-win.ts refuses a non-ASCII copy.
#>
param(
  [string]$Langs = 'en-US',
  [string]$Files = '',
  [switch]$ListLangs
)

$ErrorActionPreference = 'Stop'
# UTF-8 without a byte-order mark: [System.Text.Encoding]::UTF8 would prefix the redirected output with one
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]

# WinRT async operations have to be wrapped in a .NET Task before PowerShell can wait for them
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($operation, $resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($operation))
  $null = $task.Wait(-1)
  return $task.Result
}

$available = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag })
if ($ListLangs) {
  Write-Output ($available -join ',')
  exit 0
}
if (-not $Files -or -not (Test-Path -LiteralPath $Files)) {
  [Console]::Error.WriteLine('Missing the -Files list file')
  exit 2
}

# Match the wanted languages to installed ones by primary subtag (ja-JP -> ja; zh-Hans -> zh-Hans-CN; en-US -> en-US / en-GB).
# The Windows OCR engine reads one language at a time, and the Japanese engine also reads English on signs,
# so the first match wins.
function Pick-Language([string[]]$wanted) {
  foreach ($w in $wanted) {
    $parts = $w.Split('-')
    $primary = $parts[0].ToLower()
    $scriptTag = ''
    if ($primary -eq 'zh' -and $parts.Length -gt 1) { $scriptTag = $parts[1] }
    foreach ($tag in $available) {
      $tp = $tag.Split('-')
      if ($tp[0].ToLower() -ne $primary) { continue }
      if ($scriptTag -ne '' -and $tag -notmatch $scriptTag) { continue }
      return $tag
    }
  }
  return $null
}

$engine = $null
$tag = Pick-Language ($Langs.Split(','))
if ($tag) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language -ArgumentList $tag)) }
if (-not $engine) {
  # Wanted language not installed: fall back to the user's profile languages, which can at least read
  # Chinese characters on signs, and say so on stderr
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($engine) { [Console]::Error.WriteLine("OCR language for '$Langs' is not installed; falling back to $($engine.RecognizerLanguage.LanguageTag). Installed: $($available -join ',')") }
}
if (-not $engine) {
  [Console]::Error.WriteLine("No OCR language is installed on this Windows. Installed: (none)")
  exit 3
}
$lang = $engine.RecognizerLanguage.LanguageTag
# CJK has no spaces between words, but Line.Text joins the recognized words with spaces: join them ourselves
$joiner = if ($lang -match '^(ja|zh|ko)') { '' } else { ' ' }
[Console]::Error.WriteLine("win-ocr: language $lang")

$paths = @(Get-Content -LiteralPath $Files -Encoding UTF8 | Where-Object { $_.Trim() -ne '' })
$started = Get-Date
$i = 0
foreach ($path in $paths) {
  $boxes = New-Object System.Collections.ArrayList
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $W = [double]$bitmap.PixelWidth
    $H = [double]$bitmap.PixelHeight
    foreach ($line in $result.Lines) {
      $x0 = [double]::MaxValue; $y0 = [double]::MaxValue; $x1 = 0.0; $y1 = 0.0
      $words = New-Object System.Collections.ArrayList
      foreach ($word in $line.Words) {
        $r = $word.BoundingRect
        if ($r.X -lt $x0) { $x0 = $r.X }
        if ($r.Y -lt $y0) { $y0 = $r.Y }
        if ($r.X + $r.Width -gt $x1) { $x1 = $r.X + $r.Width }
        if ($r.Y + $r.Height -gt $y1) { $y1 = $r.Y + $r.Height }
        $null = $words.Add($word.Text)
      }
      if ($x1 -le $x0 -or $y1 -le $y0 -or $W -le 0 -or $H -le 0) { continue }
      $text = ($words -join $joiner).Trim()
      if ($text -eq '') { continue }
      # Windows OCR reports no confidence. 0.6 lets the existing rule drop single-frame flashes
      # (frames=1 and c<0.7) while text that stays on screen is kept
      $null = $boxes.Add([ordered]@{
        t = $text; c = 0.6
        x = [math]::Round($x0 / $W, 4); y = [math]::Round($y0 / $H, 4)
        w = [math]::Round(($x1 - $x0) / $W, 4); h = [math]::Round(($y1 - $y0) / $H, 4)
      })
    }
    $bitmap.Dispose()
    $stream.Dispose()
  } catch {
    [Console]::Error.WriteLine("frame $i ($path): $($_.Exception.Message)")
  }
  $frame = [ordered]@{ i = $i; file = [System.IO.Path]::GetFileName($path); boxes = [object[]]$boxes.ToArray() }
  $json = ConvertTo-Json -InputObject $frame -Compress -Depth 5
  # Escape every non-ASCII character as \uXXXX: the line is then plain ASCII, so the result no longer depends on
  # whether the console output encoding really switched to UTF-8
  $json = [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
  Write-Output $json
  $i += 1
  if ($i % 200 -eq 0) { [Console]::Error.WriteLine("win-ocr: $i / $($paths.Count)") }
}
$secs = ((Get-Date) - $started).TotalSeconds
[Console]::Error.WriteLine(("win-ocr: {0} frames in {1:N1}s ({2:N0} ms/frame)" -f $paths.Count, $secs, ($secs * 1000 / [math]::Max($paths.Count, 1))))
exit 0
