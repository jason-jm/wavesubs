#!/usr/bin/env python3
"""版本更新与「看生肉」两组帖子的配图：小红书 3:4 卡片（2160×2880）+ X 横版（2560×1280）。
样式与 build-cards.py / build-social.py 一致（同一套背景、品牌栏、页脚），只是文案和截图不同。

用法：SHOTS=<截图目录> python3 scripts/build-posts.py [update|raw ...]
  截图目录里要有 shoot.cjs 出的 <语言>-dark-<场景>.png；设置页「有新版本」那张用 UPDATE_SHOT 指定。
  输出：store/social/posts/<帖子>/<语言>-<序号>-<id>.jpg，横版 store/social/posts/<帖子>/<语言>-x.jpg
"""
import os, sys, html, subprocess, importlib.util, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, 'scripts', name + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
bs = load('build-site'); bc = load('build-cards')
esc = lambda s: html.escape(s, quote=True)
SHOTS = os.environ.get('SHOTS') or os.path.join(ROOT, 'store', 'screenshots')
UPDATE_SHOT = os.environ.get('UPDATE_SHOT', '')
OUT = os.path.join(ROOT, 'store', 'social', 'posts')

def shot(k, scene):
    loc = bs.SHOTS.get(k, k)
    if scene == 'update' and UPDATE_SHOT: return f'<div class="shotwrap"><img class="shot" src="file://{UPDATE_SHOT}"></div>'
    p = os.path.join(SHOTS, f'{loc}-dark-{scene}.png')
    if not os.path.exists(p): p = os.path.join(ROOT, 'docs', 'assets', 'shots', f'{loc}-dark-{scene}.jpg')
    return f'<div class="shotwrap"><img class="shot" src="file://{p}"></div>'
pills = lambda xs: '<div class="pills">' + ''.join(f'<span class="pill">{esc(x)}</span>' for x in xs) + '</div>'
bullets = lambda xs: '<ul class="bullets">' + ''.join(f'<li>{esc(x)}</li>' for x in xs) + '</ul>'
kicker = lambda s: f'<div class="kicker">{esc(s)}</div>'
h1 = lambda s, small=False, top=44: f'<h1 class="{"small" if small else ""}" style="margin-top:{top}px">{esc(s)}</h1>'
h2 = lambda s: f'<p class="h2">{esc(s)}</p>'
lead = lambda s: f'<p class="lead">{esc(s)}</p>'
spacer = '<div class="spacer"></div>'

# ---------------- 帖子 1：更新了什么（1.0.7 + 1.0.8） ----------------
def update_cards(k):
    zh = k == 'zh'
    if zh:
        return [
            ('cover', kicker('1.0.7 · 1.0.8 更新') + h1('画面里的字，也给你翻了', top=10) + h2('翻译画面文字 · 小模型翻译修好 · 模型按语言选 · 检查更新')
                + lead('两周里最大的一次更新，Mac 和 Windows 都有。') + shot(k, 'editor')),
            ('signs', kicker('新功能') + h1('翻译画面中的文字', top=10) + lead('招牌、便签、短信、聊天气泡、告示、标题卡、人物名牌——逐秒读画面，翻好按原文的位置写进字幕。')
                + bullets(['译文贴着原文放，尽量不遮挡；只有整屏的邮件、文件才铺底板', '片头片尾名单、台标水印、烧录字幕自动排除', '用系统自带的文字识别，不下载任何模型；24 分钟一集多花两三分钟', 'Mac 用 Vision，Windows 用系统 OCR'])
                + shot(k, 'home-ready')),
            ('small-models', kicker('翻译') + h1('小模型翻译，不再丢句子', top=10) + lead('用 1.7B 翻日语纪录片时，整批译文被丢、原文被照抄成译文——两处根因都找到了。')
                + bullets(['小模型一行一个数组，解析器整批作废：现在能救的都救回来', '抄回来的原文每一轮都拦住，双语字幕不再同一句出两遍', '提示词按语种带示例：最难的几批第一轮真正译出来的比例 40% → 88%', '一集里没译文或照抄的对白 98 条 → 6 条'])
                + shot(k, 'translate-models')),
            ('models', kicker('模型页') + h1('按语言挑模型', top=10) + lead('每个识别模型标出英语、欧洲语言、日语·韩语·中文三组的意思保留率——三部片各 30 分钟盲评出来的。')
                + bullets(['英语：Small 就够（92%）', '德语等欧洲语言：Small 可用，Large v3 Turbo 才稳（96%）', '日语、韩语、中文：至少 Large v3 Turbo（89%），Tiny 有一半句子意思是错的'])
                + shot(k, 'models')),
            ('first-run', kicker('转换页') + h1('第一次用，不用先找模型', top=10) + lead('刚装好一个模型都没有时，转换页直接给出这台机器的推荐模型和「下载并继续」；设置拆成「识别」「翻译」两个框，没就绪的选项不出现。')
                + shot(k, 'home-ready')),
            ('update', kicker('设置') + h1('有新版本会告诉你', top=10) + lead('启动时查一次 GitHub 上的版本文件，有新版本就在设置里给下载按钮和更新说明；可以跳过某个版本，也可以关掉。用 Homebrew / Scoop 装的给对应命令。')
                + shot(k, 'update')),
            ('windows', kicker('Windows') + h1('Windows 这次修了这些', top=10)
                + bullets(['语音识别不再随包带 OpenBLAS：一部分机器一加载模型就崩（退出码 3221225477），换成官方不带 BLAS 的包', '深色模式下的下拉菜单看得清了', '模型页按 Windows 机器判断，不再写成「这台 Mac」', '任务失败可以一键复制完整日志', '画面文字翻译接上了系统 OCR，要先装片中语言的语言包'])
                + lead('官网 wavesubs.com 直接下载，已装的在设置里会看到更新提示。') + spacer),
        ]
    return [
        ('cover', kicker('Update 1.0.7 · 1.0.8') + h1('Now it translates the text on screen, too', top=10) + h2('On-screen text · better small-model translation · per-language model guide · update check')
            + lead('The biggest update in two weeks, on both macOS and Windows.') + shot(k, 'editor')),
        ('signs', kicker('New') + h1('Translate on-screen text', top=10) + lead('Signs, notes, text messages, chat bubbles, notices, title cards, name plates — read once a second and written into the subtitles at the position of the original.')
            + bullets(['Placed next to the original, covering it only as a last resort', 'Credits, station logos and burned-in subtitles stay out', 'Uses the OS text recognition; nothing to download, two to three extra minutes per episode', 'Vision on macOS, the built-in OCR on Windows'])
            + shot(k, 'home-ready')),
        ('small-models', kicker('Translation') + h1('Small models stop dropping lines', top=10) + lead('With the 1.7B model, whole batches were thrown away and source lines came back untranslated. Both causes are fixed.')
            + bullets(['One array per line no longer voids a batch: every salvageable row is kept', 'Copied-back source is rejected in every round', 'A two-line example per language pair: first-pass yield on the hardest batches 40% → 88%', 'Lines with no translation in one episode: 98 → 6'])
            + shot(k, 'translate-models')),
        ('models', kicker('Models page') + h1('Pick a model by language', top=10) + lead('Every recognition model shows meaning retention for English, European languages and Japanese · Korean · Chinese, blind-judged on 30-minute samples of three films.')
            + bullets(['English: Small is enough (92%)', 'German and other European languages: Small is usable, Large v3 Turbo is reliable (96%)', 'Japanese, Korean, Chinese: Large v3 Turbo or better (89%); Tiny gets half the lines wrong'])
            + shot(k, 'models')),
        ('update', kicker('Settings') + h1('It tells you when there is a new version', top=10) + lead('One check at launch against a version file on GitHub; a download button and release notes appear in Settings. Skip a version, or turn it off. Homebrew and Scoop installs get their upgrade command.')
            + shot(k, 'update')),
        ('windows', kicker('Windows') + h1('Windows fixes', top=10)
            + bullets(['Speech recognition no longer ships OpenBLAS, which crashed on some machines as soon as a model loaded', 'Dropdown menus are readable in dark mode', 'The Models page judges the actual PC instead of calling it a Mac', 'One-click copy of the full log when a task fails', 'On-screen text uses the built-in OCR (install the language pack first)'])
            + lead('Download at wavesubs.com; installed copies see the update in Settings.') + spacer),
    ]

# ---------------- 帖子 2：看生肉，找不到字幕？ ----------------
def raw_cards(k):
    d = bs.T[k]
    if k == 'zh':
        return [
            ('cover', h1('看生肉，找不到字幕？', top=56) + h2('拖进去，本地 AI 直接生成中文字幕')
                + lead('识别对白、对齐时间、翻译成中文，SRT/ASS 放到影片旁边。不联网、不上传、不要账号。') + pills(d['pills']) + shot(k, 'editor')),
            ('flow', kicker('三步') + h1('拖进去就行', small=True, top=10)
                + '<div class="steps">' + ''.join(f'<div class="step"><div class="k">{i+1}</div><div><h3>{esc(t)}</h3><p>{esc(b)}</p></div></div>' for i, (t, b) in enumerate(d['steps'])) + '</div>'
                + shot(k, 'home-done')),
            ('signs', kicker('连画面里的字都翻') + h1('招牌、短信、告示，一起翻', top=10) + lead('打开「翻译画面中的文字」，画面里出现的招牌、便签、聊天气泡、标题卡按原文的位置写进字幕，不遮挡对白。') + shot(k, 'home-ready')),
            ('editor', h1(d['ed_h2'], top=44) + lead(d['ed_p']) + pills([d['hero_note']]) + shot(k, 'editor')),
            ('batch', h1(d['ba_h2'], top=44) + lead(d['ba_p']) + shot(k, 'batch')),
            ('privacy', h1(d['pr_h2'], top=44) + lead(d['pr_sub'])
                + '<div class="cards">' + ''.join(f'<div class="card"><b>{esc(t)}</b><span>{esc(b)}</span></div>' for t, b in d['pr_cards']) + '</div>' + shot(k, 'settings')),
        ]
    return [
        ('cover', h1('Watching raws with no subtitles?', top=56) + h2('Drop the file in. Local AI writes them.')
            + lead('Recognizes the dialogue, fixes the timing, translates into your language. SRT/ASS lands next to the video. No upload, no account.') + pills(d['pills']) + shot(k, 'editor')),
        ('flow', kicker('Three steps') + h1('Just drop it in', small=True, top=10)
            + '<div class="steps">' + ''.join(f'<div class="step"><div class="k">{i+1}</div><div><h3>{esc(t)}</h3><p>{esc(b)}</p></div></div>' for i, (t, b) in enumerate(d['steps'])) + '</div>'
            + shot(k, 'home-done')),
        ('signs', kicker('Even the text on screen') + h1('Signs, messages, notices — translated too', top=10) + lead('Turn on "Translate on-screen text" and signs, notes, chat bubbles and title cards are written into the subtitles at the position of the original, never covering the dialogue.') + shot(k, 'home-ready')),
        ('editor', h1(d['ed_h2'], top=44) + lead(d['ed_p']) + pills([d['hero_note']]) + shot(k, 'editor')),
        ('batch', h1(d['ba_h2'], top=44) + lead(d['ba_p']) + shot(k, 'batch')),
        ('privacy', h1(d['pr_h2'], top=44) + lead(d['pr_sub'])
            + '<div class="cards">' + ''.join(f'<div class="card"><b>{esc(t)}</b><span>{esc(b)}</span></div>' for t, b in d['pr_cards']) + '</div>' + shot(k, 'settings')),
    ]

# ---------------- X 横版（2560×1280） ----------------
LAND = {
    'update': {'en': ('Wave Subs 1.0.8', 'Now it translates the text on screen, too', 'models'),
               'zh': ('Wave Subs 1.0.8', '画面里的字，也给你翻了', 'models')},
    'raw': {'en': ('Watching raws with no subtitles?', 'Drop the file in. Local AI writes them.', 'editor'),
            'zh': ('看生肉，找不到字幕？', '拖进去，本地 AI 直接生成中文字幕', 'editor')},
}
FONT = bc.FONT
def landscape(k, title, sub, scene):
    d = bs.T[k]; loc = bs.SHOTS.get(k, k)
    bg = 'file://' + os.path.join(ROOT, 'docs', 'assets', 'hero-wave.jpg'); icon = 'file://' + os.path.join(ROOT, 'docs', 'assets', 'icon.png')
    sp = os.path.join(SHOTS, f'{loc}-dark-{scene}.png')
    foot = ' · '.join(d['cta_note'])
    return f'''<!doctype html><html lang="{bs.HTML_LANG[k]}"><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1280px;height:640px;overflow:hidden;background:#0b0f17;font-family:{FONT};color:#e8edf5;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:url({bg}) center 60%/cover no-repeat;opacity:.75}}
.grad{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,15,23,.92) 0%,rgba(11,15,23,.78) 50%,rgba(11,15,23,.3) 100%)}}
.col{{position:absolute;left:72px;top:56px;bottom:52px;width:760px;display:flex;flex-direction:column;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600}} .brand img{{width:56px;height:56px;border-radius:14px}}
h1{{margin:0 0 14px;font-size:62px;line-height:1.1;letter-spacing:-.5px;font-weight:700;color:#fff}}
.h2{{margin:0;font-size:36px;line-height:1.2;font-weight:700;background:linear-gradient(90deg,#5fd4d0,#f0a07a);-webkit-background-clip:text;background-clip:text;color:transparent}}
.foot{{font-size:19px;color:#aab4c5;white-space:nowrap;line-height:1.5}} .foot b{{color:#e8edf5;font-weight:600}} .foot span{{margin:0 10px;color:#7b8798}} .foot .l2{{font-size:22px;margin-top:2px}}
.shot{{position:absolute;right:-150px;bottom:-140px;width:700px;border-radius:16px;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.7);transform:rotate(-5deg)}}
</style></head><body><div class="bg"></div><div class="grad"></div>
<img class="shot" src="file://{sp}">
<div class="col">
  <div class="brand"><img src="{icon}"><span>Wave Subs</span></div>
  <div><h1>{esc(title)}</h1><p class="h2">{esc(sub)}</p></div>
  <div class="foot"><div>{esc(foot)}</div><div class="l2"><b>macOS</b><span>·</span><b>Windows</b><span>·</span><b>wavesubs.com</b></div></div>
</div></body></html>'''

def shoot_page(page_path, prefix, w, h):
    r = subprocess.run(['npx', 'electron', os.path.join(ROOT, 'scripts', 'shoot-page.cjs'), 'file://' + page_path, prefix, str(w), str(h), '0'],
                       cwd=ROOT, check=True, capture_output=True, text=True, env={**os.environ, 'OFFSCREEN': '1', 'CHECK_OVERFLOW': '.col'})
    m = [l for l in r.stdout.splitlines() if l.startswith('overflow=')]
    n = int(m[-1].split('=')[1]) if m else 0
    if n > 0: print(f'  ⚠ 内容超出 {n}px: {os.path.basename(prefix)}')
    return prefix + '-0.png'

def jpg(src, out, q=88):
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(q), src, '--out', out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return os.path.relpath(out, ROOT)

if __name__ == '__main__':
    posts = sys.argv[1:] or ['update', 'raw']
    tmp = tempfile.mkdtemp(prefix='wavesubs-posts-')
    try:
        for post in posts:
            outdir = os.path.join(OUT, post); os.makedirs(outdir, exist_ok=True)
            for k in ('zh', 'en'):
                cs = update_cards(k) if post == 'update' else raw_cards(k)
                for i, (cid, body) in enumerate(cs, 1):
                    p = os.path.join(tmp, f'{post}-{k}-{i}.html'); open(p, 'w', encoding='utf-8').write(bc.page(k, i, len(cs), body))
                    png = bc.shoot(p, os.path.join(tmp, f'{post}-{k}-{i}'))
                    print(' ', jpg(png, os.path.join(outdir, f'{k}-{i:02d}-{cid}.jpg')))
                title, sub, scene = LAND[post][k]
                p = os.path.join(tmp, f'{post}-{k}-x.html'); open(p, 'w', encoding='utf-8').write(landscape(k, title, sub, scene))
                png = shoot_page(p, os.path.join(tmp, f'{post}-{k}-x'), 1280, 640)
                print(' ', jpg(png, os.path.join(outdir, f'{k}-x.jpg')))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
