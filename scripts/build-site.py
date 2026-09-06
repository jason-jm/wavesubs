#!/usr/bin/env python3
"""官网生成器：一份模板 + 两份文案 → docs/index.html（中文）与 docs/en/index.html（英文）。

为什么不用一页两语的 JS 切换：搜索引擎按 URL 判断语言，一页塞两种语言会稀释信号；
两个独立 URL 加 hreflang 才是标准做法。改文案改这里，别直接改生成出来的 html。
"""
import json, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://jason-jm.github.io/wavesubs/'
REPO = 'https://github.com/jason-jm/wavesubs'
VERSION = json.load(open(os.path.join(ROOT, 'package.json')))['version']

L = {
 'zh': dict(
  lang='zh-Hans', dir_prefix='', other_href='en/', other_label='English', shots='zh-Hans',
  title='Wave Subs — 看片找不到字幕？本地 AI 从影片生成 SRT/ASS 字幕并翻译，免费离线（Mac / Windows）',
  description='Wave Subs：看片找不到字幕时，用本地 AI 直接从影片生成 SRT / ASS 字幕，并自动翻译成你的语言。完全在你的电脑上运行，无需联网，永久免费。支持 macOS（Apple Silicon）与 Windows。',
  keywords='视频生成字幕,自动生成字幕,AI字幕,字幕翻译,SRT字幕生成,ASS字幕,离线字幕软件,本地字幕生成,Whisper Mac,电影字幕生成器,动漫字幕,免费字幕软件',
  og_title='Wave Subs — 看片找不到字幕？本地 AI 帮你生成并翻译',
  nav=dict(how='怎么用', translate='翻译', privacy='隐私', download='下载', faq='常见问题'),
  h1='看片找不到字幕？<em>让本地 AI 从影片直接生成</em>',
  lead='Wave Subs 从视频里识别对白，生成 SRT / ASS 字幕，并自动翻译成你的语言。全部在你自己的电脑上完成——无需联网，完全免费。',
  cta_mac='免费下载 macOS 版', cta_win='免费下载 Windows 版',
  pills=['生成 SRT / ASS 字幕', '自动翻译到你的语言（29 种）', '本地 AI · 无需联网 · 永久免费'],
  hero_alt='Wave Subs 字幕编辑器：从影片生成的字幕，带视频预览与译文',
  hero_note='字幕编辑器：改文字、调时间，点任意一行直接听这句话',
  how_h2='三步，从影片到字幕',
  how_sub='不用先去找字幕站，不用上传视频，不用注册账号。',
  steps=[('拖进影片','MKV、MP4、MOV、TS 都行。如果影片里本来就有内嵌字幕轨，会自动识别并直接使用。'),
         ('本地 AI 识别并对齐','whisper.cpp 在你的电脑上识别对白，自动检测语种；时间轴按真实说话时刻精修，参数用六部整片对照官方字幕校准过。'),
         ('翻译并导出','译成你的语言，导出 SRT 或 ASS，放到影片旁边，任何播放器都认。跑完附带质检结论，告诉你哪里值得看一眼。')],
  step_alt='转换完成：字幕已生成，质检通过，一键进入编辑器',
  tr_h2='自动翻译到你的语言',
  tr_p='目标语言有 29 种：中文简繁、英、日、韩、法、德、西、葡、俄、泰、越、印尼、马来……默认用本地运行的 Qwen3 模型，免费、不联网；也可以接入任何 OpenAI 兼容接口。',
  tr_li=['术语表：人名、地名固定译法，整季前后一致','双语或纯译文导出，随你选','换模型或改术语表会严格重翻，绝不混用旧译文'],
  tr_alt='本地翻译模型页面：Qwen3 模型按这台电脑的内存标注是否合适',
  ed_h2='字幕编辑器，带视频预览',
  ed_p='改文字、调时间、增删合并、撤销、自动保存。点任意一行，直接听这句话怎么说的——HEVC、DTS 这类浏览器播不了的格式，随包的 ffmpeg 也能解出来。质检发现可以点击跳转。',
  ed_alt='字幕编辑器：视频预览、字幕叠加、逐行编辑',
  ba_h2='整季一起跑，每集单独调',
  ba_p='把一个文件夹拖进来，全部文件用同一套设置，需要的那几个再单独指定字幕轨、音轨或引擎。跑完的每一行都带质检结论。',
  ba_alt='批量队列：多集动漫同时生成字幕',
  pr_h2='为什么坚持本地',
  pr_sub='在线字幕工具要你把整部影片传上去。Wave Subs 什么都不发出去。',
  pr_cards=[('无需联网','识别、对齐、翻译、编辑、导出全部在本地完成。模型下载好之后，断网也能用。'),
            ('视频从不上传','没有账号、没有统计、没有服务器。它就是一个在你电脑上跑的程序。'),
            ('永久免费','没有次数限制、没有会员。只有你自己选择接入云端翻译时，费用才由那家服务商向你收取。')],
  dl_h2='免费下载', dl_sub=f'版本 {VERSION}。ffmpeg 与 whisper.cpp 已随包附带，装完就能用，不需要另装任何东西。',
  mac_req='macOS 12 或更新 · <strong>仅 Apple Silicon</strong>（M1 及之后）· 已由 Apple 公证',
  win_req='Windows 10 或更新 · x64 · 建议 16 GB 内存',
  dl_mac='下载 DMG', dl_mac_alt='或者 ZIP 压缩包', dl_win='下载安装程序', dl_win_alt='或者便携版 ZIP',
  dl_note='首次使用会引导下载识别模型（1.6～3 GB，之后不再需要联网）。开源组件许可见 <a href="'+REPO+'/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>。',
  faq_h2='常见问题',
  faq=[('哪些视频可以生成字幕？','MKV、MP4、MOV、TS、AVI 等常见格式都可以；HEVC、DTS、TrueHD 这类浏览器播不了的编码也没问题，因为随包的 ffmpeg 什么都能解。纯音频文件同样可以。'),
       ('支持哪些语言？','识别支持 whisper 覆盖的近百种语言并自动检测；翻译目标语言 29 种，包括中文简繁、英、日、韩、法、德、西、葡、俄、泰、越、印尼、马来等；界面有 32 种语言。'),
       ('真的不需要联网吗？','识别、对齐、翻译、编辑、导出全部本地完成。只有两件事用到网络：第一次下载模型，以及你自己选择配置云端翻译。'),
       ('一部两小时的电影要多久？','M 系列芯片上用 Large v3 Turbo 大约 3～6 分钟，加上本地翻译再多几分钟。整季批量可以挂着跑。'),
       ('生成的字幕准吗？','识别用的是 whisper large 系列模型；时间轴用语音活动检测和响度分析贴回真实说话时刻，参数对照六部整片的官方字幕校准。每个文件跑完会附带质检结论，哪里可疑直接告诉你。'),
       ('影片里已经有字幕轨了呢？','会自动发现内嵌的文本字幕轨并优先使用，直接进入翻译，比识别更快更准。图形字幕（PGS/VobSub）除外。'),
       ('支持 Intel Mac 吗？','目前不支持。本地识别依赖 Apple Silicon 的 Metal 加速，Intel 机器上慢到不实用。'),
       ('Windows 提示"未知发布者"？','Windows 版尚未购买代码签名证书，SmartScreen 会对新程序提示。点"更多信息 → 仍要运行"即可；校验值在 GitHub Releases 页。'),
       ('和在线字幕生成网站比有什么区别？','在线工具要你上传整部影片、按分钟计费、通常有时长上限。Wave Subs 不上传、不收费、不限时长，速度取决于你的电脑。')],
  footer_issue='反馈问题', footer_changelog='更新日志',
 ),
 'en': dict(
  lang='en', dir_prefix='../', other_href='../', other_label='中文', shots='en',
  title='Wave Subs — Can\'t find subtitles? Generate SRT/ASS subtitles from any video with local AI, translated, free & offline (Mac / Windows)',
  description='Wave Subs generates SRT / ASS subtitles directly from a video using local AI, then translates them into your language. Runs entirely on your computer — no internet needed, free forever. macOS (Apple Silicon) and Windows.',
  keywords='generate subtitles from video,AI subtitle generator,auto subtitles,translate subtitles,SRT generator,ASS subtitles,offline subtitle software,local subtitle generator,whisper mac app,movie subtitle generator,anime subtitles,free subtitle maker',
  og_title='Wave Subs — Can\'t find subtitles? Let local AI generate and translate them',
  nav=dict(how='How it works', translate='Translation', privacy='Privacy', download='Download', faq='FAQ'),
  h1='Can\'t find subtitles? <em>Let local AI generate them from the video</em>',
  lead='Wave Subs recognizes the dialogue in a video, generates SRT / ASS subtitles, and translates them into your language. Everything runs on your own computer — no internet needed, completely free.',
  cta_mac='Free download for macOS', cta_win='Free download for Windows',
  pills=['Generate SRT / ASS subtitles', 'Auto-translate into your language (29)', 'Local AI · no internet · free forever'],
  hero_alt='Wave Subs subtitle editor: subtitles generated from a video, with preview and translation',
  hero_note='The editor: fix text, adjust timing, click any line to hear it',
  how_h2='From video to subtitles in three steps',
  how_sub='No subtitle sites to search, no video to upload, no account to create.',
  steps=[('Drop in the video','MKV, MP4, MOV, TS — all fine. If the file already has an embedded subtitle track, it is detected and used directly.'),
         ('Local AI recognizes and aligns','whisper.cpp recognizes the dialogue on your machine with automatic language detection; timing is refined to when lines are actually spoken, tuned against the official subtitles of six full-length films.'),
         ('Translate and export','Translated into your language, exported as SRT or ASS next to the video — any player reads it. A quality verdict tells you where to take a look.')],
  step_alt='Conversion finished: subtitles generated, quality check passed, one click into the editor',
  tr_h2='Auto-translated into your language',
  tr_p='29 target languages: Chinese (Simplified and Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian, Malay and more. A locally running Qwen3 model by default — free and offline — or any OpenAI-compatible API.',
  tr_li=['Glossary: pin names and terms so a whole season stays consistent','Bilingual or translation-only export, your choice','Changing the model or glossary retranslates strictly — old output is never mixed in'],
  tr_alt='Local translation models page: Qwen3 models labeled by whether they fit this machine',
  ed_h2='An editor with video preview',
  ed_p='Fix text, adjust timing, insert, delete, merge, undo, autosave. Click any line to hear exactly how it was said — even HEVC or DTS files a browser can\'t play, thanks to the bundled ffmpeg. Quality findings are clickable.',
  ed_alt='Subtitle editor: video preview, subtitle overlay, line-by-line editing',
  ba_h2='Run a whole season, tune each episode',
  ba_p='Drop in a folder. Every file follows the shared settings; override the subtitle track, audio track or engine only where needed. Each finished row carries its quality verdict.',
  ba_alt='Batch queue: generating subtitles for several anime episodes at once',
  pr_h2='Why local',
  pr_sub='Online subtitle tools ask you to upload the whole film. Wave Subs sends nothing anywhere.',
  pr_cards=[('No internet needed','Recognition, alignment, translation, editing and export all happen locally. Once models are downloaded, it works with the network off.'),
            ('Videos are never uploaded','No account, no analytics, no server. It is a program that runs on your computer.'),
            ('Free forever','No quotas, no subscription. Only if you choose to plug in a cloud translation provider does that provider bill you.')],
  dl_h2='Free download', dl_sub=f'Version {VERSION}. ffmpeg and whisper.cpp are bundled — install and go, nothing else to set up.',
  mac_req='macOS 12 or later · <strong>Apple Silicon only</strong> (M1 and later) · Notarized by Apple',
  win_req='Windows 10 or later · x64 · 16 GB RAM recommended',
  dl_mac='Download DMG', dl_mac_alt='or ZIP archive', dl_win='Download installer', dl_win_alt='or portable ZIP',
  dl_note='On first launch you\'ll be guided to download a recognition model (1.6–3 GB; no network needed after that). Open-source component licenses: <a href="'+REPO+'/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Frequently asked questions',
  faq=[('Which videos can it generate subtitles for?','MKV, MP4, MOV, TS, AVI and other common formats; HEVC, DTS and TrueHD streams a browser can\'t play are fine too, because the bundled ffmpeg decodes everything. Audio-only files work as well.'),
       ('Which languages are supported?','Recognition covers the nearly 100 languages whisper supports, with automatic detection; there are 29 translation targets including Chinese (Simplified/Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian and Malay; the interface comes in 32 languages.'),
       ('Does it really work without internet?','Recognition, alignment, translation, editing and export all run locally. Only two things touch the network: the one-time model download, and cloud translation if you choose to configure it.'),
       ('How long does a two-hour film take?','Roughly 3–6 minutes with Large v3 Turbo on an M-series chip, plus a few more for local translation. Batch a whole season and let it run.'),
       ('How accurate are the subtitles?','Recognition uses the whisper large family; timing is snapped to when lines are actually spoken using voice activity detection and loudness analysis, tuned against official subtitles of six full films. Every file gets a quality verdict that points at anything suspicious.'),
       ('What if the video already has a subtitle track?','Embedded text tracks are detected and preferred, skipping straight to translation — faster and more accurate than recognition. Image-based subtitles (PGS/VobSub) are the exception.'),
       ('Is there an Intel Mac version?','Not currently. Local recognition relies on Metal acceleration on Apple Silicon; on Intel it would be too slow to be useful.'),
       ('Windows says "unknown publisher"?','The Windows build isn\'t code-signed yet, so SmartScreen warns about new programs. Click "More info → Run anyway"; checksums are on the GitHub Releases page.'),
       ('How is this different from online subtitle generators?','Online tools make you upload the whole film, charge per minute and cap the length. Wave Subs uploads nothing, costs nothing and has no length limit — speed depends on your machine.')],
  footer_issue='Report an issue', footer_changelog='Changelog',
 ),
}

CSS = open(os.path.join(ROOT, 'scripts', 'site.css')).read()

def esc(s): return html.escape(s, quote=True)

def page(k):
    d = L[k]; p = d['dir_prefix']; sh = d['shots']
    a = lambda name: f'{p}assets/shots/{sh}-dark-{name}.jpg'
    canonical = SITE + ('en/' if k == 'en' else '')
    faq_ld = {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}} for q,ans in d['faq']]}
    app_ld = {"@context":"https://schema.org","@type":"SoftwareApplication","name":"Wave Subs","applicationCategory":"MultimediaApplication",
              "operatingSystem":"macOS 12+ (Apple Silicon), Windows 10+","softwareVersion":VERSION,"inLanguage":d['lang'],
              "description":d['description'],"url":canonical,"downloadUrl":REPO+'/releases/latest',"screenshot":SITE+a('editor').lstrip('./'),
              "offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"author":{"@type":"Person","name":"Jiesi Ma"},
              "featureList":", ".join(d['pills'])}
    steps = "".join(f'<div class="card"><div class="k">{i+1}</div><h3>{esc(t)}</h3><p>{esc(b)}</p></div>' for i,(t,b) in enumerate(d['steps']))
    tr_li = "".join(f'<li>{esc(x)}</li>' for x in d['tr_li'])
    pr = "".join(f'<div><strong>{esc(t)}</strong>{esc(b)}</div>' for t,b in d['pr_cards'])
    faq = "".join(f'<details><summary>{esc(q)}</summary><p>{esc(ans)}</p></details>' for q,ans in d['faq'])
    pills = "".join(f'<span class="pill">{esc(x)}</span>' for x in d['pills'])
    n = d['nav']
    return f'''<!doctype html>
<html lang="{d['lang']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(d['title'])}</title>
<meta name="description" content="{esc(d['description'])}">
<meta name="keywords" content="{esc(d['keywords'])}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="zh-Hans" href="{SITE}">
<link rel="alternate" hreflang="en" href="{SITE}en/">
<link rel="alternate" hreflang="x-default" href="{SITE}en/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wave Subs">
<meta property="og:title" content="{esc(d['og_title'])}">
<meta property="og:description" content="{esc(d['description'])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}assets/hero-wave.jpg">
<meta property="og:locale" content="{'zh_CN' if k=='zh' else 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(d['og_title'])}">
<meta name="twitter:description" content="{esc(d['description'])}">
<meta name="twitter:image" content="{SITE}assets/hero-wave.jpg">
<link rel="icon" href="{p}assets/icon.png">
<script type="application/ld+json">{json.dumps(app_ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{p if p else './'}"><img src="{p}assets/icon.png" alt="Wave Subs"><span>Wave Subs</span></a>
  <nav>
    <a href="#how">{esc(n['how'])}</a><a href="#translate">{esc(n['translate'])}</a><a href="#privacy">{esc(n['privacy'])}</a>
    <a href="#download">{esc(n['download'])}</a><a href="#faq">{esc(n['faq'])}</a>
    <a href="{REPO}" target="_blank" rel="noopener">GitHub</a>
    <a class="lang-btn" href="{d['other_href']}" hreflang="{'en' if k=='zh' else 'zh-Hans'}">{d['other_label']}</a>
  </nav>
</div></header>

<section class="hero"><div class="wrap">
  <h1>{d['h1']}</h1>
  <p class="lead">{esc(d['lead'])}</p>
  <div class="cta">
    <a class="btn primary" id="dl-primary" href="#download">{esc(d['cta_mac'])} <small>Apple Silicon</small></a>
    <a class="btn" id="dl-secondary" href="#download">{esc(d['cta_win'])} <small>x64</small></a>
  </div>
  <div class="pills">{pills}</div>
  <div class="hero-shot"><img src="{a('editor')}" alt="{esc(d['hero_alt'])}" width="1920" height="1200" fetchpriority="high"></div>
  <p class="note">{esc(d['hero_note'])}</p>
</div></section>

<section id="how"><div class="wrap">
  <h2>{esc(d['how_h2'])}</h2><p class="sub">{esc(d['how_sub'])}</p>
  <div class="grid">{steps}</div>
  <div class="feature" style="padding-top:40px">
    <div class="shot"><img src="{a('home-done')}" alt="{esc(d['step_alt'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h3>{esc(d['steps'][2][0])}</h3><p>{esc(d['steps'][2][1])}</p></div>
  </div>
</div></section>

<section id="translate" style="padding-top:0"><div class="wrap">
  <div class="feature flip">
    <div class="shot"><img src="{a('translate-models')}" alt="{esc(d['tr_alt'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['tr_h2'])}</h2><p>{esc(d['tr_p'])}</p><ul>{tr_li}</ul></div>
  </div>
  <div class="feature">
    <div class="shot"><img src="{a('editor')}" alt="{esc(d['ed_alt'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['ed_h2'])}</h2><p>{esc(d['ed_p'])}</p></div>
  </div>
  <div class="feature flip">
    <div class="shot"><img src="{a('batch')}" alt="{esc(d['ba_alt'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['ba_h2'])}</h2><p>{esc(d['ba_p'])}</p></div>
  </div>
</div></section>

<section class="privacy" id="privacy"><div class="wrap">
  <h2>{esc(d['pr_h2'])}</h2><p class="sub">{esc(d['pr_sub'])}</p>
  <div class="row">{pr}</div>
  <p class="req" style="margin-top:18px;font-size:13.5px"><a href="{p}{'en/' if k=='en' else ''}privacy.html">{'Full privacy policy' if k=='en' else '完整隐私政策'}</a></p>
</div></section>

<section id="download"><div class="wrap">
  <h2>{esc(d['dl_h2'])}</h2><p class="sub">{esc(d['dl_sub'])}</p>
  <div class="dl">
    <div class="card"><h3>macOS</h3><div class="req">{d['mac_req']}</div>
      <a class="btn primary" data-dl="mac-dmg" href="#">{esc(d['dl_mac'])}</a><div class="req"><a data-dl="mac-zip" href="#">{esc(d['dl_mac_alt'])}</a></div></div>
    <div class="card"><h3>Windows</h3><div class="req">{d['win_req']}</div>
      <a class="btn primary" data-dl="win-exe" href="#">{esc(d['dl_win'])}</a><div class="req"><a data-dl="win-zip" href="#">{esc(d['dl_win_alt'])}</a></div></div>
  </div>
  <p class="req" style="margin-top:22px;font-size:13.5px;color:var(--text-3)">{d['dl_note']}</p>
</div></section>

<section id="faq" style="padding-top:0"><div class="wrap"><h2>{esc(d['faq_h2'])}</h2>{faq}</div></section>

<footer><div class="wrap">
  <span>© 2026 Jiesi Ma · Wave Subs</span>
  <nav><a href="{REPO}" target="_blank" rel="noopener">GitHub</a><a href="{REPO}/issues" target="_blank" rel="noopener">{esc(d['footer_issue'])}</a><a href="{REPO}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">{esc(d['footer_changelog'])}</a></nav>
</div></footer>

<script>
  const VERSION = '{VERSION}';
  const BASE = '{REPO}/releases/download/v' + VERSION + '/';
  const FILES = {{ 'mac-dmg': BASE + 'Wave.Subs-' + VERSION + '-arm64.dmg', 'mac-zip': BASE + 'Wave.Subs-' + VERSION + '-arm64-mac.zip',
    'win-exe': BASE + 'Wave.Subs.Setup.' + VERSION + '.exe', 'win-zip': BASE + 'Wave.Subs-' + VERSION + '-win.zip' }};
  const isWin = /Windows/i.test(navigator.userAgent);
  const applyLinks = (files) => {{
    document.querySelectorAll('[data-dl]').forEach((a) => {{ if (files[a.dataset.dl]) a.href = files[a.dataset.dl]; }});
    document.getElementById('dl-primary').href = isWin ? files['win-exe'] : files['mac-dmg'];
    document.getElementById('dl-secondary').href = isWin ? files['mac-dmg'] : files['win-exe'];
  }};
  applyLinks(FILES);
  if (isWin) {{ const p = document.getElementById('dl-primary'), s = document.getElementById('dl-secondary'); p.parentNode.insertBefore(s, p); }}
  fetch('https://api.github.com/repos/jason-jm/wavesubs/releases/latest', {{ headers: {{ Accept: 'application/vnd.github+json' }} }})
    .then((r) => (r.ok ? r.json() : null)).then((rel) => {{
      if (!rel || !Array.isArray(rel.assets)) return;
      const pick = (test) => (rel.assets.find((x) => test(x.name)) || {{}}).browser_download_url;
      const files = {{ 'mac-dmg': pick((n) => n.endsWith('.dmg')), 'mac-zip': pick((n) => n.endsWith('-mac.zip')),
        'win-exe': pick((n) => n.endsWith('.exe')), 'win-zip': pick((n) => n.endsWith('-win.zip')) }};
      if (files['mac-dmg'] && files['win-exe']) applyLinks(files);
    }}).catch(() => {{}});
</script>
</body>
</html>
'''

for k, out in (('zh', 'docs/index.html'), ('en', 'docs/en/index.html')):
    path = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(page(k))
    print(f'{out}: {os.path.getsize(path)} bytes')


# ---------- 隐私政策独立页（App Store 审核要求一个明确的隐私政策 URL） ----------
PRIVACY = {
 'zh': dict(lang='zh-Hans', p='', title='Wave Subs 隐私政策', updated='更新日期：2026 年 9 月 6 日', back='返回官网', other='English', other_href='en/privacy.html',
  sections=[
   ('概述', ['Wave Subs 是一款完全在你自己的电脑上运行的桌面软件。<strong>我们不收集、不存储、不传输任何个人数据</strong>，没有账号系统，没有使用统计，没有崩溃上报，也没有任何属于我们的服务器。']),
   ('在本地处理的数据', ['你导入的视频、音频、字幕文件，以及识别结果、译文、编辑记录和任务缓存，全部保存在你设备的本地目录中，仅供软件本身使用。你可以随时在设置或访达中删除它们。','语音识别与翻译模型在你的设备上运行，处理过程不经过网络。']),
   ('软件会在什么时候访问网络', ['<strong>下载模型：</strong>首次使用时，识别与翻译模型从 Hugging Face 的公开仓库下载。该请求不包含你的任何个人信息；与任何网络下载一样，对方服务器会看到你的 IP 地址，受 Hugging Face 的隐私政策约束。','<strong>云端翻译（可选，默认关闭）：</strong>只有当你自行填入某个第三方翻译服务的接口地址与密钥时，字幕文本才会发送给<em>你选择的那家服务商</em>，由其隐私政策约束。密钥经系统钥匙串加密后仅保存在本地。不配置云端翻译，软件不会向任何翻译服务发送内容。','除以上两种情况外，软件不进行任何网络请求：没有自动更新检查、没有遥测、没有广告。']),
   ('第三方组件', ['软件随包附带的开源组件（ffmpeg、whisper.cpp、llama.cpp 等）均在本地运行，不与其作者或任何第三方通信。许可信息见应用内与 <a href="https://github.com/jason-jm/wavesubs/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>。']),
   ('儿童隐私', ['软件不面向儿童设计，也不从任何年龄段的用户收集数据。']),
   ('政策变更', ['如本政策有实质性变更，我们会在本页面更新并注明日期。']),
   ('联系我们', ['关于隐私的任何问题，请通过 <a href="https://github.com/jason-jm/wavesubs/issues">GitHub Issues</a> 联系我们。']),
  ]),
 'en': dict(lang='en', p='../', title='Wave Subs Privacy Policy', updated='Last updated: September 6, 2026', back='Back to site', other='中文', other_href='../privacy.html',
  sections=[
   ('Overview', ['Wave Subs is desktop software that runs entirely on your own computer. <strong>We do not collect, store or transmit any personal data.</strong> There is no account system, no usage analytics, no crash reporting, and no server of ours.']),
   ('Data processed locally', ['The video, audio and subtitle files you import — along with recognition results, translations, edits and the job cache — are stored in local directories on your device and used only by the app itself. You can delete them at any time from Settings or Finder.','Speech recognition and translation models run on your device; processing never goes over the network.']),
   ('When the app uses the network', ['<strong>Model downloads:</strong> on first use, recognition and translation models are downloaded from public Hugging Face repositories. The request contains none of your personal information; as with any download, the server sees your IP address, subject to Hugging Face\'s privacy policy.','<strong>Cloud translation (optional, off by default):</strong> only if you enter the endpoint and API key of a third-party translation service yourself is subtitle text sent to <em>that provider you chose</em>, subject to its privacy policy. The key is encrypted with the system keychain and stored only locally. Without cloud translation configured, the app sends nothing to any translation service.','Apart from these two cases the app makes no network requests: no update checks, no telemetry, no ads.']),
   ('Third-party components', ['Bundled open-source components (ffmpeg, whisper.cpp, llama.cpp and others) run locally and do not communicate with their authors or any third party. License information is included in the app and at <a href="https://github.com/jason-jm/wavesubs/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.']),
   ('Children\'s privacy', ['The app is not directed at children and collects no data from users of any age.']),
   ('Changes', ['Material changes to this policy will be posted on this page with an updated date.']),
   ('Contact', ['For any privacy question, reach us via <a href="https://github.com/jason-jm/wavesubs/issues">GitHub Issues</a>.']),
  ]),
}

def privacy_page(k):
    d = PRIVACY[k]; p = d['p']
    body = ''.join(f'<h2>{esc(t)}</h2>' + ''.join(f'<p>{x}</p>' for x in ps) for t, ps in d['sections'])
    return f'''<!doctype html>
<html lang="{d['lang']}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(d['title'])}</title>
<meta name="description" content="{esc(d['title'])}">
<meta name="robots" content="noindex">
<link rel="icon" href="{p}assets/icon.png">
<style>{CSS}
  .doc{{max-width:760px;margin:0 auto;padding:48px 24px 80px}}
  .doc h1{{font-size:32px;margin:0 0 6px}}
  .doc .updated{{color:var(--text-3);font-size:13.5px;margin:0 0 32px}}
  .doc h2{{font-size:20px;margin:30px 0 8px}}
  .doc p{{color:var(--text-2);font-size:15.5px;margin:0 0 12px;line-height:1.7}}
  .doc strong{{color:var(--text)}}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{p if p else './'}"><img src="{p}assets/icon.png" alt="Wave Subs"><span>Wave Subs</span></a>
  <nav><a href="{p if p else './'}">{esc(d['back'])}</a><a class="lang-btn" href="{d['other_href']}">{d['other']}</a></nav>
</div></header>
<main class="doc">
  <h1>{esc(d['title'])}</h1>
  <p class="updated">{esc(d['updated'])}</p>
  {body}
</main>
</body>
</html>
'''

for k, out in (('zh', 'docs/privacy.html'), ('en', 'docs/en/privacy.html')):
    path = os.path.join(ROOT, out)
    open(path, 'w', encoding='utf-8').write(privacy_page(k))
    print(f'{out}: {os.path.getsize(path)} bytes')
