#!/usr/bin/env python3
"""官网生成器：一份模板 + 11 份文案 → docs/index.html（中文根页）+ docs/<lang>/index.html。

- 根页（中文）带一段脚本：首次访问按浏览器语言跳到对应语言目录，用户手动切换过就记住不再跳
- 每页互相 hreflang，x-default 指向根页；canonical 指向自己
- 模型配置表的数字来自 App 内的模型目录（asr/catalog.ts、translate/localCatalog.ts），改数字改这里
改文案改这里，别直接改生成出来的 html。
"""
import json, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://jason-jm.github.io/wavesubs/'
REPO = 'https://github.com/jason-jm/wavesubs'
VERSION = json.load(open(os.path.join(ROOT, 'package.json')))['version']
CSS = open(os.path.join(ROOT, 'scripts', 'site.css')).read()

# 语言目录：zh 在根目录，其它在 <code>/ 下
LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'ru', 'id', 'ms', 'vi', 'th']
NATIVE = dict(zh='简体中文', en='English', ja='日本語', ko='한국어', fr='Français', de='Deutsch', ru='Русский',
              id='Bahasa Indonesia', ms='Bahasa Melayu', vi='Tiếng Việt', th='ไทย')
HTML_LANG = dict(zh='zh-Hans', en='en', ja='ja', ko='ko', fr='fr', de='de', ru='ru', id='id', ms='ms', vi='vi', th='th')
OG_LOCALE = dict(zh='zh_CN', en='en_US', ja='ja_JP', ko='ko_KR', fr='fr_FR', de='de_DE', ru='ru_RU', id='id_ID', ms='ms_MY', vi='vi_VN', th='th_TH')
SHOTS = dict(zh='zh-Hans')  # 其余语言目录名与截图前缀相同

# 模型目录（与 App 内一致）：名称、下载 MB、运行内存 GB、质量 1-5、速度 1-5
ASR = [('Tiny', 75, 0.5, 1, 5), ('Base', 142, 0.7, 2, 5), ('Small', 466, 1.2, 3, 4), ('Medium', 1536, 2.6, 4, 2),
       ('Large v3 Turbo', 1620, 2.2, 4.5, 4), ('Large v3', 3100, 4.5, 5, 1)]
LLM = [('Qwen3 1.7B', 1834, 2.5, 2, 5), ('Qwen3 4B', 2440, 3.5, 3, 4), ('Qwen3 8B', 5030, 6, 4, 3),
       ('Qwen3 14B', 9200, 10.5, 4.5, 2), ('Qwen3 32B', 20200, 22, 5, 1)]

TIERS = [8, 16, 24, 32, 48, 64, 96, 128]
def tier(need):
    return next((t for t in TIERS if t >= need), TIERS[-1])
def fit_mac(ram):   # App 内规则：整机内存 >= 运行内存 + 6 判为「合适」
    return f'{tier(ram + 6)} GB'
def fit_pc(ram):    # Windows 纯 CPU 推理（BLAS）余量更大，在 Mac 档位上再进一档，且不低于 16
    t = tier(ram + 6); return f'{max(16, TIERS[min(TIERS.index(t) + 1, len(TIERS) - 1)])} GB'
def dots(n):
    full = int(n); half = 1 if n - full >= 0.5 else 0
    return '●' * full + ('◐' if half else '') + '○' * (5 - full - half)
def size(mb):
    return f'{mb/1024:.1f} GB' if mb >= 1000 else f'{mb} MB'

T = {}

T['zh'] = dict(
  title='Wave Subs — 看片找不到字幕？本地 AI 从影片生成 SRT/ASS 字幕并翻译，免费离线（Mac / Windows）',
  description='看片找不到字幕？Wave Subs 用本地 AI 直接从影片生成 SRT / ASS 字幕，并自动翻译成你的语言。完全在你的电脑上运行，无需联网，永久免费。支持 macOS（Apple Silicon）与 Windows。',
  keywords='视频生成字幕,自动生成字幕,AI字幕,字幕翻译,SRT字幕生成,ASS字幕,离线字幕软件,本地字幕生成,Whisper Mac,电影字幕生成器,动漫字幕,免费字幕软件',
  og_title='Wave Subs — 看片找不到字幕？本地 AI 帮你生成并翻译',
  nav=['怎么用', '翻译', '隐私', '配置要求', '下载', '常见问题'],
  h1='看片找不到字幕？', h2='让本地 AI 从影片直接生成',
  lead='Wave Subs 从视频里识别对白，生成 SRT / ASS 字幕，并自动翻译成你的语言。全部在你自己的电脑上完成——无需联网，完全免费。',
  cta_mac='macOS 版', cta_win='Windows 版', cta_note=['完全开源', '完全免费', '没有内购'],
  pills=['生成 SRT / ASS 字幕', '自动翻译到你的语言（29 种）', '本地 AI · 无需联网'],
  hero_note='字幕编辑器：改文字、调时间，点任意一行直接听这句话',
  how_h2='三步，从影片到字幕', how_sub='不用先去找字幕站，不用上传视频，不用注册账号。',
  steps=[('拖进影片', 'MKV、MP4、MOV、TS 都行。如果影片里本来就有内嵌字幕轨，会自动识别并直接使用。'),
         ('本地 AI 识别并对齐', 'whisper.cpp 在你的电脑上识别对白，自动检测语种；时间轴按真实说话时刻精修，参数用六部整片对照官方字幕校准过。'),
         ('翻译并导出', '译成你的语言，导出 SRT 或 ASS，放到影片旁边，任何播放器都认。跑完附带质检结论，告诉你哪里值得看一眼。')],
  tr_h2='自动翻译到你的语言',
  tr_p='目标语言有 29 种：中文简繁、英、日、韩、法、德、西、葡、俄、泰、越、印尼、马来……默认用本地运行的 Qwen3 模型，免费、不联网；也可以接入任何 OpenAI 兼容接口。',
  tr_li=['术语表：人名、地名固定译法，整季前后一致', '双语或纯译文导出，随你选', '换模型或改术语表会严格重翻，绝不混用旧译文'],
  ed_h2='字幕编辑器，带视频预览',
  ed_p='改文字、调时间、增删合并、撤销、自动保存。点任意一行，直接听这句话怎么说的——HEVC、DTS 这类浏览器播不了的格式，随包的 ffmpeg 也能解出来。质检发现可以点击跳转。',
  ba_h2='整季一起跑，每集单独调',
  ba_p='把一个文件夹拖进来，全部文件用同一套设置，需要的那几个再单独指定字幕轨、音轨或引擎。跑完的每一行都带质检结论。',
  pr_h2='为什么坚持本地', pr_sub='在线字幕工具要你把整部影片传上去。Wave Subs 什么都不发出去。',
  pr_cards=[('无需联网', '识别、对齐、翻译、编辑、导出全部在本地完成。模型下载好之后，断网也能用。'),
            ('视频从不上传', '没有账号、没有统计、没有服务器。它就是一个在你电脑上跑的程序。'),
            ('永久免费', '没有次数限制、没有会员。只有你自己选择接入云端翻译时，费用才由那家服务商向你收取。')],
  pr_link='完整隐私政策',
  req_h2='模型与配置要求', req_sub='模型在应用内一键下载，App 会按你这台机器的内存标注每个模型「合适 / 可用 / 跑不动」。下面是同一套规则的对照表。',
  req_asr='语音识别模型（whisper）', req_llm='本地翻译模型（Qwen3）',
  req_cols=['模型', '下载大小', '运行占用内存', '质量', '速度', 'Mac 建议内存', 'Windows PC 建议内存'],
  req_combo_h3='推荐组合', req_combo_cols=['你的机器', '识别模型', '翻译模型', '说明'],
  req_combo=[('Mac 8 GB', 'Small 或 Large v3 Turbo', 'Qwen3 1.7B', '够用；Turbo 在 8 GB 上可以跑但别同时开太多别的程序'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', '默认推荐，质量与速度的平衡点'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', '识别质量最高，翻译更准'),
             ('Mac 48 GB 及以上', 'Large v3', 'Qwen3 32B', '翻译质量最高，速度较慢'),
             ('Windows PC 16 GB', 'Large v3 Turbo', 'Qwen3 4B', '纯 CPU 运算，同一模型耗时通常是 Apple Silicon 的数倍'),
             ('Windows PC 32 GB', 'Large v3 Turbo', 'Qwen3 8B', '大模型可跑，请预留时间')],
  req_notes=['「运行占用内存」是模型加载后实际占用；识别与翻译先后进行，不会同时占用两份。',
             'Apple Silicon 用 Metal 加速；Windows 版为 CPU（BLAS）运算，速度明显慢于同档 Mac，且不支持 Intel Mac。',
             'M 系列芯片上，两小时电影用 Large v3 Turbo 约 3～6 分钟识别，本地翻译再加几分钟。'],
  dl_h2='下载', dl_sub=f'版本 {VERSION}。ffmpeg 与 whisper.cpp 已随包附带，装完就能用，不需要另装任何东西。',
  mac_req='macOS 12 或更新 · <strong>仅 Apple Silicon</strong>（M1 及之后）· 已由 Apple 公证',
  win_req='Windows 10 或更新 · x64 · 建议 16 GB 内存',
  dl_mac='下载 DMG', dl_mac_alt='或者 ZIP 压缩包', dl_win='下载安装程序', dl_win_alt='或者便携版 ZIP',
  dl_note='首次使用会引导下载识别模型（之后不再需要联网）。开源组件许可见 <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>。',
  faq_h2='常见问题',
  faq=[('哪些视频可以生成字幕？', 'MKV、MP4、MOV、TS、AVI 等常见格式都可以；HEVC、DTS、TrueHD 这类浏览器播不了的编码也没问题，因为随包的 ffmpeg 什么都能解。纯音频文件同样可以。'),
       ('支持哪些语言？', '识别支持 whisper 覆盖的近百种语言并自动检测；翻译目标语言 29 种；界面有 32 种语言。'),
       ('真的不需要联网吗？', '识别、对齐、翻译、编辑、导出全部本地完成。只有两件事用到网络：第一次下载模型，以及你自己选择配置云端翻译。'),
       ('一部两小时的电影要多久？', 'M 系列芯片上用 Large v3 Turbo 大约 3～6 分钟，加上本地翻译再多几分钟。整季批量可以挂着跑。'),
       ('生成的字幕准吗？', '识别用 whisper large 系列模型；时间轴用语音活动检测和响度分析贴回真实说话时刻，参数对照六部整片的官方字幕校准。每个文件跑完会附带质检结论。'),
       ('影片里已经有字幕轨了呢？', '会自动发现内嵌的文本字幕轨并优先使用，直接进入翻译，比识别更快更准。图形字幕（PGS/VobSub）除外。'),
       ('支持 Intel Mac 吗？', '目前不支持。本地识别依赖 Apple Silicon 的 Metal 加速，Intel 机器上慢到不实用。'),
       ('Windows 提示"未知发布者"？', 'Windows 版尚未购买代码签名证书，SmartScreen 会对新程序提示。点"更多信息 → 仍要运行"即可；校验值在 GitHub Releases 页。'),
       ('和在线字幕生成网站比有什么区别？', '在线工具要你上传整部影片、按分钟计费、通常有时长上限。Wave Subs 不上传、不收费、不限时长，速度取决于你的电脑。')],
  footer_issue='反馈问题', footer_changelog='更新日志',
)

T['en'] = dict(
  title="Wave Subs — Can't find subtitles? Generate SRT/ASS subtitles from any video with local AI, translated, free & offline (Mac / Windows)",
  description='Wave Subs generates SRT / ASS subtitles directly from a video using local AI, then translates them into your language. Runs entirely on your computer — no internet needed, free forever. macOS (Apple Silicon) and Windows.',
  keywords='generate subtitles from video,AI subtitle generator,auto subtitles,translate subtitles,SRT generator,ASS subtitles,offline subtitle software,local subtitle generator,whisper mac app,movie subtitle generator,anime subtitles,free subtitle maker',
  og_title="Wave Subs — Can't find subtitles? Let local AI generate and translate them",
  nav=['How it works', 'Translation', 'Privacy', 'Requirements', 'Download', 'FAQ'],
  h1="Can't find subtitles?", h2='Let local AI generate them from the video',
  lead='Wave Subs recognizes the dialogue in a video, generates SRT / ASS subtitles, and translates them into your language. Everything runs on your own computer — no internet needed, completely free.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Fully open source', 'Completely free', 'No in-app purchases'],
  pills=['Generate SRT / ASS subtitles', 'Auto-translate into your language (29)', 'Local AI · no internet needed'],
  hero_note='The editor: fix text, adjust timing, click any line to hear it',
  how_h2='From video to subtitles in three steps', how_sub='No subtitle sites to search, no video to upload, no account to create.',
  steps=[('Drop in the video', 'MKV, MP4, MOV, TS — all fine. If the file already has an embedded subtitle track, it is detected and used directly.'),
         ('Local AI recognizes and aligns', 'whisper.cpp recognizes the dialogue on your machine with automatic language detection; timing is refined to when lines are actually spoken, tuned against the official subtitles of six full-length films.'),
         ('Translate and export', 'Translated into your language, exported as SRT or ASS next to the video — any player reads it. A quality verdict tells you where to take a look.')],
  tr_h2='Auto-translated into your language',
  tr_p='29 target languages: Chinese (Simplified and Traditional), English, Japanese, Korean, French, German, Spanish, Portuguese, Russian, Thai, Vietnamese, Indonesian, Malay and more. A locally running Qwen3 model by default — free and offline — or any OpenAI-compatible API.',
  tr_li=['Glossary: pin names and terms so a whole season stays consistent', 'Bilingual or translation-only export, your choice', 'Changing the model or glossary retranslates strictly — old output is never mixed in'],
  ed_h2='An editor with video preview',
  ed_p="Fix text, adjust timing, insert, delete, merge, undo, autosave. Click any line to hear exactly how it was said — even HEVC or DTS files a browser can't play, thanks to the bundled ffmpeg. Quality findings are clickable.",
  ba_h2='Run a whole season, tune each episode',
  ba_p='Drop in a folder. Every file follows the shared settings; override the subtitle track, audio track or engine only where needed. Each finished row carries its quality verdict.',
  pr_h2='Why local', pr_sub='Online subtitle tools ask you to upload the whole film. Wave Subs sends nothing anywhere.',
  pr_cards=[('No internet needed', 'Recognition, alignment, translation, editing and export all happen locally. Once models are downloaded, it works with the network off.'),
            ('Videos are never uploaded', 'No account, no analytics, no server. It is a program that runs on your computer.'),
            ('Free forever', 'No quotas, no subscription. Only if you choose to plug in a cloud translation provider does that provider bill you.')],
  pr_link='Full privacy policy',
  req_h2='Models and system requirements', req_sub='Models download in one click inside the app, which labels each one fit / usable / too heavy for the memory in your machine. The same rules, as a table:',
  req_asr='Speech recognition models (whisper)', req_llm='Local translation models (Qwen3)',
  req_cols=['Model', 'Download', 'RAM in use', 'Quality', 'Speed', 'Mac: recommended RAM', 'Windows PC: recommended RAM'],
  req_combo_h3='Recommended combinations', req_combo_cols=['Your machine', 'Recognition', 'Translation', 'Notes'],
  req_combo=[('Mac 8 GB', 'Small or Large v3 Turbo', 'Qwen3 1.7B', 'Works; Turbo runs on 8 GB but keep other apps closed'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'The default — the balance of quality and speed'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'Best recognition, more accurate translation'),
             ('Mac 48 GB or more', 'Large v3', 'Qwen3 32B', 'Best translation quality, slower'),
             ('Windows PC 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'CPU only — the same model typically takes several times longer than on Apple Silicon'),
             ('Windows PC 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Larger models run; allow extra time')],
  req_notes=['"RAM in use" is what the loaded model actually occupies; recognition and translation run one after the other, never both at once.',
             'Apple Silicon uses Metal acceleration; the Windows build runs on the CPU (BLAS) and is noticeably slower than a comparable Mac. Intel Macs are not supported.',
             'On M-series chips, a two-hour film takes about 3–6 minutes with Large v3 Turbo, plus a few more minutes for local translation.'],
  dl_h2='Download', dl_sub=f'Version {VERSION}. ffmpeg and whisper.cpp are bundled — install and go, nothing else to set up.',
  mac_req='macOS 12 or later · <strong>Apple Silicon only</strong> (M1 and later) · Notarized by Apple',
  win_req='Windows 10 or later · x64 · 16 GB RAM recommended',
  dl_mac='Download DMG', dl_mac_alt='or ZIP archive', dl_win='Download installer', dl_win_alt='or portable ZIP',
  dl_note="On first launch you'll be guided to download a recognition model (no network needed after that). Open-source component licenses: <a href=\"" + REPO + "/blob/main/THIRD-PARTY-LICENSES.md\">THIRD-PARTY-LICENSES</a>.",
  faq_h2='Frequently asked questions',
  faq=[('Which videos can it generate subtitles for?', "MKV, MP4, MOV, TS, AVI and other common formats; HEVC, DTS and TrueHD streams a browser can't play are fine too, because the bundled ffmpeg decodes everything. Audio-only files work as well."),
       ('Which languages are supported?', 'Recognition covers the nearly 100 languages whisper supports, with automatic detection; there are 29 translation targets; the interface comes in 32 languages.'),
       ('Does it really work without internet?', 'Recognition, alignment, translation, editing and export all run locally. Only two things touch the network: the one-time model download, and cloud translation if you choose to configure it.'),
       ('How long does a two-hour film take?', 'Roughly 3–6 minutes with Large v3 Turbo on an M-series chip, plus a few more for local translation. Batch a whole season and let it run.'),
       ('How accurate are the subtitles?', 'Recognition uses the whisper large family; timing is snapped to when lines are actually spoken using voice activity detection and loudness analysis, tuned against official subtitles of six full films. Every file gets a quality verdict.'),
       ('What if the video already has a subtitle track?', 'Embedded text tracks are detected and preferred, skipping straight to translation — faster and more accurate than recognition. Image-based subtitles (PGS/VobSub) are the exception.'),
       ('Is there an Intel Mac version?', 'Not currently. Local recognition relies on Metal acceleration on Apple Silicon; on Intel it would be too slow to be useful.'),
       ('Windows says "unknown publisher"?', "The Windows build isn't code-signed yet, so SmartScreen warns about new programs. Click \"More info → Run anyway\"; checksums are on the GitHub Releases page."),
       ('How is this different from online subtitle generators?', 'Online tools make you upload the whole film, charge per minute and cap the length. Wave Subs uploads nothing, costs nothing and has no length limit — speed depends on your machine.')],
  footer_issue='Report an issue', footer_changelog='Changelog',
)

T['ja'] = dict(
  title='Wave Subs — 字幕が見つからない？ローカル AI が動画から SRT/ASS 字幕を生成・翻訳。無料・オフライン（Mac / Windows）',
  description='Wave Subs はローカル AI で動画から直接 SRT / ASS 字幕を生成し、あなたの言語に自動翻訳します。すべてあなたのパソコンで完結、インターネット不要、ずっと無料。macOS（Apple Silicon）と Windows に対応。',
  keywords='動画 字幕 生成,字幕 自動生成,AI 字幕,字幕 翻訳,SRT 作成,ASS 字幕,オフライン 字幕,whisper mac,映画 字幕,アニメ 字幕,無料 字幕ソフト',
  og_title='Wave Subs — 字幕が見つからない？ローカル AI が生成して翻訳',
  nav=['使い方', '翻訳', 'プライバシー', '動作環境', 'ダウンロード', 'よくある質問'],
  h1='字幕が見つからない？', h2='ローカル AI に動画から直接作らせよう',
  lead='Wave Subs は動画のセリフを認識して SRT / ASS 字幕を生成し、あなたの言語に自動翻訳します。すべてあなたのパソコンの中で完結——インターネット不要、完全無料。',
  cta_mac='macOS 版', cta_win='Windows 版', cta_note=['完全オープンソース', '完全無料', 'アプリ内課金なし'],
  pills=['SRT / ASS 字幕を生成', 'あなたの言語に自動翻訳（29 言語）', 'ローカル AI · ネット不要'],
  hero_note='字幕エディタ：テキスト修正、タイミング調整、行をクリックしてそのセリフを再生',
  how_h2='3 ステップで動画から字幕へ', how_sub='字幕サイトを探す必要も、動画をアップロードする必要も、アカウント登録も不要。',
  steps=[('動画をドロップ', 'MKV、MP4、MOV、TS に対応。内蔵の字幕トラックがあれば自動検出してそのまま使います。'),
         ('ローカル AI が認識して合わせる', 'whisper.cpp があなたのパソコンでセリフを認識し、言語を自動判定。タイミングは実際に話している瞬間に補正（長編 6 作品の公式字幕で校正済み）。'),
         ('翻訳して書き出し', 'あなたの言語に翻訳し、SRT または ASS を動画の隣に保存。どのプレーヤーでも読めます。品質チェックの結果付き。')],
  tr_h2='あなたの言語に自動翻訳',
  tr_p='翻訳先は 29 言語：日本語、英語、中国語（簡体・繁体）、韓国語、フランス語、ドイツ語、スペイン語、ポルトガル語、ロシア語、タイ語、ベトナム語、インドネシア語、マレー語など。標準はローカルで動く Qwen3 モデル——無料でオフライン。OpenAI 互換 API も接続可能。',
  tr_li=['用語集：人名・地名の訳語を固定し、シーズン全体で統一', '二言語または訳文のみで書き出し', 'モデルや用語集を変えたら厳密に再翻訳。古い訳文は混ぜない'],
  ed_h2='動画プレビュー付きエディタ',
  ed_p='テキスト修正、タイミング調整、追加・削除・結合、取り消し、自動保存。行をクリックすればそのセリフをその場で再生——ブラウザで再生できない HEVC や DTS も、同梱の ffmpeg がデコードします。品質チェックの指摘はクリックで移動。',
  ba_h2='シーズンまるごと一括、話ごとに個別調整',
  ba_p='フォルダをドロップすれば全ファイルに同じ設定。必要なファイルだけ字幕トラック・音声トラック・エンジンを変更できます。完了した行には品質判定が付きます。',
  pr_h2='ローカルにこだわる理由', pr_sub='オンラインの字幕ツールは動画全体のアップロードを求めます。Wave Subs は何も送信しません。',
  pr_cards=[('ネット不要', '認識・同期・翻訳・編集・書き出しはすべてローカル。モデルをダウンロードすれば、オフラインでも動きます。'),
            ('動画は送信しない', 'アカウントも解析もサーバーもありません。あなたのパソコンで動くただのプログラムです。'),
            ('ずっと無料', '回数制限も会員制もなし。クラウド翻訳を自分で接続した場合のみ、そのサービスから課金されます。')],
  pr_link='プライバシーポリシー全文（英語）',
  req_h2='モデルと動作環境', req_sub='モデルはアプリ内でワンクリックでダウンロード。アプリはお使いの機種のメモリに応じて各モデルを「最適 / 使用可 / 動作不可」と表示します。同じルールを表にしました。',
  req_asr='音声認識モデル（whisper）', req_llm='ローカル翻訳モデル（Qwen3）',
  req_cols=['モデル', 'ダウンロード', '使用メモリ', '品質', '速度', 'Mac 推奨メモリ', 'Windows PC 推奨メモリ'],
  req_combo_h3='おすすめの組み合わせ', req_combo_cols=['お使いの機種', '認識', '翻訳', '備考'],
  req_combo=[('Mac 8 GB', 'Small または Large v3 Turbo', 'Qwen3 1.7B', '十分使えます。Turbo は 8 GB でも動きますが他のアプリは閉じて'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', '標準のおすすめ。品質と速度のバランス点'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', '認識品質が最高、翻訳もより正確'),
             ('Mac 48 GB 以上', 'Large v3', 'Qwen3 32B', '翻訳品質が最高、速度は遅め'),
             ('Windows PC 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'CPU のみの処理。同じモデルでも Apple Silicon の数倍の時間'),
             ('Windows PC 32 GB', 'Large v3 Turbo', 'Qwen3 8B', '大きなモデルも動きますが時間に余裕を')],
  req_notes=['「使用メモリ」はモデル読み込み後の実占有量。認識と翻訳は順に実行され、同時には占有しません。',
             'Apple Silicon は Metal で高速化。Windows 版は CPU（BLAS）処理のため同クラスの Mac よりかなり遅く、Intel Mac は非対応です。',
             'M シリーズでは 2 時間の映画を Large v3 Turbo で約 3〜6 分で認識、ローカル翻訳にさらに数分。'],
  dl_h2='ダウンロード', dl_sub=f'バージョン {VERSION}。ffmpeg と whisper.cpp は同梱済み。インストールしてすぐ使えます。',
  mac_req='macOS 12 以降 · <strong>Apple Silicon のみ</strong>（M1 以降）· Apple 公証済み',
  win_req='Windows 10 以降 · x64 · メモリ 16 GB 推奨',
  dl_mac='DMG をダウンロード', dl_mac_alt='または ZIP', dl_win='インストーラをダウンロード', dl_win_alt='またはポータブル版 ZIP',
  dl_note='初回起動時に音声認識モデルのダウンロードを案内します（その後はネット不要）。オープンソースのライセンス：<a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>。',
  faq_h2='よくある質問',
  faq=[('どんな動画に対応していますか？', 'MKV、MP4、MOV、TS、AVI など一般的な形式に対応。ブラウザで再生できない HEVC、DTS、TrueHD も、同梱の ffmpeg がすべてデコードします。音声のみのファイルも可。'),
       ('対応言語は？', '認識は whisper が対応する約 100 言語を自動判定。翻訳先は 29 言語、UI は 32 言語。'),
       ('本当にネット不要？', '認識・同期・翻訳・編集・書き出しはすべてローカル。ネットを使うのは初回のモデルダウンロードと、自分で設定した場合のクラウド翻訳だけです。'),
       ('2 時間の映画はどれくらいかかる？', 'M シリーズなら Large v3 Turbo で約 3〜6 分、ローカル翻訳にさらに数分。シーズンまるごと一括処理して放置できます。'),
       ('Intel Mac は？', '現在非対応です。ローカル認識は Apple Silicon の Metal 加速に依存しており、Intel では実用にならない速度です。')],
  footer_issue='問題を報告', footer_changelog='更新履歴',
)

T['ko'] = dict(
  title='Wave Subs — 자막을 못 찾겠다면? 로컬 AI가 영상에서 SRT/ASS 자막을 만들고 번역. 무료·오프라인 (Mac / Windows)',
  description='Wave Subs는 로컬 AI로 영상에서 바로 SRT / ASS 자막을 만들고 내 언어로 자동 번역합니다. 모든 작업이 내 컴퓨터에서 끝나며 인터넷이 필요 없고 영원히 무료입니다. macOS(Apple Silicon)와 Windows 지원.',
  keywords='영상 자막 생성,자동 자막,AI 자막,자막 번역,SRT 생성,ASS 자막,오프라인 자막,whisper mac,영화 자막,애니 자막,무료 자막 프로그램',
  og_title='Wave Subs — 자막을 못 찾겠다면? 로컬 AI가 만들고 번역합니다',
  nav=['사용법', '번역', '개인정보', '요구 사양', '다운로드', '자주 묻는 질문'],
  h1='자막을 못 찾겠다면?', h2='로컬 AI가 영상에서 바로 만들어 드립니다',
  lead='Wave Subs는 영상의 대사를 인식해 SRT / ASS 자막을 만들고 내 언어로 자동 번역합니다. 모든 작업이 내 컴퓨터 안에서 끝납니다 — 인터넷 불필요, 완전 무료.',
  cta_mac='macOS용', cta_win='Windows용', cta_note=['완전 오픈소스', '완전 무료', '인앱 결제 없음'],
  pills=['SRT / ASS 자막 생성', '내 언어로 자동 번역 (29개)', '로컬 AI · 인터넷 불필요'],
  hero_note='자막 편집기: 텍스트 수정, 타이밍 조정, 아무 줄이나 클릭해 그 대사 듣기',
  how_h2='세 단계로 영상에서 자막까지', how_sub='자막 사이트를 뒤질 필요도, 영상을 올릴 필요도, 계정을 만들 필요도 없습니다.',
  steps=[('영상 끌어다 놓기', 'MKV, MP4, MOV, TS 모두 지원. 내장 자막 트랙이 있으면 자동으로 찾아 바로 사용합니다.'),
         ('로컬 AI가 인식하고 맞추기', 'whisper.cpp가 내 컴퓨터에서 대사를 인식하고 언어를 자동 감지. 타이밍은 실제 말하는 순간에 맞춰 보정(장편 6편의 공식 자막으로 조정).'),
         ('번역하고 내보내기', '내 언어로 번역해 SRT 또는 ASS로 영상 옆에 저장. 어떤 플레이어든 읽습니다. 품질 판정도 함께.')],
  tr_h2='내 언어로 자동 번역',
  tr_p='29개 대상 언어: 한국어, 영어, 일본어, 중국어(간체·번체), 프랑스어, 독일어, 스페인어, 포르투갈어, 러시아어, 태국어, 베트남어, 인도네시아어, 말레이어 등. 기본은 로컬 Qwen3 모델 — 무료, 오프라인. OpenAI 호환 API도 연결 가능.',
  tr_li=['용어집: 인명·지명 번역을 고정해 시즌 전체를 일관되게', '이중 언어 또는 번역만 내보내기', '모델이나 용어집을 바꾸면 엄격하게 다시 번역, 예전 번역을 섞지 않음'],
  ed_h2='영상 미리보기가 있는 편집기',
  ed_p='텍스트 수정, 타이밍 조정, 추가·삭제·병합, 실행 취소, 자동 저장. 아무 줄이나 클릭하면 그 대사를 바로 들을 수 있습니다 — 브라우저가 못 여는 HEVC, DTS도 내장 ffmpeg가 디코딩. 품질 검사 결과는 클릭하면 해당 줄로 이동.',
  ba_h2='시즌 전체를 한 번에, 회차별로 따로 조정',
  ba_p='폴더를 끌어다 놓으면 모든 파일에 같은 설정. 필요한 파일만 자막 트랙·오디오 트랙·엔진을 따로 지정. 완료된 줄마다 품질 판정.',
  pr_h2='왜 로컬인가', pr_sub='온라인 자막 도구는 영상 전체를 올리라고 합니다. Wave Subs는 아무것도 보내지 않습니다.',
  pr_cards=[('인터넷 불필요', '인식·정렬·번역·편집·내보내기 모두 로컬. 모델을 내려받은 뒤에는 오프라인에서도 동작.'),
            ('영상은 업로드되지 않음', '계정도, 통계도, 서버도 없습니다. 내 컴퓨터에서 도는 프로그램일 뿐.'),
            ('영원히 무료', '횟수 제한도 구독도 없음. 클라우드 번역을 직접 연결한 경우에만 그 서비스가 요금을 청구.')],
  pr_link='개인정보 처리방침 전문 (영어)',
  req_h2='모델과 요구 사양', req_sub='모델은 앱 안에서 원클릭으로 내려받고, 앱이 내 컴퓨터 메모리에 맞춰 각 모델을 "적합 / 사용 가능 / 실행 불가"로 표시합니다. 같은 규칙을 표로 정리했습니다.',
  req_asr='음성 인식 모델 (whisper)', req_llm='로컬 번역 모델 (Qwen3)',
  req_cols=['모델', '다운로드', '사용 메모리', '품질', '속도', 'Mac 권장 메모리', 'Windows PC 권장 메모리'],
  req_combo_h3='추천 조합', req_combo_cols=['내 컴퓨터', '인식', '번역', '비고'],
  req_combo=[('Mac 8 GB', 'Small 또는 Large v3 Turbo', 'Qwen3 1.7B', '충분히 사용 가능. Turbo는 8 GB에서도 돌지만 다른 앱은 닫아 두세요'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', '기본 추천. 품질과 속도의 균형점'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', '최고의 인식 품질, 더 정확한 번역'),
             ('Mac 48 GB 이상', 'Large v3', 'Qwen3 32B', '최고의 번역 품질, 속도는 느림'),
             ('Windows PC 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'CPU 전용. 같은 모델도 Apple Silicon보다 수 배 오래 걸림'),
             ('Windows PC 32 GB', 'Large v3 Turbo', 'Qwen3 8B', '큰 모델도 돌지만 시간을 넉넉히')],
  req_notes=['"사용 메모리"는 모델을 불러온 뒤 실제 점유량. 인식과 번역은 차례로 실행되어 동시에 점유하지 않습니다.',
             'Apple Silicon은 Metal 가속. Windows 버전은 CPU(BLAS) 연산이라 같은 급 Mac보다 눈에 띄게 느리며, Intel Mac은 지원하지 않습니다.',
             'M 시리즈 칩에서 2시간 영화는 Large v3 Turbo로 약 3~6분, 로컬 번역에 몇 분 추가.'],
  dl_h2='다운로드', dl_sub=f'버전 {VERSION}. ffmpeg와 whisper.cpp가 내장되어 설치 후 바로 사용.',
  mac_req='macOS 12 이상 · <strong>Apple Silicon 전용</strong>(M1 이후) · Apple 공증 완료',
  win_req='Windows 10 이상 · x64 · 16 GB 메모리 권장',
  dl_mac='DMG 다운로드', dl_mac_alt='또는 ZIP', dl_win='설치 프로그램 다운로드', dl_win_alt='또는 포터블 ZIP',
  dl_note='첫 실행 시 음성 인식 모델 다운로드를 안내합니다(이후 인터넷 불필요). 오픈소스 라이선스: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='자주 묻는 질문',
  faq=[('어떤 영상에 자막을 만들 수 있나요?', 'MKV, MP4, MOV, TS, AVI 등 일반 형식 모두. 브라우저가 못 여는 HEVC, DTS, TrueHD도 내장 ffmpeg가 모두 디코딩합니다. 오디오 파일도 됩니다.'),
       ('지원 언어는?', '인식은 whisper가 지원하는 약 100개 언어를 자동 감지. 번역 대상 29개, 인터페이스 32개 언어.'),
       ('정말 인터넷이 필요 없나요?', '인식·정렬·번역·편집·내보내기 모두 로컬. 네트워크는 첫 모델 다운로드와, 직접 설정한 경우의 클라우드 번역에만 씁니다.'),
       ('2시간 영화는 얼마나 걸리나요?', 'M 시리즈 칩에서 Large v3 Turbo로 약 3~6분, 로컬 번역에 몇 분 추가. 시즌 전체를 일괄로 걸어 두세요.'),
       ('Intel Mac은요?', '현재 미지원. 로컬 인식이 Apple Silicon의 Metal 가속에 의존해 Intel에서는 실용적이지 않습니다.')],
  footer_issue='문제 신고', footer_changelog='변경 내역',
)

T['fr'] = dict(
  title="Wave Subs — Pas de sous-titres ? L'IA locale les génère depuis la vidéo (SRT/ASS) et les traduit. Gratuit, hors ligne (Mac / Windows)",
  description="Wave Subs génère des sous-titres SRT / ASS directement à partir d'une vidéo grâce à une IA locale, puis les traduit dans votre langue. Tout tourne sur votre ordinateur — sans internet, gratuit pour toujours. macOS (Apple Silicon) et Windows.",
  keywords='générer sous-titres vidéo,sous-titres automatiques,IA sous-titres,traduire sous-titres,générateur SRT,sous-titres ASS,logiciel sous-titres hors ligne,whisper mac,sous-titres film,sous-titres anime,gratuit',
  og_title="Wave Subs — Pas de sous-titres ? L'IA locale les génère et les traduit",
  nav=['Fonctionnement', 'Traduction', 'Confidentialité', 'Configuration', 'Télécharger', 'FAQ'],
  h1='Pas de sous-titres ?', h2="Laissez l'IA locale les générer depuis la vidéo",
  lead='Wave Subs reconnaît les dialogues d\'une vidéo, génère des sous-titres SRT / ASS et les traduit dans votre langue. Tout se passe sur votre ordinateur — sans internet, entièrement gratuit.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Entièrement open source', 'Entièrement gratuit', 'Sans achats intégrés'],
  pills=['Sous-titres SRT / ASS', 'Traduction automatique dans votre langue (29)', 'IA locale · sans internet'],
  hero_note="L'éditeur : corrigez le texte, ajustez le minutage, cliquez sur une ligne pour l'écouter",
  how_h2='De la vidéo aux sous-titres en trois étapes', how_sub='Pas de site de sous-titres à fouiller, pas de vidéo à envoyer, pas de compte à créer.',
  steps=[('Déposez la vidéo', 'MKV, MP4, MOV, TS. Une piste de sous-titres intégrée est détectée et utilisée directement.'),
         ("L'IA locale reconnaît et synchronise", 'whisper.cpp reconnaît les dialogues sur votre machine, détection automatique de la langue ; le minutage est calé sur le moment où les répliques sont vraiment prononcées (réglé sur les sous-titres officiels de six longs métrages).'),
         ('Traduisez et exportez', 'Traduits dans votre langue, exportés en SRT ou ASS à côté de la vidéo — lisibles par tout lecteur. Un verdict de qualité indique où regarder.')],
  tr_h2='Traduits automatiquement dans votre langue',
  tr_p='29 langues cibles : français, anglais, chinois (simplifié/traditionnel), japonais, coréen, allemand, espagnol, portugais, russe, thaï, vietnamien, indonésien, malais… Par défaut un modèle Qwen3 local — gratuit et hors ligne — ou toute API compatible OpenAI.',
  tr_li=['Glossaire : fixez la traduction des noms pour toute une saison', 'Export bilingue ou traduction seule', 'Changer de modèle ou de glossaire retraduit strictement, sans mélanger l\'ancien résultat'],
  ed_h2='Un éditeur avec aperçu vidéo',
  ed_p="Corrigez le texte, ajustez le minutage, insérez, supprimez, fusionnez, annulez, sauvegarde automatique. Cliquez sur une ligne pour entendre exactement la réplique — même en HEVC ou DTS, grâce au ffmpeg intégré. Les constats de qualité sont cliquables.",
  ba_h2='Une saison entière, chaque épisode réglable',
  ba_p='Déposez un dossier ; tous les fichiers suivent les mêmes réglages, et chacun peut avoir sa propre piste de sous-titres, piste audio ou moteur. Chaque ligne terminée porte son verdict de qualité.',
  pr_h2='Pourquoi le local', pr_sub='Les outils en ligne exigent d\'envoyer tout le film. Wave Subs n\'envoie rien.',
  pr_cards=[('Sans internet', 'Reconnaissance, synchronisation, traduction, édition et export se font en local. Modèles téléchargés, tout fonctionne hors ligne.'),
            ('Vidéos jamais envoyées', 'Ni compte, ni statistiques, ni serveur. C\'est un programme qui tourne sur votre ordinateur.'),
            ('Gratuit pour toujours', 'Ni quota, ni abonnement. Seul un service de traduction cloud que vous auriez branché vous-même vous facturerait.')],
  pr_link='Politique de confidentialité complète (anglais)',
  req_h2='Modèles et configuration requise', req_sub='Les modèles se téléchargent en un clic dans l\'app, qui indique pour chacun « adapté / utilisable / trop lourd » selon la mémoire de votre machine. Les mêmes règles, en tableau :',
  req_asr='Modèles de reconnaissance vocale (whisper)', req_llm='Modèles de traduction locale (Qwen3)',
  req_cols=['Modèle', 'Téléchargement', 'RAM utilisée', 'Qualité', 'Vitesse', 'Mac : RAM conseillée', 'PC Windows : RAM conseillée'],
  req_combo_h3='Combinaisons conseillées', req_combo_cols=['Votre machine', 'Reconnaissance', 'Traduction', 'Remarques'],
  req_combo=[('Mac 8 Go', 'Small ou Large v3 Turbo', 'Qwen3 1.7B', 'Suffisant ; Turbo tourne avec 8 Go en fermant les autres apps'),
             ('Mac 16 Go', 'Large v3 Turbo', 'Qwen3 8B', 'Le réglage par défaut, équilibre qualité/vitesse'),
             ('Mac 32 Go', 'Large v3', 'Qwen3 14B', 'Meilleure reconnaissance, traduction plus précise'),
             ('Mac 48 Go et plus', 'Large v3', 'Qwen3 32B', 'Meilleure traduction, plus lent'),
             ('PC Windows 16 Go', 'Large v3 Turbo', 'Qwen3 4B', 'CPU seul : le même modèle prend plusieurs fois plus de temps que sur Apple Silicon'),
             ('PC Windows 32 Go', 'Large v3 Turbo', 'Qwen3 8B', 'Les gros modèles tournent, prévoyez du temps')],
  req_notes=['« RAM utilisée » est l\'occupation réelle du modèle chargé ; reconnaissance et traduction s\'enchaînent, jamais en même temps.',
             'Apple Silicon utilise l\'accélération Metal ; la version Windows tourne sur le CPU (BLAS) et est nettement plus lente qu\'un Mac équivalent. Les Mac Intel ne sont pas pris en charge.',
             'Sur puce M, un film de deux heures prend environ 3 à 6 minutes avec Large v3 Turbo, plus quelques minutes de traduction locale.'],
  dl_h2='Téléchargement', dl_sub=f'Version {VERSION}. ffmpeg et whisper.cpp sont inclus — rien d\'autre à installer.',
  mac_req='macOS 12 ou ultérieur · <strong>Apple Silicon uniquement</strong> (M1 et suivants) · Notarisé par Apple',
  win_req='Windows 10 ou ultérieur · x64 · 16 Go de RAM conseillés',
  dl_mac='Télécharger le DMG', dl_mac_alt='ou l\'archive ZIP', dl_win='Télécharger l\'installateur', dl_win_alt='ou le ZIP portable',
  dl_note='Au premier lancement, un modèle de reconnaissance vous est proposé (plus besoin de réseau ensuite). Licences des composants open source : <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Questions fréquentes',
  faq=[('Quelles vidéos sont prises en charge ?', 'MKV, MP4, MOV, TS, AVI et les formats courants ; HEVC, DTS et TrueHD, que les navigateurs ne lisent pas, passent aussi grâce au ffmpeg intégré. Les fichiers audio seuls fonctionnent.'),
       ('Quelles langues ?', 'La reconnaissance couvre la centaine de langues de whisper avec détection automatique ; 29 langues cibles pour la traduction ; interface en 32 langues.'),
       ('Vraiment sans internet ?', 'Tout se fait en local. Seuls le téléchargement initial des modèles et, si vous le configurez, la traduction cloud utilisent le réseau.'),
       ('Combien de temps pour un film de deux heures ?', 'Environ 3 à 6 minutes avec Large v3 Turbo sur puce M, plus quelques minutes de traduction locale. Lancez une saison entière en lot.'),
       ('Et les Mac Intel ?', 'Pas pour le moment : la reconnaissance locale dépend de l\'accélération Metal des puces Apple ; sur Intel ce serait trop lent.')],
  footer_issue='Signaler un problème', footer_changelog='Journal des modifications',
)

T['de'] = dict(
  title='Wave Subs — Keine Untertitel? Lokale KI erstellt SRT/ASS-Untertitel aus dem Video und übersetzt sie. Kostenlos, offline (Mac / Windows)',
  description='Wave Subs erstellt SRT / ASS-Untertitel direkt aus einem Video mit lokaler KI und übersetzt sie in deine Sprache. Läuft komplett auf deinem Rechner — ohne Internet, für immer kostenlos. macOS (Apple Silicon) und Windows.',
  keywords='untertitel aus video erstellen,automatische untertitel,KI untertitel,untertitel übersetzen,SRT generator,ASS untertitel,untertitel software offline,whisper mac,film untertitel,anime untertitel,kostenlos',
  og_title='Wave Subs — Keine Untertitel? Lokale KI erstellt und übersetzt sie',
  nav=['So geht\'s', 'Übersetzung', 'Datenschutz', 'Systemvoraussetzungen', 'Download', 'FAQ'],
  h1='Keine Untertitel gefunden?', h2='Lass lokale KI sie direkt aus dem Video erstellen',
  lead='Wave Subs erkennt die Dialoge eines Videos, erstellt SRT / ASS-Untertitel und übersetzt sie in deine Sprache. Alles auf deinem eigenen Rechner — ohne Internet, komplett kostenlos.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Vollständig Open Source', 'Komplett kostenlos', 'Keine In-App-Käufe'],
  pills=['SRT / ASS-Untertitel erstellen', 'Automatisch in deine Sprache (29)', 'Lokale KI · kein Internet nötig'],
  hero_note='Der Editor: Text korrigieren, Timing anpassen, eine Zeile anklicken und anhören',
  how_h2='In drei Schritten vom Video zu Untertiteln', how_sub='Keine Untertitelseiten durchsuchen, kein Video hochladen, kein Konto anlegen.',
  steps=[('Video ablegen', 'MKV, MP4, MOV, TS. Eine eingebettete Untertitelspur wird erkannt und direkt verwendet.'),
         ('Lokale KI erkennt und synchronisiert', 'whisper.cpp erkennt die Dialoge auf deinem Rechner mit automatischer Spracherkennung; das Timing wird auf den tatsächlichen Sprechzeitpunkt gesetzt (abgestimmt an offiziellen Untertiteln von sechs Spielfilmen).'),
         ('Übersetzen und exportieren', 'In deine Sprache übersetzt, als SRT oder ASS neben dem Video gespeichert — jeder Player liest es. Ein Qualitätsurteil zeigt, wo du hinschauen solltest.')],
  tr_h2='Automatisch in deine Sprache übersetzt',
  tr_p='29 Zielsprachen: Deutsch, Englisch, Chinesisch (vereinfacht/traditionell), Japanisch, Koreanisch, Französisch, Spanisch, Portugiesisch, Russisch, Thai, Vietnamesisch, Indonesisch, Malaiisch … Standardmäßig ein lokales Qwen3-Modell — kostenlos und offline — oder jede OpenAI-kompatible API.',
  tr_li=['Glossar: Namen und Begriffe festlegen, damit eine Staffel konsistent bleibt', 'Zweisprachig oder nur Übersetzung exportieren', 'Neues Modell oder Glossar → strikte Neuübersetzung, nichts Altes wird vermischt'],
  ed_h2='Ein Editor mit Videovorschau',
  ed_p='Text korrigieren, Timing anpassen, einfügen, löschen, zusammenführen, rückgängig machen, automatisch speichern. Eine Zeile anklicken und genau hören, wie sie gesprochen wurde — auch bei HEVC oder DTS dank des mitgelieferten ffmpeg. Qualitätsbefunde sind anklickbar.',
  ba_h2='Ganze Staffel im Stapel, jede Folge einzeln einstellbar',
  ba_p='Ordner ablegen; alle Dateien folgen denselben Einstellungen, einzelne können Untertitelspur, Tonspur oder Engine überschreiben. Jede fertige Zeile trägt ihr Qualitätsurteil.',
  pr_h2='Warum lokal', pr_sub='Online-Tools verlangen den Upload des ganzen Films. Wave Subs sendet nichts.',
  pr_cards=[('Kein Internet nötig', 'Erkennung, Synchronisation, Übersetzung, Bearbeitung und Export laufen lokal. Sind die Modelle geladen, geht alles auch offline.'),
            ('Videos werden nie hochgeladen', 'Kein Konto, keine Statistik, kein Server. Ein Programm, das auf deinem Rechner läuft.'),
            ('Für immer kostenlos', 'Keine Limits, kein Abo. Nur ein selbst eingerichteter Cloud-Übersetzungsdienst rechnet mit dir ab.')],
  pr_link='Vollständige Datenschutzerklärung (Englisch)',
  req_h2='Modelle und Systemvoraussetzungen', req_sub='Modelle lädst du mit einem Klick in der App, die jedes Modell nach dem Arbeitsspeicher deines Rechners als „passend / nutzbar / zu schwer“ kennzeichnet. Dieselben Regeln als Tabelle:',
  req_asr='Spracherkennungsmodelle (whisper)', req_llm='Lokale Übersetzungsmodelle (Qwen3)',
  req_cols=['Modell', 'Download', 'RAM im Betrieb', 'Qualität', 'Tempo', 'Mac: empfohlener RAM', 'Windows-PC: empfohlener RAM'],
  req_combo_h3='Empfohlene Kombinationen', req_combo_cols=['Dein Rechner', 'Erkennung', 'Übersetzung', 'Hinweis'],
  req_combo=[('Mac 8 GB', 'Small oder Large v3 Turbo', 'Qwen3 1.7B', 'Reicht; Turbo läuft mit 8 GB, andere Apps besser schließen'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Die Standardempfehlung, Balance aus Qualität und Tempo'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'Beste Erkennung, genauere Übersetzung'),
             ('Mac ab 48 GB', 'Large v3', 'Qwen3 32B', 'Beste Übersetzung, langsamer'),
             ('Windows-PC 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'Nur CPU: dasselbe Modell braucht meist ein Vielfaches der Zeit von Apple Silicon'),
             ('Windows-PC 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Große Modelle laufen, Zeit einplanen')],
  req_notes=['„RAM im Betrieb“ ist die tatsächliche Belegung des geladenen Modells; Erkennung und Übersetzung laufen nacheinander, nie gleichzeitig.',
             'Apple Silicon nutzt Metal-Beschleunigung; die Windows-Version rechnet auf der CPU (BLAS) und ist deutlich langsamer als ein vergleichbarer Mac. Intel-Macs werden nicht unterstützt.',
             'Auf M-Chips dauert ein zweistündiger Film mit Large v3 Turbo etwa 3–6 Minuten, plus einige Minuten lokale Übersetzung.'],
  dl_h2='Download', dl_sub=f'Version {VERSION}. ffmpeg und whisper.cpp sind enthalten — installieren und loslegen.',
  mac_req='macOS 12 oder neuer · <strong>nur Apple Silicon</strong> (ab M1) · von Apple beglaubigt',
  win_req='Windows 10 oder neuer · x64 · 16 GB RAM empfohlen',
  dl_mac='DMG laden', dl_mac_alt='oder ZIP-Archiv', dl_win='Installer laden', dl_win_alt='oder portables ZIP',
  dl_note='Beim ersten Start wirst du durch den Download eines Erkennungsmodells geführt (danach kein Netz mehr nötig). Lizenzen der Open-Source-Komponenten: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Häufige Fragen',
  faq=[('Welche Videos gehen?', 'MKV, MP4, MOV, TS, AVI und andere gängige Formate; auch HEVC, DTS und TrueHD, die Browser nicht abspielen, weil das mitgelieferte ffmpeg alles dekodiert. Reine Audiodateien ebenfalls.'),
       ('Welche Sprachen?', 'Die Erkennung deckt die knapp 100 Sprachen von whisper mit automatischer Erkennung ab; 29 Zielsprachen für die Übersetzung; Oberfläche in 32 Sprachen.'),
       ('Wirklich ohne Internet?', 'Alles läuft lokal. Nur der erste Modell-Download und – falls eingerichtet – die Cloud-Übersetzung nutzen das Netz.'),
       ('Wie lange dauert ein zweistündiger Film?', 'Etwa 3–6 Minuten mit Large v3 Turbo auf einem M-Chip, plus einige Minuten lokale Übersetzung. Eine ganze Staffel im Stapel laufen lassen.'),
       ('Gibt es eine Intel-Mac-Version?', 'Derzeit nicht. Die lokale Erkennung braucht die Metal-Beschleunigung von Apple Silicon; auf Intel wäre es zu langsam.')],
  footer_issue='Problem melden', footer_changelog='Änderungsprotokoll',
)

T['ru'] = dict(
  title='Wave Subs — Нет субтитров? Локальный ИИ создаёт субтитры SRT/ASS из видео и переводит их. Бесплатно, офлайн (Mac / Windows)',
  description='Wave Subs создаёт субтитры SRT / ASS прямо из видео с помощью локального ИИ и переводит их на ваш язык. Всё работает на вашем компьютере — без интернета, бесплатно навсегда. macOS (Apple Silicon) и Windows.',
  keywords='создать субтитры из видео,автоматические субтитры,ИИ субтитры,перевод субтитров,генератор SRT,субтитры ASS,субтитры офлайн,whisper mac,субтитры к фильму,субтитры аниме,бесплатно',
  og_title='Wave Subs — Нет субтитров? Локальный ИИ создаст и переведёт их',
  nav=['Как это работает', 'Перевод', 'Приватность', 'Требования', 'Скачать', 'Вопросы'],
  h1='Не нашли субтитры?', h2='Пусть локальный ИИ создаст их прямо из видео',
  lead='Wave Subs распознаёт диалоги в видео, создаёт субтитры SRT / ASS и переводит их на ваш язык. Всё происходит на вашем компьютере — без интернета, полностью бесплатно.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Полностью открытый код', 'Полностью бесплатно', 'Без встроенных покупок'],
  pills=['Субтитры SRT / ASS', 'Автоперевод на ваш язык (29 языков)', 'Локальный ИИ · без интернета'],
  hero_note='Редактор: правьте текст и тайминг, нажмите на строку, чтобы услышать её',
  how_h2='От видео к субтитрам за три шага', how_sub='Не нужно искать сайты с субтитрами, загружать видео или создавать аккаунт.',
  steps=[('Перетащите видео', 'MKV, MP4, MOV, TS. Встроенная дорожка субтитров обнаруживается и используется напрямую.'),
         ('Локальный ИИ распознаёт и выравнивает', 'whisper.cpp распознаёт диалоги на вашем компьютере с автоопределением языка; тайминг подгоняется к моменту реальной речи (настроен по официальным субтитрам шести полнометражных фильмов).'),
         ('Переведите и экспортируйте', 'Перевод на ваш язык, экспорт в SRT или ASS рядом с видео — читается любым плеером. Оценка качества подскажет, куда взглянуть.')],
  tr_h2='Автоматический перевод на ваш язык',
  tr_p='29 языков: русский, английский, китайский (упрощённый/традиционный), японский, корейский, французский, немецкий, испанский, португальский, тайский, вьетнамский, индонезийский, малайский… По умолчанию локальная модель Qwen3 — бесплатно и офлайн, либо любой OpenAI-совместимый API.',
  tr_li=['Глоссарий: закрепите перевод имён, чтобы весь сезон был единообразным', 'Экспорт двуязычный или только перевод', 'Смена модели или глоссария — строгий повторный перевод без смешивания старого'],
  ed_h2='Редактор с видеопревью',
  ed_p='Правка текста, тайминга, вставка, удаление, объединение, отмена, автосохранение. Нажмите на строку, чтобы услышать, как именно она произнесена — даже HEVC и DTS, которые браузер не воспроизводит, благодаря встроенному ffmpeg. Замечания о качестве кликабельны.',
  ba_h2='Весь сезон пакетом, каждая серия по-своему',
  ba_p='Перетащите папку; все файлы используют общие настройки, а для отдельных можно задать свою дорожку субтитров, звука или движок. Каждая готовая строка несёт оценку качества.',
  pr_h2='Почему локально', pr_sub='Онлайн-сервисы требуют загрузить весь фильм. Wave Subs ничего не отправляет.',
  pr_cards=[('Без интернета', 'Распознавание, выравнивание, перевод, редактирование и экспорт — всё локально. После загрузки моделей работает без сети.'),
            ('Видео никогда не загружается', 'Нет аккаунтов, аналитики и серверов. Это просто программа на вашем компьютере.'),
            ('Бесплатно навсегда', 'Без лимитов и подписок. Платить придётся только облачному переводчику, если вы сами его подключите.')],
  pr_link='Полная политика конфиденциальности (англ.)',
  req_h2='Модели и системные требования', req_sub='Модели скачиваются в один клик внутри приложения, которое помечает каждую как «подходит / можно / слишком тяжёлая» по объёму памяти вашего компьютера. Те же правила в таблице:',
  req_asr='Модели распознавания речи (whisper)', req_llm='Локальные модели перевода (Qwen3)',
  req_cols=['Модель', 'Загрузка', 'Память при работе', 'Качество', 'Скорость', 'Mac: рекомендуемая память', 'ПК Windows: рекомендуемая память'],
  req_combo_h3='Рекомендуемые сочетания', req_combo_cols=['Ваш компьютер', 'Распознавание', 'Перевод', 'Примечание'],
  req_combo=[('Mac 8 ГБ', 'Small или Large v3 Turbo', 'Qwen3 1.7B', 'Достаточно; Turbo работает на 8 ГБ, но закройте другие программы'),
             ('Mac 16 ГБ', 'Large v3 Turbo', 'Qwen3 8B', 'Рекомендация по умолчанию — баланс качества и скорости'),
             ('Mac 32 ГБ', 'Large v3', 'Qwen3 14B', 'Лучшее распознавание, точнее перевод'),
             ('Mac 48 ГБ и больше', 'Large v3', 'Qwen3 32B', 'Лучший перевод, медленнее'),
             ('ПК Windows 16 ГБ', 'Large v3 Turbo', 'Qwen3 4B', 'Только CPU: та же модель работает в несколько раз дольше, чем на Apple Silicon'),
             ('ПК Windows 32 ГБ', 'Large v3 Turbo', 'Qwen3 8B', 'Большие модели работают, заложите время')],
  req_notes=['«Память при работе» — фактическое потребление загруженной модели; распознавание и перевод идут по очереди, а не одновременно.',
             'Apple Silicon использует ускорение Metal; версия для Windows считает на CPU (BLAS) и заметно медленнее сопоставимого Mac. Intel Mac не поддерживаются.',
             'На чипах M двухчасовой фильм занимает около 3–6 минут с Large v3 Turbo плюс несколько минут локального перевода.'],
  dl_h2='Скачать', dl_sub=f'Версия {VERSION}. ffmpeg и whisper.cpp уже внутри — установите и работайте.',
  mac_req='macOS 12 и новее · <strong>только Apple Silicon</strong> (M1 и новее) · нотаризовано Apple',
  win_req='Windows 10 и новее · x64 · рекомендуется 16 ГБ ОЗУ',
  dl_mac='Скачать DMG', dl_mac_alt='или ZIP-архив', dl_win='Скачать установщик', dl_win_alt='или портативный ZIP',
  dl_note='При первом запуске будет предложено скачать модель распознавания (дальше сеть не нужна). Лицензии открытых компонентов: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Частые вопросы',
  faq=[('Для каких видео это работает?', 'MKV, MP4, MOV, TS, AVI и другие распространённые форматы; HEVC, DTS и TrueHD, которые браузер не воспроизводит, тоже подходят — встроенный ffmpeg декодирует всё. Аудиофайлы тоже.'),
       ('Какие языки поддерживаются?', 'Распознавание — почти 100 языков whisper с автоопределением; 29 языков перевода; интерфейс на 32 языках.'),
       ('Правда без интернета?', 'Всё локально. Сеть нужна только для первой загрузки моделей и для облачного перевода, если вы сами его настроите.'),
       ('Сколько занимает двухчасовой фильм?', 'Около 3–6 минут с Large v3 Turbo на чипе M плюс несколько минут локального перевода. Запустите сезон пакетом и займитесь своими делами.'),
       ('А Intel Mac?', 'Пока нет: локальное распознавание опирается на ускорение Metal в Apple Silicon, на Intel это было бы слишком медленно.')],
  footer_issue='Сообщить о проблеме', footer_changelog='История изменений',
)

T['id'] = dict(
  title='Wave Subs — Tak ada subtitle? AI lokal membuat subtitle SRT/ASS dari video dan menerjemahkannya. Gratis, offline (Mac / Windows)',
  description='Wave Subs membuat subtitle SRT / ASS langsung dari video dengan AI lokal, lalu menerjemahkannya ke bahasa Anda. Semua berjalan di komputer Anda — tanpa internet, gratis selamanya. macOS (Apple Silicon) dan Windows.',
  keywords='buat subtitle dari video,subtitle otomatis,AI subtitle,terjemahkan subtitle,generator SRT,subtitle ASS,aplikasi subtitle offline,whisper mac,subtitle film,subtitle anime,gratis',
  og_title='Wave Subs — Tak ada subtitle? AI lokal yang membuat dan menerjemahkannya',
  nav=['Cara kerja', 'Terjemahan', 'Privasi', 'Spesifikasi', 'Unduh', 'FAQ'],
  h1='Tak menemukan subtitle?', h2='Biarkan AI lokal membuatnya langsung dari video',
  lead='Wave Subs mengenali dialog dalam video, membuat subtitle SRT / ASS, dan menerjemahkannya ke bahasa Anda. Semuanya di komputer Anda sendiri — tanpa internet, sepenuhnya gratis.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Sepenuhnya open source', 'Sepenuhnya gratis', 'Tanpa pembelian dalam aplikasi'],
  pills=['Subtitle SRT / ASS', 'Terjemahan otomatis ke bahasa Anda (29)', 'AI lokal · tanpa internet'],
  hero_note='Editor: perbaiki teks, atur waktu, klik baris mana pun untuk mendengarnya',
  how_h2='Tiga langkah dari video ke subtitle', how_sub='Tanpa mencari situs subtitle, tanpa mengunggah video, tanpa membuat akun.',
  steps=[('Seret video', 'MKV, MP4, MOV, TS semuanya bisa. Trek subtitle tertanam akan terdeteksi dan langsung dipakai.'),
         ('AI lokal mengenali dan menyelaraskan', 'whisper.cpp mengenali dialog di komputer Anda dengan deteksi bahasa otomatis; waktu disesuaikan ke saat kalimat benar-benar diucapkan (dikalibrasi dengan subtitle resmi enam film panjang).'),
         ('Terjemahkan dan ekspor', 'Diterjemahkan ke bahasa Anda, diekspor sebagai SRT atau ASS di samping video — terbaca oleh pemutar apa pun. Penilaian kualitas menunjukkan bagian yang perlu dilihat.')],
  tr_h2='Diterjemahkan otomatis ke bahasa Anda',
  tr_p='29 bahasa target: Indonesia, Inggris, Mandarin (sederhana/tradisional), Jepang, Korea, Prancis, Jerman, Spanyol, Portugis, Rusia, Thai, Vietnam, Melayu, dan lainnya. Bawaan memakai model Qwen3 lokal — gratis dan offline — atau API apa pun yang kompatibel dengan OpenAI.',
  tr_li=['Glosarium: kunci terjemahan nama agar satu musim konsisten', 'Ekspor dwibahasa atau terjemahan saja', 'Ganti model atau glosarium = terjemah ulang ketat, hasil lama tak dicampur'],
  ed_h2='Editor dengan pratinjau video',
  ed_p='Perbaiki teks, atur waktu, sisipkan, hapus, gabungkan, urungkan, simpan otomatis. Klik baris mana pun untuk mendengar persis kalimatnya — bahkan HEVC atau DTS yang tak bisa diputar browser, berkat ffmpeg bawaan. Temuan kualitas bisa diklik.',
  ba_h2='Satu musim sekaligus, tiap episode bisa diatur sendiri',
  ba_p='Seret satu folder; semua berkas mengikuti pengaturan yang sama, dan berkas tertentu bisa memakai trek subtitle, trek audio, atau mesin berbeda. Setiap baris yang selesai membawa penilaian kualitasnya.',
  pr_h2='Mengapa lokal', pr_sub='Alat subtitle online meminta Anda mengunggah seluruh film. Wave Subs tidak mengirim apa pun.',
  pr_cards=[('Tanpa internet', 'Pengenalan, penyelarasan, terjemahan, penyuntingan, dan ekspor semuanya lokal. Setelah model diunduh, tetap bekerja tanpa jaringan.'),
            ('Video tak pernah diunggah', 'Tanpa akun, tanpa analitik, tanpa server. Hanya program yang berjalan di komputer Anda.'),
            ('Gratis selamanya', 'Tanpa kuota, tanpa langganan. Hanya penyedia terjemahan cloud yang Anda pasang sendiri yang menagih Anda.')],
  pr_link='Kebijakan privasi lengkap (Inggris)',
  req_h2='Model dan spesifikasi sistem', req_sub='Model diunduh sekali klik di dalam aplikasi, yang menandai tiap model "cocok / bisa / terlalu berat" sesuai memori komputer Anda. Aturan yang sama dalam tabel:',
  req_asr='Model pengenalan suara (whisper)', req_llm='Model terjemahan lokal (Qwen3)',
  req_cols=['Model', 'Unduhan', 'RAM saat dipakai', 'Kualitas', 'Kecepatan', 'Mac: RAM disarankan', 'PC Windows: RAM disarankan'],
  req_combo_h3='Kombinasi yang disarankan', req_combo_cols=['Komputer Anda', 'Pengenalan', 'Terjemahan', 'Catatan'],
  req_combo=[('Mac 8 GB', 'Small atau Large v3 Turbo', 'Qwen3 1.7B', 'Cukup; Turbo jalan di 8 GB, tutup aplikasi lain'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Rekomendasi bawaan, seimbang antara kualitas dan kecepatan'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'Pengenalan terbaik, terjemahan lebih akurat'),
             ('Mac 48 GB ke atas', 'Large v3', 'Qwen3 32B', 'Terjemahan terbaik, lebih lambat'),
             ('PC Windows 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'Hanya CPU: model yang sama biasanya butuh beberapa kali lipat waktu Apple Silicon'),
             ('PC Windows 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Model besar bisa jalan, sediakan waktu')],
  req_notes=['"RAM saat dipakai" adalah pemakaian nyata setelah model dimuat; pengenalan dan terjemahan berjalan bergantian, tidak bersamaan.',
             'Apple Silicon memakai akselerasi Metal; versi Windows berjalan di CPU (BLAS) dan jauh lebih lambat dari Mac sekelas. Mac Intel tidak didukung.',
             'Di chip seri M, film dua jam butuh sekitar 3–6 menit dengan Large v3 Turbo, ditambah beberapa menit terjemahan lokal.'],
  dl_h2='Unduh', dl_sub=f'Versi {VERSION}. ffmpeg dan whisper.cpp sudah disertakan — pasang dan langsung pakai.',
  mac_req='macOS 12 atau lebih baru · <strong>hanya Apple Silicon</strong> (M1 ke atas) · dinotarisasi Apple',
  win_req='Windows 10 atau lebih baru · x64 · RAM 16 GB disarankan',
  dl_mac='Unduh DMG', dl_mac_alt='atau arsip ZIP', dl_win='Unduh installer', dl_win_alt='atau ZIP portabel',
  dl_note='Saat pertama dibuka Anda akan dipandu mengunduh model pengenalan (setelah itu tak perlu jaringan). Lisensi komponen sumber terbuka: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Pertanyaan umum',
  faq=[('Video apa saja yang bisa?', 'MKV, MP4, MOV, TS, AVI dan format umum lainnya; HEVC, DTS, TrueHD yang tak bisa diputar browser juga bisa, karena ffmpeg bawaan mendekode semuanya. Berkas audio saja juga bisa.'),
       ('Bahasa apa yang didukung?', 'Pengenalan mencakup hampir 100 bahasa whisper dengan deteksi otomatis; 29 bahasa target terjemahan; antarmuka 32 bahasa.'),
       ('Benar-benar tanpa internet?', 'Semua berjalan lokal. Jaringan hanya dipakai untuk unduhan model pertama kali dan terjemahan cloud jika Anda memasangnya sendiri.'),
       ('Berapa lama film dua jam?', 'Sekitar 3–6 menit dengan Large v3 Turbo di chip seri M, ditambah beberapa menit terjemahan lokal. Jalankan satu musim sekaligus.'),
       ('Mac Intel?', 'Belum. Pengenalan lokal bergantung pada akselerasi Metal di Apple Silicon; di Intel terlalu lambat.')],
  footer_issue='Laporkan masalah', footer_changelog='Catatan perubahan',
)

T['ms'] = dict(
  title='Wave Subs — Tiada sari kata? AI tempatan menjana sari kata SRT/ASS daripada video dan menterjemahnya. Percuma, luar talian (Mac / Windows)',
  description='Wave Subs menjana sari kata SRT / ASS terus daripada video dengan AI tempatan, kemudian menterjemahnya ke bahasa anda. Semuanya berjalan pada komputer anda — tanpa internet, percuma selamanya. macOS (Apple Silicon) dan Windows.',
  keywords='jana sari kata daripada video,sari kata automatik,AI sari kata,terjemah sari kata,penjana SRT,sari kata ASS,perisian sari kata luar talian,whisper mac,sari kata filem,sari kata anime,percuma',
  og_title='Wave Subs — Tiada sari kata? AI tempatan menjana dan menterjemahnya',
  nav=['Cara guna', 'Terjemahan', 'Privasi', 'Keperluan', 'Muat turun', 'Soalan lazim'],
  h1='Tidak jumpa sari kata?', h2='Biar AI tempatan menjananya terus daripada video',
  lead='Wave Subs mengecam dialog dalam video, menjana sari kata SRT / ASS dan menterjemahnya ke bahasa anda. Semuanya pada komputer anda sendiri — tanpa internet, percuma sepenuhnya.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Sumber terbuka sepenuhnya', 'Percuma sepenuhnya', 'Tiada pembelian dalam apl'],
  pills=['Sari kata SRT / ASS', 'Terjemahan automatik ke bahasa anda (29)', 'AI tempatan · tanpa internet'],
  hero_note='Editor: betulkan teks, laras masa, klik mana-mana baris untuk mendengarnya',
  how_h2='Tiga langkah daripada video ke sari kata', how_sub='Tanpa mencari laman sari kata, tanpa memuat naik video, tanpa mencipta akaun.',
  steps=[('Seret video', 'MKV, MP4, MOV, TS semuanya boleh. Trek sari kata terbenam dikesan dan digunakan terus.'),
         ('AI tempatan mengecam dan menjajarkan', 'whisper.cpp mengecam dialog pada komputer anda dengan pengesanan bahasa automatik; masa diselaraskan dengan saat dialog benar-benar dituturkan (ditala dengan sari kata rasmi enam filem penuh).'),
         ('Terjemah dan eksport', 'Diterjemah ke bahasa anda, dieksport sebagai SRT atau ASS di sebelah video — boleh dibaca mana-mana pemain. Penilaian kualiti menunjukkan bahagian yang perlu dilihat.')],
  tr_h2='Diterjemah secara automatik ke bahasa anda',
  tr_p='29 bahasa sasaran: Melayu, Inggeris, Cina (ringkas/tradisional), Jepun, Korea, Perancis, Jerman, Sepanyol, Portugis, Rusia, Thai, Vietnam, Indonesia dan banyak lagi. Secara lalai model Qwen3 tempatan — percuma dan luar talian — atau mana-mana API serasi OpenAI.',
  tr_li=['Glosari: tetapkan terjemahan nama supaya satu musim konsisten', 'Eksport dwibahasa atau terjemahan sahaja', 'Tukar model atau glosari = terjemah semula ketat, hasil lama tidak dicampur'],
  ed_h2='Editor dengan pratonton video',
  ed_p='Betulkan teks, laras masa, sisip, padam, gabung, buat asal, simpan automatik. Klik mana-mana baris untuk mendengar tepat bagaimana ia dituturkan — walaupun HEVC atau DTS yang pelayar tidak boleh main, berkat ffmpeg yang disertakan. Penemuan kualiti boleh diklik.',
  ba_h2='Satu musim sekali gus, setiap episod boleh dilaras',
  ba_p='Seret satu folder; semua fail mengikut tetapan yang sama, dan fail tertentu boleh mengatasi trek sari kata, trek audio atau enjin. Setiap baris yang siap membawa penilaian kualitinya.',
  pr_h2='Mengapa tempatan', pr_sub='Alat sari kata dalam talian mahu anda memuat naik seluruh filem. Wave Subs tidak menghantar apa-apa.',
  pr_cards=[('Tanpa internet', 'Pengecaman, penjajaran, terjemahan, suntingan dan eksport semuanya tempatan. Selepas model dimuat turun, ia berfungsi tanpa rangkaian.'),
            ('Video tidak pernah dimuat naik', 'Tiada akaun, tiada analitik, tiada pelayan. Hanya program yang berjalan pada komputer anda.'),
            ('Percuma selamanya', 'Tiada kuota, tiada langganan. Hanya penyedia terjemahan awan yang anda pasang sendiri akan mengecaj anda.')],
  pr_link='Dasar privasi penuh (Inggeris)',
  req_h2='Model dan keperluan sistem', req_sub='Model dimuat turun dengan satu klik dalam aplikasi, yang menanda setiap model "sesuai / boleh / terlalu berat" mengikut memori komputer anda. Peraturan yang sama dalam jadual:',
  req_asr='Model pengecaman suara (whisper)', req_llm='Model terjemahan tempatan (Qwen3)',
  req_cols=['Model', 'Muat turun', 'RAM semasa digunakan', 'Kualiti', 'Kelajuan', 'Mac: RAM disyorkan', 'PC Windows: RAM disyorkan'],
  req_combo_h3='Gabungan yang disyorkan', req_combo_cols=['Komputer anda', 'Pengecaman', 'Terjemahan', 'Nota'],
  req_combo=[('Mac 8 GB', 'Small atau Large v3 Turbo', 'Qwen3 1.7B', 'Mencukupi; Turbo boleh jalan pada 8 GB, tutup aplikasi lain'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Syor lalai, keseimbangan kualiti dan kelajuan'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'Pengecaman terbaik, terjemahan lebih tepat'),
             ('Mac 48 GB ke atas', 'Large v3', 'Qwen3 32B', 'Terjemahan terbaik, lebih perlahan'),
             ('PC Windows 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'CPU sahaja: model yang sama biasanya mengambil masa beberapa kali ganda berbanding Apple Silicon'),
             ('PC Windows 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Model besar boleh jalan, peruntukkan masa')],
  req_notes=['"RAM semasa digunakan" ialah penggunaan sebenar selepas model dimuatkan; pengecaman dan terjemahan berjalan bergilir, bukan serentak.',
             'Apple Silicon menggunakan pecutan Metal; versi Windows berjalan pada CPU (BLAS) dan jauh lebih perlahan daripada Mac setara. Mac Intel tidak disokong.',
             'Pada cip siri M, filem dua jam mengambil kira-kira 3–6 minit dengan Large v3 Turbo, ditambah beberapa minit terjemahan tempatan.'],
  dl_h2='Muat turun', dl_sub=f'Versi {VERSION}. ffmpeg dan whisper.cpp disertakan — pasang dan terus guna.',
  mac_req='macOS 12 atau lebih baharu · <strong>Apple Silicon sahaja</strong> (M1 ke atas) · dinotari Apple',
  win_req='Windows 10 atau lebih baharu · x64 · RAM 16 GB disyorkan',
  dl_mac='Muat turun DMG', dl_mac_alt='atau arkib ZIP', dl_win='Muat turun pemasang', dl_win_alt='atau ZIP mudah alih',
  dl_note='Pada pelancaran pertama anda akan dipandu memuat turun model pengecaman (selepas itu tidak perlu rangkaian). Lesen komponen sumber terbuka: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Soalan lazim',
  faq=[('Video apa yang boleh?', 'MKV, MP4, MOV, TS, AVI dan format biasa lain; HEVC, DTS, TrueHD yang pelayar tidak boleh main pun boleh, kerana ffmpeg yang disertakan menyahkod semuanya. Fail audio sahaja juga boleh.'),
       ('Bahasa apa yang disokong?', 'Pengecaman meliputi hampir 100 bahasa whisper dengan pengesanan automatik; 29 bahasa sasaran terjemahan; antara muka 32 bahasa.'),
       ('Betul-betul tanpa internet?', 'Semuanya tempatan. Rangkaian hanya digunakan untuk muat turun model kali pertama dan terjemahan awan jika anda memasangnya sendiri.'),
       ('Berapa lama filem dua jam?', 'Kira-kira 3–6 minit dengan Large v3 Turbo pada cip siri M, ditambah beberapa minit terjemahan tempatan. Jalankan satu musim sekali gus.'),
       ('Mac Intel?', 'Belum. Pengecaman tempatan bergantung pada pecutan Metal Apple Silicon; pada Intel terlalu perlahan.')],
  footer_issue='Laporkan masalah', footer_changelog='Log perubahan',
)

T['vi'] = dict(
  title='Wave Subs — Không có phụ đề? AI cục bộ tạo phụ đề SRT/ASS từ video và dịch. Miễn phí, ngoại tuyến (Mac / Windows)',
  description='Wave Subs tạo phụ đề SRT / ASS trực tiếp từ video bằng AI cục bộ rồi dịch sang ngôn ngữ của bạn. Chạy hoàn toàn trên máy của bạn — không cần internet, miễn phí mãi mãi. macOS (Apple Silicon) và Windows.',
  keywords='tạo phụ đề từ video,phụ đề tự động,AI phụ đề,dịch phụ đề,tạo SRT,phụ đề ASS,phần mềm phụ đề ngoại tuyến,whisper mac,phụ đề phim,phụ đề anime,miễn phí',
  og_title='Wave Subs — Không có phụ đề? Để AI cục bộ tạo và dịch',
  nav=['Cách dùng', 'Dịch', 'Riêng tư', 'Cấu hình', 'Tải về', 'Hỏi đáp'],
  h1='Không tìm thấy phụ đề?', h2='Để AI cục bộ tạo trực tiếp từ video',
  lead='Wave Subs nhận dạng lời thoại trong video, tạo phụ đề SRT / ASS và dịch sang ngôn ngữ của bạn. Tất cả ngay trên máy của bạn — không cần internet, hoàn toàn miễn phí.',
  cta_mac='macOS', cta_win='Windows', cta_note=['Mã nguồn mở hoàn toàn', 'Miễn phí hoàn toàn', 'Không mua trong ứng dụng'],
  pills=['Phụ đề SRT / ASS', 'Tự động dịch sang ngôn ngữ của bạn (29)', 'AI cục bộ · không cần mạng'],
  hero_note='Trình chỉnh sửa: sửa chữ, chỉnh thời gian, bấm vào dòng nào cũng nghe được',
  how_h2='Ba bước từ video ra phụ đề', how_sub='Không cần tìm trang phụ đề, không tải video lên, không tạo tài khoản.',
  steps=[('Kéo video vào', 'MKV, MP4, MOV, TS đều được. Rãnh phụ đề có sẵn trong video được phát hiện và dùng ngay.'),
         ('AI cục bộ nhận dạng và căn chỉnh', 'whisper.cpp nhận dạng lời thoại trên máy bạn, tự phát hiện ngôn ngữ; thời gian khớp với đúng lúc lời thoại được nói (tinh chỉnh theo phụ đề chính thức của sáu bộ phim dài).'),
         ('Dịch và xuất', 'Dịch sang ngôn ngữ của bạn, xuất SRT hoặc ASS đặt cạnh video — trình phát nào cũng đọc được. Đánh giá chất lượng cho biết chỗ cần xem.')],
  tr_h2='Tự động dịch sang ngôn ngữ của bạn',
  tr_p='29 ngôn ngữ đích: Việt, Anh, Trung (giản thể/phồn thể), Nhật, Hàn, Pháp, Đức, Tây Ban Nha, Bồ Đào Nha, Nga, Thái, Indonesia, Mã Lai… Mặc định dùng mô hình Qwen3 cục bộ — miễn phí và ngoại tuyến — hoặc bất kỳ API tương thích OpenAI nào.',
  tr_li=['Bảng thuật ngữ: cố định cách dịch tên để cả mùa nhất quán', 'Xuất song ngữ hoặc chỉ bản dịch', 'Đổi mô hình hay thuật ngữ là dịch lại nghiêm ngặt, không trộn kết quả cũ'],
  ed_h2='Trình chỉnh sửa có xem trước video',
  ed_p='Sửa chữ, chỉnh thời gian, chèn, xóa, gộp, hoàn tác, tự lưu. Bấm vào dòng nào cũng nghe đúng câu đó — kể cả HEVC hay DTS trình duyệt không phát được, nhờ ffmpeg đi kèm. Phát hiện chất lượng bấm được.',
  ba_h2='Cả mùa một lượt, từng tập chỉnh riêng',
  ba_p='Kéo cả thư mục vào; mọi tệp dùng chung thiết lập, tệp riêng có thể chọn rãnh phụ đề, rãnh âm thanh hoặc công cụ khác. Mỗi dòng xong đều có đánh giá chất lượng.',
  pr_h2='Vì sao chọn cục bộ', pr_sub='Công cụ phụ đề trực tuyến bắt bạn tải cả phim lên. Wave Subs không gửi gì đi.',
  pr_cards=[('Không cần internet', 'Nhận dạng, căn chỉnh, dịch, chỉnh sửa, xuất — tất cả tại chỗ. Tải mô hình xong là dùng được khi mất mạng.'),
            ('Video không bao giờ được tải lên', 'Không tài khoản, không thống kê, không máy chủ. Chỉ là một chương trình chạy trên máy bạn.'),
            ('Miễn phí mãi mãi', 'Không giới hạn, không thuê bao. Chỉ nhà cung cấp dịch đám mây do bạn tự kết nối mới tính phí.')],
  pr_link='Chính sách quyền riêng tư đầy đủ (tiếng Anh)',
  req_h2='Mô hình và yêu cầu cấu hình', req_sub='Mô hình tải một chạm trong ứng dụng; ứng dụng đánh dấu từng mô hình "phù hợp / dùng được / quá nặng" theo RAM máy bạn. Cùng quy tắc đó, dạng bảng:',
  req_asr='Mô hình nhận dạng giọng nói (whisper)', req_llm='Mô hình dịch cục bộ (Qwen3)',
  req_cols=['Mô hình', 'Dung lượng tải', 'RAM khi chạy', 'Chất lượng', 'Tốc độ', 'Mac: RAM đề xuất', 'PC Windows: RAM đề xuất'],
  req_combo_h3='Tổ hợp đề xuất', req_combo_cols=['Máy của bạn', 'Nhận dạng', 'Dịch', 'Ghi chú'],
  req_combo=[('Mac 8 GB', 'Small hoặc Large v3 Turbo', 'Qwen3 1.7B', 'Đủ dùng; Turbo chạy được với 8 GB nhưng hãy đóng ứng dụng khác'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Đề xuất mặc định, cân bằng chất lượng và tốc độ'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'Nhận dạng tốt nhất, dịch chính xác hơn'),
             ('Mac 48 GB trở lên', 'Large v3', 'Qwen3 32B', 'Dịch tốt nhất, chậm hơn'),
             ('PC Windows 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'Chỉ CPU: cùng mô hình thường mất gấp vài lần thời gian so với Apple Silicon'),
             ('PC Windows 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'Mô hình lớn chạy được, cần thêm thời gian')],
  req_notes=['"RAM khi chạy" là mức chiếm dụng thực tế sau khi nạp mô hình; nhận dạng và dịch chạy lần lượt, không đồng thời.',
             'Apple Silicon dùng tăng tốc Metal; bản Windows chạy trên CPU (BLAS) nên chậm hơn rõ rệt so với Mac cùng tầm. Không hỗ trợ Mac Intel.',
             'Trên chip dòng M, phim hai tiếng mất khoảng 3–6 phút với Large v3 Turbo, cộng vài phút dịch cục bộ.'],
  dl_h2='Tải về', dl_sub=f'Phiên bản {VERSION}. ffmpeg và whisper.cpp đã đi kèm — cài là dùng.',
  mac_req='macOS 12 trở lên · <strong>chỉ Apple Silicon</strong> (M1 trở lên) · đã được Apple công chứng',
  win_req='Windows 10 trở lên · x64 · khuyến nghị 16 GB RAM',
  dl_mac='Tải DMG', dl_mac_alt='hoặc bản ZIP', dl_win='Tải trình cài đặt', dl_win_alt='hoặc ZIP di động',
  dl_note='Lần mở đầu tiên sẽ hướng dẫn tải mô hình nhận dạng (sau đó không cần mạng). Giấy phép mã nguồn mở: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>.',
  faq_h2='Câu hỏi thường gặp',
  faq=[('Tạo phụ đề được cho video nào?', 'MKV, MP4, MOV, TS, AVI và các định dạng phổ biến; HEVC, DTS, TrueHD trình duyệt không phát được cũng ổn vì ffmpeg đi kèm giải mã được tất cả. Tệp chỉ có âm thanh cũng được.'),
       ('Hỗ trợ ngôn ngữ nào?', 'Nhận dạng gần 100 ngôn ngữ của whisper với tự phát hiện; 29 ngôn ngữ đích để dịch; giao diện 32 ngôn ngữ.'),
       ('Thật sự không cần internet?', 'Mọi thứ chạy cục bộ. Mạng chỉ dùng cho lần tải mô hình đầu tiên và dịch đám mây nếu bạn tự cấu hình.'),
       ('Phim hai tiếng mất bao lâu?', 'Khoảng 3–6 phút với Large v3 Turbo trên chip dòng M, cộng vài phút dịch cục bộ. Chạy cả mùa hàng loạt rồi để đó.'),
       ('Mac Intel thì sao?', 'Hiện chưa. Nhận dạng cục bộ dựa vào tăng tốc Metal của Apple Silicon; trên Intel sẽ quá chậm.')],
  footer_issue='Báo lỗi', footer_changelog='Nhật ký thay đổi',
)

T['th'] = dict(
  title='Wave Subs — หาซับไม่เจอ? AI ในเครื่องสร้างซับ SRT/ASS จากวิดีโอแล้วแปลให้ ฟรี ออฟไลน์ (Mac / Windows)',
  description='Wave Subs สร้างซับไตเติล SRT / ASS จากวิดีโอโดยตรงด้วย AI ในเครื่อง แล้วแปลเป็นภาษาของคุณ ทำงานทั้งหมดบนคอมพิวเตอร์ของคุณ — ไม่ต้องต่ออินเทอร์เน็ต ฟรีตลอดไป macOS (Apple Silicon) และ Windows',
  keywords='สร้างซับไตเติลจากวิดีโอ,ซับอัตโนมัติ,AI ซับไตเติล,แปลซับ,สร้าง SRT,ซับ ASS,โปรแกรมซับออฟไลน์,whisper mac,ซับหนัง,ซับอนิเมะ,ฟรี',
  og_title='Wave Subs — หาซับไม่เจอ? ให้ AI ในเครื่องสร้างและแปลให้',
  nav=['วิธีใช้', 'การแปล', 'ความเป็นส่วนตัว', 'สเปกที่ต้องใช้', 'ดาวน์โหลด', 'คำถามที่พบบ่อย'],
  h1='หาซับไตเติลไม่เจอ?', h2='ให้ AI ในเครื่องสร้างจากวิดีโอโดยตรง',
  lead='Wave Subs จับบทพูดในวิดีโอ สร้างซับ SRT / ASS แล้วแปลเป็นภาษาของคุณ ทำทั้งหมดบนคอมพิวเตอร์ของคุณเอง — ไม่ต้องต่อเน็ต ฟรีทั้งหมด',
  cta_mac='macOS', cta_win='Windows', cta_note=['โอเพนซอร์สทั้งหมด', 'ฟรีทั้งหมด', 'ไม่มีการซื้อในแอป'],
  pills=['สร้างซับ SRT / ASS', 'แปลเป็นภาษาของคุณอัตโนมัติ (29 ภาษา)', 'AI ในเครื่อง · ไม่ต้องต่อเน็ต'],
  hero_note='ตัวแก้ไข: แก้ข้อความ ปรับเวลา คลิกบรรทัดไหนก็ฟังได้',
  how_h2='สามขั้นตอนจากวิดีโอสู่ซับ', how_sub='ไม่ต้องหาเว็บซับ ไม่ต้องอัปโหลดวิดีโอ ไม่ต้องสมัครบัญชี',
  steps=[('ลากวิดีโอมาวาง', 'MKV, MP4, MOV, TS ใช้ได้หมด ถ้ามีแทร็กซับฝังอยู่จะตรวจพบและใช้ทันที'),
         ('AI ในเครื่องจับบทพูดและจัดเวลา', 'whisper.cpp จับบทพูดบนเครื่องของคุณ ตรวจภาษาอัตโนมัติ เวลาถูกปรับให้ตรงกับจังหวะที่พูดจริง (ปรับจูนด้วยซับทางการของหนังยาวหกเรื่อง)'),
         ('แปลแล้วส่งออก', 'แปลเป็นภาษาของคุณ ส่งออกเป็น SRT หรือ ASS ไว้ข้างวิดีโอ — เครื่องเล่นไหนก็อ่านได้ ผลตรวจคุณภาพบอกว่าต้องดูตรงไหน')],
  tr_h2='แปลเป็นภาษาของคุณอัตโนมัติ',
  tr_p='ภาษาปลายทาง 29 ภาษา: ไทย อังกฤษ จีน (ตัวย่อ/ตัวเต็ม) ญี่ปุ่น เกาหลี ฝรั่งเศส เยอรมัน สเปน โปรตุเกส รัสเซีย เวียดนาม อินโดนีเซีย มาเลย์ และอื่น ๆ ค่าเริ่มต้นใช้โมเดล Qwen3 ในเครื่อง — ฟรีและออฟไลน์ — หรือเชื่อม API ที่เข้ากับ OpenAI ได้ทุกเจ้า',
  tr_li=['อภิธานศัพท์: กำหนดคำแปลของชื่อให้ตรงกันทั้งซีซัน', 'ส่งออกสองภาษาหรือเฉพาะคำแปล', 'เปลี่ยนโมเดลหรืออภิธานศัพท์จะแปลใหม่อย่างเข้มงวด ไม่ปนผลเก่า'],
  ed_h2='ตัวแก้ไขพร้อมพรีวิววิดีโอ',
  ed_p='แก้ข้อความ ปรับเวลา แทรก ลบ รวม เลิกทำ บันทึกอัตโนมัติ คลิกบรรทัดไหนก็ฟังประโยคนั้นได้ทันที — แม้แต่ HEVC หรือ DTS ที่เบราว์เซอร์เล่นไม่ได้ ด้วย ffmpeg ที่มาพร้อมแอป ผลตรวจคุณภาพคลิกไปดูได้',
  ba_h2='ทั้งซีซันในครั้งเดียว ปรับแยกได้ทุกตอน',
  ba_p='ลากทั้งโฟลเดอร์มาวาง ทุกไฟล์ใช้การตั้งค่าเดียวกัน แยกกำหนดแทร็กซับ แทร็กเสียง หรือเอนจินให้บางไฟล์ได้ ทุกบรรทัดที่เสร็จมีผลตรวจคุณภาพ',
  pr_h2='ทำไมต้องในเครื่อง', pr_sub='เครื่องมือซับออนไลน์ให้คุณอัปโหลดหนังทั้งเรื่อง Wave Subs ไม่ส่งอะไรออกไปเลย',
  pr_cards=[('ไม่ต้องต่อเน็ต', 'จับบทพูด จัดเวลา แปล แก้ไข ส่งออก ทำในเครื่องทั้งหมด โหลดโมเดลแล้วใช้ได้แม้ไม่มีเน็ต'),
            ('วิดีโอไม่ถูกอัปโหลด', 'ไม่มีบัญชี ไม่มีการเก็บสถิติ ไม่มีเซิร์ฟเวอร์ เป็นแค่โปรแกรมที่รันบนเครื่องของคุณ'),
            ('ฟรีตลอดไป', 'ไม่จำกัดจำนวน ไม่มีสมาชิก มีแต่บริการแปลบนคลาวด์ที่คุณเชื่อมเองเท่านั้นที่จะคิดเงิน')],
  pr_link='นโยบายความเป็นส่วนตัวฉบับเต็ม (ภาษาอังกฤษ)',
  req_h2='โมเดลและสเปกที่ต้องใช้', req_sub='โมเดลดาวน์โหลดได้ในแอปคลิกเดียว แอปจะระบุแต่ละโมเดลว่า "เหมาะ / ใช้ได้ / หนักเกินไป" ตามแรมของเครื่องคุณ กฎเดียวกันในรูปตาราง:',
  req_asr='โมเดลจับบทพูด (whisper)', req_llm='โมเดลแปลในเครื่อง (Qwen3)',
  req_cols=['โมเดล', 'ขนาดดาวน์โหลด', 'แรมขณะใช้งาน', 'คุณภาพ', 'ความเร็ว', 'Mac: แรมที่แนะนำ', 'PC Windows: แรมที่แนะนำ'],
  req_combo_h3='ชุดที่แนะนำ', req_combo_cols=['เครื่องของคุณ', 'จับบทพูด', 'แปล', 'หมายเหตุ'],
  req_combo=[('Mac 8 GB', 'Small หรือ Large v3 Turbo', 'Qwen3 1.7B', 'พอใช้ Turbo รันบน 8 GB ได้แต่ควรปิดแอปอื่น'),
             ('Mac 16 GB', 'Large v3 Turbo', 'Qwen3 8B', 'ค่าแนะนำเริ่มต้น สมดุลระหว่างคุณภาพกับความเร็ว'),
             ('Mac 32 GB', 'Large v3', 'Qwen3 14B', 'จับบทพูดดีที่สุด แปลแม่นขึ้น'),
             ('Mac 48 GB ขึ้นไป', 'Large v3', 'Qwen3 32B', 'แปลดีที่สุด แต่ช้ากว่า'),
             ('PC Windows 16 GB', 'Large v3 Turbo', 'Qwen3 4B', 'ใช้ CPU อย่างเดียว โมเดลเดียวกันมักใช้เวลาหลายเท่าของ Apple Silicon'),
             ('PC Windows 32 GB', 'Large v3 Turbo', 'Qwen3 8B', 'โมเดลใหญ่รันได้ เผื่อเวลาไว้')],
  req_notes=['"แรมขณะใช้งาน" คือที่ใช้จริงหลังโหลดโมเดล การจับบทพูดกับการแปลทำทีละอย่าง ไม่กินแรมพร้อมกัน',
             'Apple Silicon ใช้การเร่งด้วย Metal ส่วนเวอร์ชัน Windows ประมวลผลบน CPU (BLAS) จึงช้ากว่า Mac ระดับเดียวกันอย่างเห็นได้ชัด และไม่รองรับ Mac Intel',
             'บนชิปตระกูล M หนังสองชั่วโมงใช้เวลาราว 3–6 นาทีด้วย Large v3 Turbo บวกอีกไม่กี่นาทีสำหรับการแปลในเครื่อง'],
  dl_h2='ดาวน์โหลด', dl_sub=f'เวอร์ชัน {VERSION} มี ffmpeg และ whisper.cpp มาพร้อมแล้ว ติดตั้งแล้วใช้ได้เลย',
  mac_req='macOS 12 ขึ้นไป · <strong>เฉพาะ Apple Silicon</strong> (M1 ขึ้นไป) · ผ่านการรับรองจาก Apple',
  win_req='Windows 10 ขึ้นไป · x64 · แนะนำแรม 16 GB',
  dl_mac='ดาวน์โหลด DMG', dl_mac_alt='หรือไฟล์ ZIP', dl_win='ดาวน์โหลดตัวติดตั้ง', dl_win_alt='หรือ ZIP แบบพกพา',
  dl_note='เปิดครั้งแรกจะแนะนำให้ดาวน์โหลดโมเดลจับบทพูด (หลังจากนั้นไม่ต้องใช้เน็ต) สัญญาอนุญาตโอเพนซอร์ส: <a href="' + REPO + '/blob/main/THIRD-PARTY-LICENSES.md">THIRD-PARTY-LICENSES</a>',
  faq_h2='คำถามที่พบบ่อย',
  faq=[('ใช้กับวิดีโอแบบไหนได้บ้าง?', 'MKV, MP4, MOV, TS, AVI และรูปแบบทั่วไป HEVC, DTS, TrueHD ที่เบราว์เซอร์เล่นไม่ได้ก็ใช้ได้ เพราะ ffmpeg ที่มาพร้อมแอปถอดรหัสได้ทุกอย่าง ไฟล์เสียงอย่างเดียวก็ได้'),
       ('รองรับภาษาอะไรบ้าง?', 'จับบทพูดได้เกือบ 100 ภาษาที่ whisper รองรับพร้อมตรวจภาษาอัตโนมัติ แปลได้ 29 ภาษา หน้าจอมี 32 ภาษา'),
       ('ไม่ต้องต่อเน็ตจริงเหรอ?', 'ทำในเครื่องทั้งหมด ใช้เน็ตแค่โหลดโมเดลครั้งแรก กับการแปลบนคลาวด์ถ้าคุณตั้งค่าเอง'),
       ('หนังสองชั่วโมงใช้เวลานานไหม?', 'ราว 3–6 นาทีด้วย Large v3 Turbo บนชิปตระกูล M บวกอีกไม่กี่นาทีสำหรับแปลในเครื่อง สั่งทั้งซีซันแล้วปล่อยให้รันได้'),
       ('Mac Intel ล่ะ?', 'ยังไม่รองรับ การจับบทพูดในเครื่องต้องพึ่งการเร่งด้วย Metal ของ Apple Silicon บน Intel จะช้าเกินกว่าจะใช้งานจริง')],
  footer_issue='รายงานปัญหา', footer_changelog='บันทึกการเปลี่ยนแปลง',
)

DL_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>'

def esc(s): return html.escape(s, quote=True)

def req_table(rows, cols):
    head = ''.join(f'<th>{esc(c)}</th>' for c in cols)
    body = ''.join(f'<tr><td>{esc(n)}</td><td>{size(mb)}</td><td>{ram} GB</td><td class="dots">{dots(q)}</td><td class="dots">{dots(sp)}</td><td>{fit_mac(ram)}</td><td>{fit_pc(ram)}</td></tr>' for n, mb, ram, q, sp in rows)
    return f'<div class="tbl"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'

def combo_table(rows, cols):
    head = ''.join(f'<th>{esc(c)}</th>' for c in cols)
    body = ''.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in rows)
    return f'<div class="tbl"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'

def lang_href(k, p):
    return p if k == 'zh' else f'{p}{k}/'

def page(k):
    d = T[k]; p = '' if k == 'zh' else '../'; sh = SHOTS.get(k, k)
    a = lambda name: f'{p}assets/shots/{sh}-dark-{name}.jpg'
    canonical = SITE + ('' if k == 'zh' else f'{k}/')
    faq_ld = {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}} for q,ans in d['faq']]}
    app_ld = {"@context":"https://schema.org","@type":"SoftwareApplication","name":"Wave Subs","applicationCategory":"MultimediaApplication",
              "operatingSystem":"macOS 12+ (Apple Silicon), Windows 10+","softwareVersion":VERSION,"inLanguage":HTML_LANG[k],
              "description":d['description'],"url":canonical,"downloadUrl":REPO+'/releases/latest',"screenshot":SITE+f'assets/shots/{sh}-dark-editor.jpg',
              "offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"author":{"@type":"Person","name":"Jiesi Ma"},"featureList":", ".join(d['pills'])}
    alts = ''.join(f'<link rel="alternate" hreflang="{HTML_LANG[l]}" href="{SITE}{"" if l=="zh" else l+"/"}">' for l in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{SITE}">'
    steps = ''.join(f'<div class="card"><div class="k">{i+1}</div><h3>{esc(t)}</h3><p>{esc(b)}</p></div>' for i,(t,b) in enumerate(d['steps']))
    tr_li = ''.join(f'<li>{esc(x)}</li>' for x in d['tr_li'])
    pr = ''.join(f'<div><strong>{esc(t)}</strong>{esc(b)}</div>' for t,b in d['pr_cards'])
    faq = ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(ans)}</p></details>' for q,ans in d['faq'])
    pills = ''.join(f'<span class="pill">{esc(x)}</span>' for x in d['pills'])
    notes = ''.join(f'<li>{esc(x)}</li>' for x in d['req_notes'])
    nav = d['nav']
    options = ''.join(f'<option value="{l}"{" selected" if l==k else ""}>{NATIVE[l]}</option>' for l in LANGS)
    privacy_href = f'{p}privacy.html' if k == 'zh' else f'{p}en/privacy.html'
    detect = '' if k != 'zh' else '''<script>
  // 根页按浏览器语言跳转一次；用户在切换器里选过语言（或带 ?lang=xx 打开）就以选择为准；爬虫不跳，各语言靠 hreflang 收录
  (function(){try{if(/bot|crawl|spider|slurp|bingpreview/i.test(navigator.userAgent))return;var L=%s;var q=(location.search.match(/[?&]lang=([a-z]+)/)||[])[1];if(q&&L.indexOf(q)>=0){localStorage.setItem('ws-lang',q);}
    var s=q||localStorage.getItem('ws-lang');var t=s;
    if(!t){var n=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();var b=n.split('-')[0];if(n.indexOf('zh')===0)b='zh';t=L.indexOf(b)>=0?b:'en';}
    if(t!=='zh'&&L.indexOf(t)>=0){location.replace(t+'/');}}catch(e){}})();
</script>''' % json.dumps(LANGS)
    return f'''<!doctype html>
<html lang="{HTML_LANG[k]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(d['title'])}</title>
<meta name="description" content="{esc(d['description'])}">
<meta name="keywords" content="{esc(d['keywords'])}">
<link rel="canonical" href="{canonical}">
{alts}
<meta property="og:type" content="website"><meta property="og:site_name" content="Wave Subs">
<meta property="og:title" content="{esc(d['og_title'])}"><meta property="og:description" content="{esc(d['description'])}">
<meta property="og:url" content="{canonical}"><meta property="og:image" content="{SITE}assets/hero-wave.jpg"><meta property="og:locale" content="{OG_LOCALE[k]}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(d['og_title'])}"><meta name="twitter:description" content="{esc(d['description'])}"><meta name="twitter:image" content="{SITE}assets/hero-wave.jpg">
<link rel="icon" href="{p}assets/icon.png">
<script type="application/ld+json">{json.dumps(app_ld, ensure_ascii=False)}</script>
<script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>
<style>{CSS.replace('url(assets/', 'url(' + p + 'assets/')}</style>
{detect}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{p if p else './'}"><img src="{p}assets/icon.png" alt="Wave Subs"><span>Wave Subs</span></a>
  <nav>
    <a href="#how">{esc(nav[0])}</a><a href="#translate">{esc(nav[1])}</a><a href="#privacy">{esc(nav[2])}</a><a href="#requirements">{esc(nav[3])}</a>
    <a href="#download">{esc(nav[4])}</a><a href="#faq">{esc(nav[5])}</a>
    <a href="{REPO}" target="_blank" rel="noopener">GitHub</a>
    <select class="lang-btn" id="lang" aria-label="Language">{options}</select>
  </nav>
</div></header>

<section class="hero"><div class="wrap">
  <h1>{esc(d['h1'])}</h1>
  <p class="h2sub"><em>{esc(d['h2'])}</em></p>
  <p class="lead">{esc(d['lead'])}</p>
  <div class="cta">
    <a class="btn primary" id="dl-primary" href="#download">{DL_ICON}{esc(d['cta_mac'])} <small>Apple Silicon</small></a>
    <a class="btn" id="dl-secondary" href="#download">{DL_ICON}{esc(d['cta_win'])} <small>x64</small></a>
  </div>
  <p class="cta-note"><a href="{REPO}" target="_blank" rel="noopener">{esc(d['cta_note'][0])}</a><span>·</span>{esc(d['cta_note'][1])}<span>·</span>{esc(d['cta_note'][2])}</p>
  <div class="pills">{pills}</div>
  <div class="hero-shot"><img src="{a('editor')}" alt="{esc(d['ed_h2'])}" width="1920" height="1200" fetchpriority="high"></div>
  <p class="note">{esc(d['hero_note'])}</p>
</div></section>

<section id="how"><div class="wrap">
  <h2>{esc(d['how_h2'])}</h2><p class="sub">{esc(d['how_sub'])}</p>
  <div class="grid">{steps}</div>
  <div class="feature" style="padding-top:40px">
    <div class="shot"><img src="{a('home-done')}" alt="{esc(d['steps'][2][0])}" width="1920" height="1200" loading="lazy"></div>
    <div><h3>{esc(d['steps'][2][0])}</h3><p>{esc(d['steps'][2][1])}</p></div>
  </div>
</div></section>

<section id="translate" style="padding-top:0"><div class="wrap">
  <div class="feature flip">
    <div class="shot"><img src="{a('translate-models')}" alt="{esc(d['tr_h2'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['tr_h2'])}</h2><p>{esc(d['tr_p'])}</p><ul>{tr_li}</ul></div>
  </div>
  <div class="feature">
    <div class="shot"><img src="{a('editor')}" alt="{esc(d['ed_h2'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['ed_h2'])}</h2><p>{esc(d['ed_p'])}</p></div>
  </div>
  <div class="feature flip">
    <div class="shot"><img src="{a('batch')}" alt="{esc(d['ba_h2'])}" width="1920" height="1200" loading="lazy"></div>
    <div><h2>{esc(d['ba_h2'])}</h2><p>{esc(d['ba_p'])}</p></div>
  </div>
</div></section>

<section class="privacy" id="privacy"><div class="wrap">
  <h2>{esc(d['pr_h2'])}</h2><p class="sub">{esc(d['pr_sub'])}</p>
  <div class="row">{pr}</div>
  <p class="req" style="margin-top:18px;font-size:13.5px"><a href="{privacy_href}">{esc(d['pr_link'])}</a></p>
</div></section>

<section id="requirements"><div class="wrap">
  <h2>{esc(d['req_h2'])}</h2><p class="sub">{esc(d['req_sub'])}</p>
  <h3 class="tbl-title">{esc(d['req_asr'])}</h3>{req_table(ASR, d['req_cols'])}
  <h3 class="tbl-title">{esc(d['req_llm'])}</h3>{req_table(LLM, d['req_cols'])}
  <h3 class="tbl-title" id="combos">{esc(d['req_combo_h3'])}</h3>{combo_table(d['req_combo'], d['req_combo_cols'])}
  <ul class="notes">{notes}</ul>
</div></section>

<section id="download" style="padding-top:0"><div class="wrap">
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
  // 语言切换：记住选择（根页的自动跳转会尊重它），再跳到对应目录
  document.getElementById('lang').addEventListener('change', (e) => {{
    const v = e.target.value; try {{ localStorage.setItem('ws-lang', v); }} catch (_) {{}}
    const root = '{p if p else "./"}';
    location.href = v === 'zh' ? root : root + v + '/';
  }});
</script>
</body>
</html>
'''

pages = []
for k in LANGS:
    out = 'docs/index.html' if k == 'zh' else f'docs/{k}/index.html'
    path = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(page(k))
    pages.append(SITE + ('' if k == 'zh' else f'{k}/'))
    print(f'{out}: {os.path.getsize(path)} bytes')

# sitemap + robots
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{u}</loc></url>\n' for u in pages + [SITE+'privacy.html', SITE+'en/privacy.html']) + '</urlset>\n'
open(os.path.join(ROOT, 'docs', 'sitemap.xml'), 'w').write(sm)
open(os.path.join(ROOT, 'docs', 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n')
print('sitemap.xml / robots.txt 已生成')
