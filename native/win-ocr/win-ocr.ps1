<#
Wave Subs · Windows 画面文字识别（Windows.Media.Ocr，系统自带，不下载模型）

用法：
  powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File win-ocr.ps1 -Langs ja-JP,en-US -Files list.txt
  powershell ... -File win-ocr.ps1 -ListLangs

-Files 是一个文本文件，一行一个图片路径（UTF-8）——几千帧的路径塞不进命令行。
输出 JSON Lines，每帧一行：{"i":序号,"file":"文件名","boxes":[{"t":文字,"c":置信度,"x":..,"y":..,"w":..,"h":..}]}
坐标是左上角原点的归一化值，和 macOS 的 vision-ocr 一样。
退出码：0 正常；2 参数错；3 这台 Windows 一种 OCR 语言都没装（设置 → 时间和语言 → 语言 → 添加语言，勾选「光学字符识别」）。

只能在 Windows PowerShell 5.1（系统自带）里跑：它基于 .NET Framework，能直接投影 WinRT；PowerShell 7 不行。
#>
param(
  [string]$Langs = 'en-US',
  [string]$Files = '',
  [switch]$ListLangs
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]

# WinRT 的异步操作要包成 .NET 的 Task 才能在 PowerShell 里等它做完
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
  [Console]::Error.WriteLine('没有 -Files 列表文件')
  exit 2
}

# 想要的语言按主语言子标签匹配已装的（ja-JP → ja；zh-Hans → zh-Hans-CN；en-US → en-US / en-GB）。
# Windows 的 OCR 引擎一次只认一种语言，日语引擎也能读招牌上的英文，所以只取第一个能配上的。
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
  # 想要的语言没装：退到用户的系统语言引擎，起码汉字招牌还能读一读；stderr 里说明白
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($engine) { [Console]::Error.WriteLine("OCR language for '$Langs' is not installed; falling back to $($engine.RecognizerLanguage.LanguageTag). Installed: $($available -join ',')") }
}
if (-not $engine) {
  [Console]::Error.WriteLine("No OCR language is installed on this Windows. Installed: (none)")
  exit 3
}
$lang = $engine.RecognizerLanguage.LanguageTag
# 中日韩没有词间空格：Line.Text 会用空格把「词」连起来，自己拼
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
      # Windows 的 OCR 不给置信度：0.6 让只闪一帧的（frames=1 且 c<0.7）按现有规则丢掉，连着出现的照收
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
  Write-Output (ConvertTo-Json -InputObject $frame -Compress -Depth 5)
  $i += 1
  if ($i % 200 -eq 0) { [Console]::Error.WriteLine("win-ocr: $i / $($paths.Count)") }
}
$secs = ((Get-Date) - $started).TotalSeconds
[Console]::Error.WriteLine(("win-ocr: {0} frames in {1:N1}s ({2:N0} ms/frame)" -f $paths.Count, $secs, ($secs * 1000 / [math]::Max($paths.Count, 1))))
exit 0
