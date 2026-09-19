#!/usr/bin/env python3
"""两组推广帖的配图，两套完全不同的版式（都是浅色）：

  update —「更新了什么」：版本说明书 / changelog 风。白纸 + 点阵网格，等宽字的元数据栏，巨大的版本号，
           新功能 / 修复 / Windows 三色标签，数字用大字号统计卡，截图放在浅色窗口框里。
  raw    —「看生肉，找不到字幕？」：字幕文件风。奶油底色，标题像 .srt 的文件页签，「生肉」红章 →「熟了」绿章，
           剧照上压一行真正的字幕（白字黑边），步骤写成 SRT 的 cue（序号 + 时间码 + 正文），贴纸式的圆角标签。

  小红书：3:4 竖版 2160×2880（逻辑 1080×1440），中文。
  X：16:9 横版 2400×1350（逻辑 1200×675），英文，每组三张（封面 + 两张要点图，够一条线程用）。

用法：SHOTS=<截图目录> python3 scripts/build-posts.py [update|raw ...]
  截图目录里要有 shoot.cjs 出的 <语言>-light-<场景>.png。输出到 store/social/posts/<帖子>/。
"""
import os, sys, html, subprocess, importlib.util, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(ROOT, 'scripts', 'build-site.py'))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
esc = lambda s: html.escape(s, quote=True)
SHOTS = os.environ.get('SHOTS') or os.path.join(ROOT, 'store', 'screenshots')
OUT = os.path.join(ROOT, 'store', 'social', 'posts')
ICON = 'file://' + os.path.join(ROOT, 'docs', 'assets', 'icon.png')
STILL = 'file://' + os.path.join(ROOT, 'docs', 'assets', 'demo-still.jpg')
SANS = '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Hiragino Sans GB","Segoe UI",Roboto,Helvetica,Arial,sans-serif'
MONO = '"SF Mono",Menlo,Consolas,"Liberation Mono",monospace'

def shot(lang, scene):
    loc = 'zh-Hans' if lang == 'zh' else lang
    return 'file://' + os.path.join(SHOTS, f'{loc}-light-{scene}.png')

# ============================================================ 版式 A：changelog
CSS_A = f'''
:root{{--ink:#14161C;--ink2:#4B5563;--ink3:#8A93A3;--line:#E3E6EE;--paper:#FAFAFC;--indigo:#5B63D3;--orange:#C4661F;--green:#1F7A4E}}
html,body{{margin:0;overflow:hidden;background:var(--paper);font-family:{SANS};color:var(--ink);-webkit-font-smoothing:antialiased}}
.page{{position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;
  background-image:radial-gradient(#D3D7E4 1.3px,transparent 1.5px);background-size:30px 30px}}
.mono{{font-family:{MONO};letter-spacing:.04em}}
.top{{display:flex;justify-content:space-between;align-items:center;font-family:{MONO};font-size:18px;color:var(--ink3);letter-spacing:.04em}}
.brand{{display:flex;align-items:center;gap:12px;font-family:{SANS};font-size:22px;font-weight:600;color:var(--ink);letter-spacing:0}}
.brand img{{width:36px;height:36px;border-radius:9px}}
.ver{{font-size:300px;font-weight:900;letter-spacing:-.06em;line-height:.88;margin:54px 0 0 -8px}}
h1{{font-size:64px;font-weight:800;line-height:1.15;margin:22px 0 0;letter-spacing:-.01em}}
.sub{{font-size:27px;color:var(--ink2);margin:16px 0 0;line-height:1.5}}
.tags{{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}}
.tag{{font-size:20px;font-weight:700;padding:8px 16px;border-radius:8px;letter-spacing:.02em}}
.tag.new{{background:#EEF0FF;color:var(--indigo)}} .tag.fix{{background:#FFF1E6;color:var(--orange)}} .tag.win{{background:#E8F7EF;color:var(--green)}}
.frame{{border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 30px 60px rgba(20,22,28,.12)}}
.frame img{{width:100%;height:auto;display:block}}
.foot{{display:flex;justify-content:space-between;margin-top:auto;padding-top:18px;border-top:1px solid var(--line);font-family:{MONO};font-size:17px;color:var(--ink3);letter-spacing:.04em}}
.kick{{display:flex;align-items:center;gap:14px;margin-top:52px}}
.no{{font-family:{MONO};font-size:22px;color:var(--ink3);letter-spacing:.06em}}
h2{{font-size:58px;font-weight:800;line-height:1.15;margin:18px 0 0;letter-spacing:-.01em}}
.body{{font-size:27px;line-height:1.6;color:var(--ink2);margin:18px 0 0}}
.check{{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:14px}}
.check li{{display:flex;gap:14px;font-size:27px;line-height:1.5;color:var(--ink)}}
.check li::before{{content:"✓";flex:none;width:34px;height:34px;border-radius:9px;background:#E8F7EF;color:var(--green);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:20px;margin-top:5px}}
.stats{{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:32px}}
.stat{{border:1px solid var(--line);background:#fff;border-radius:22px;padding:30px 30px 28px}}
.stat .n{{font-size:78px;font-weight:900;letter-spacing:-.04em;line-height:1;white-space:nowrap}} .stat .n b{{color:var(--indigo);font-weight:900}}
.stat .l{{margin-top:14px;font-size:22px;color:var(--ink2);line-height:1.45}}
.cap{{font-family:{MONO};font-size:16px;color:var(--ink3);margin-top:12px;letter-spacing:.03em}}
.grow{{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;margin-top:30px}}
.grow .frame{{flex:0 1 auto;min-height:0;overflow:hidden}}
/* 「有新版本」提示：按真实界面的文字画一张浅色示意 */
.ui{{border:1px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 30px 60px rgba(20,22,28,.12);padding:30px 36px;font-size:22px}}
.ui .notes{{background:#F3F4F8;border-radius:14px;padding:18px 22px;margin:4px 0 18px;font-size:19px;line-height:1.6;color:var(--ink2);white-space:pre-line}}
.ui .row{{display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid var(--line)}}
.ui .row:last-child{{border-bottom:none}}
.ui .lab b{{display:block;font-size:24px;font-weight:600}} .ui .lab span{{color:var(--ink3);font-size:19px}}
.ui .btn{{border:1px solid var(--line);border-radius:12px;padding:10px 18px;font-weight:600;font-size:20px;background:#fff}}
.ui .btn.pri{{background:var(--indigo);color:#fff;border-color:var(--indigo)}}
.ui .notice{{padding:18px 0 6px}} .ui .notice b{{display:block;font-size:24px;margin-bottom:8px}}
.ui .notice p{{margin:0 0 14px;color:var(--ink2);font-size:20px}}
.ui .acts{{display:flex;gap:10px}}
.ui .sw{{width:52px;height:30px;border-radius:15px;background:var(--indigo);position:relative}} .ui .sw::after{{content:"";position:absolute;right:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff}}
.ui .dot{{display:inline-block;width:10px;height:10px;border-radius:50%;background:#E8863A;margin-left:8px;vertical-align:middle}}
'''

def page_a(w, h, pad, body, top_right):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS_A}
html,body{{width:{w}px;height:{h}px}} .page{{padding:{pad}}}</style></head><body><div class="page">
<div class="top"><div class="brand"><img src="{ICON}"><span>Wave Subs</span></div><div>{esc(top_right)}</div></div>
{body}</div></body></html>'''

def update_cards_zh():
    foot = '<div class="foot"><span>wavesubs.com</span><span>macOS · Windows · 免费开源</span></div>'
    frame = lambda scene, hgt: f'<div class="grow"><div class="frame" style="min-height:{hgt}px"><img src="{shot("zh", scene)}"></div></div>'
    tag = lambda cls, t: f'<span class="tag {cls}">{esc(t)}</span>'
    cards = []
    cards.append(('cover', f'''<div class="ver">1.0.8</div>
<h1>画面里的字，也给你翻了</h1><p class="sub">翻译画面文字 · 小模型翻译修好 · 模型按语言选 · 检查更新<br>两周里最大的一次更新，Mac 和 Windows 都有。</p>
<div class="tags">{tag('new','新功能 · 4')}{tag('fix','修复 · 5')}{tag('win','Windows')}</div>
{frame('editor', 430)}{foot}'''))
    cards.append(('signs', f'''<div class="kick">{tag('new','新功能')}</div>
<h2>翻译画面中的文字</h2><p class="body">招牌、便签、短信、聊天气泡、告示、标题卡、人物名牌——逐秒读画面，翻好按原文的位置写进字幕。</p>
<ul class="check"><li>译文贴着原文放，尽量不遮挡；只有整屏的邮件、文件才铺底板</li><li>片头片尾名单、台标水印、烧录字幕自动排除</li><li>用系统自带的文字识别，不下载任何模型；一集多花两三分钟</li><li>Mac 用 Vision，Windows 用系统 OCR</li></ul>
{frame('editor', 330)}{foot}'''))
    cards.append(('small-models', f'''<div class="kick">{tag('fix','修复')}</div>
<h2>小模型翻译，不再丢句子</h2><p class="body">用 1.7B 翻日语纪录片时，整批译文被丢、原文被照抄成译文——两处根因都找到了：解析器只认一个完整数组，小模型一行一个数组就整批作废；抄回来的原文没人拦。现在能救的都救回来，每一轮都拦照抄，提示词还按语种带了示例。</p>
<div class="stats"><div class="stat"><div class="n">98 <b>→ 6</b></div><div class="l">同一集里没译文或照抄的对白（Tiny + Qwen3 1.7B）</div></div>
<div class="stat"><div class="n">40<small style="font-size:44px">%</small> <b>→ 88<small style="font-size:44px">%</small></b></div><div class="l">最难的几批，第一轮真正译出来的比例</div></div></div>
<p class="cap">NHK 纪录片一集实测 · 三份识别结果各重发一遍存下原始输出</p>{frame('translate-models', 300)}{foot}'''))
    cards.append(('models', f'''<div class="kick">{tag('new','新功能')}</div>
<h2>按语言挑模型</h2><p class="body">每个识别模型标出英语、欧洲语言、日语·韩语·中文三组的意思保留率，三部片各 30 分钟盲评出来的。英语 Small 就够；欧洲语言 Small 可用、Large v3 Turbo 才稳；日韩中至少 Large v3 Turbo，Tiny 有一半句子意思是错的。</p>
{frame('models', 520)}{foot}'''))
    cards.append(('first-run', f'''<div class="kick">{tag('new','新功能')}</div>
<h2>第一次用，不用先找模型</h2><p class="body">刚装好一个模型都没有时，转换页直接给出这台机器的推荐模型和「下载并继续」，下完直接开始。设置拆成「识别」「翻译」两个框，服务没就绪之前后面的选项不出现。</p>
{frame('home-ready', 560)}{foot}'''))
    cards.append(('update', f'''<div class="kick">{tag('new','新功能')}</div>
<h2>有新版本会告诉你</h2><p class="body">启动时查一次 GitHub 上的版本文件，有新版本就在设置里给下载按钮和更新说明；可以跳过某个版本，也可以关掉。用 Homebrew / Scoop 装的给对应命令。</p>
<div class="grow"><div class="ui">
<div class="row"><div class="lab"><b>Wave Subs</b><span>把视频或字幕变成你要的语言</span></div><span class="btn">1.0.7</span></div>
<div class="row"><div class="lab"><b>软件更新<span class="dot"></span></b><span>有新版本 1.0.8</span></div><span class="btn">检查更新</span></div>
<div class="notice"><b>⤓ 有新版本 1.0.8</b><p>当前是 1.0.7。用浏览器下载新版本，装完覆盖即可</p><div class="notes">翻译画面中的文字
- 转换设置里新增开关。用系统自带的文字识别逐秒读画面，把招牌、便签、短信、聊天气泡、标题卡翻译出来，按原文的位置写进 ASS
- 译文贴着原文放，尽量不遮挡
翻译
- 小模型翻出来的整批译文不再丢；小模型不再把原文照抄成译文
其它
- 模型页按语言给参考；检查更新</div><div class="acts"><span class="btn pri">下载新版本 · 138 MB</span><span class="btn">查看更新说明</span><span class="btn" style="border:none;color:var(--ink3)">跳过这个版本</span></div></div>
<div class="row"><div class="lab"><b>启动时检查更新</b><span>应用启动时进行一次更新检查</span></div><span class="sw"></span></div>
</div></div>{foot}'''))
    cards.append(('windows', f'''<div class="kick">{tag('win','Windows')}</div>
<h2>Windows 这次修了这些</h2>
<ul class="check"><li>语音识别不再随包带 OpenBLAS：一部分机器一加载模型就崩（退出码 3221225477），换成官方不带 BLAS 的包</li><li>深色模式下的下拉菜单看得清了</li><li>模型页按 Windows 机器判断，不再写成「这台 Mac」</li><li>任务失败可以一键复制完整日志</li><li>画面文字翻译接上了系统 OCR，要先装片中语言的语言包</li></ul>
<div class="stats" style="margin-top:26px"><div class="stat"><div class="n">1.0.8</div><div class="l">macOS 12+（Apple Silicon）· Windows 10+，官网直接下载</div></div><div class="stat"><div class="n">0 <b>元</b></div><div class="l">免费、开源、没有内购、不要账号</div></div></div>
{frame('models', 260)}{foot}'''))
    return cards

def update_x_en():
    """X 用的三张 16:9：封面、数字、模型页"""
    foot = '<div class="foot"><span>wavesubs.com</span><span>macOS · Windows · free & open source</span></div>'
    tag = lambda cls, t: f'<span class="tag {cls}">{esc(t)}</span>'
    two = lambda left, right: f'<div style="display:flex;gap:44px;flex:1;min-height:0;margin-top:18px"><div style="flex:0 0 520px;display:flex;flex-direction:column">{left}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center">{right}</div></div>'
    frame = lambda scene, hgt: f'<div class="frame" style="flex:0 1 auto;min-height:0;overflow:hidden"><img src="{shot("en", scene)}"></div>'
    return [
        ('x1-cover', two(f'<div class="ver" style="font-size:190px;margin-top:10px">1.0.8</div><h1 style="font-size:40px;margin-top:6px">Now it translates the text on screen, too</h1><div class="tags" style="margin-top:18px">{tag("new","4 new")}{tag("fix","5 fixes")}{tag("win","Windows")}</div>',
                          frame('editor', 470)) + foot),
        ('x2-numbers', f'''<div class="kick" style="margin-top:20px">{tag('fix','Fix')}<span class="no">Small local models</span></div>
<h2 style="font-size:44px;margin-top:10px">Small models stop dropping lines</h2>
<p class="body" style="font-size:22px;margin-top:10px">With the 1.7B model, whole batches were thrown away when it answered one array per line, and source lines copied back slipped through. Both are fixed, and the prompt now carries a two-line example per language pair.</p>
<div class="stats" style="margin-top:22px"><div class="stat"><div class="n">98 <b>→ 6</b></div><div class="l">lines with no translation in one episode (Tiny + Qwen3 1.7B)</div></div><div class="stat"><div class="n">40<small style="font-size:40px">%</small> <b>→ 88<small style="font-size:40px">%</small></b></div><div class="l">first-pass yield on the hardest batches</div></div></div>
<p class="cap">Measured on one NHK documentary episode · every batch replayed with raw model output saved</p>{foot}'''),
        ('x3-models', two(f'<div class="kick" style="margin-top:20px">{tag("new","New")}<span class="no">Models page</span></div><h2 style="font-size:44px;margin-top:10px">Pick a model by language</h2><p class="body" style="font-size:22px">Meaning retention for English, European languages and Japanese · Korean · Chinese, blind-judged on 30-minute samples of three films. English → Small is enough. Japanese, Korean, Chinese → Large v3 Turbo or better.</p>',
                           frame('models', 470)) + foot),
    ]

# ============================================================ 版式 B：字幕文件
CSS_B = f'''
:root{{--cream:#F4EEE2;--ink:#151515;--ink2:#3D3A33;--ink3:#7A7368;--red:#D6402B;--green:#2C8C5A;--rule:#CFC6B5}}
html,body{{margin:0;overflow:hidden;background:var(--cream);font-family:{SANS};color:var(--ink);-webkit-font-smoothing:antialiased}}
.page{{position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column}}
.filetab{{display:inline-flex;align-items:center;gap:12px;background:#fff;border:2.5px solid var(--ink);border-bottom:none;border-radius:16px 16px 0 0;padding:12px 20px 14px;font-family:{MONO};font-size:20px;font-weight:700;align-self:flex-start;position:relative;top:2.5px}}
.filetab i{{width:12px;height:12px;border-radius:50%;background:var(--red);display:inline-block}}
.rule{{border-top:2.5px solid var(--ink)}}
.h{{font-size:96px;font-weight:900;line-height:1.04;letter-spacing:-.02em;margin:30px 0 0}}
.h .em{{color:var(--red)}}
.stamp{{position:absolute;display:inline-block;padding:8px 22px;border:5px solid var(--red);color:var(--red);font-size:46px;font-weight:900;border-radius:14px;transform:rotate(-10deg);letter-spacing:.14em;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 3px rgba(255,255,255,.7)}}
.stamp.ok{{border-color:var(--green);color:var(--green)}}
.still{{position:relative;border-radius:26px;overflow:hidden;border:3px solid var(--ink);box-shadow:12px 12px 0 var(--ink);background:#000;display:flex}}
.still img{{width:100%;height:100%;display:block;object-fit:cover;object-position:center}}
.still.shotframe{{flex:0 1 auto;display:block}} .still.shotframe img{{height:auto}}
.grow .still{{flex:1;min-height:0}}
.grow .still.shotframe{{flex:0 1 auto}}
.subline{{position:absolute;left:24px;right:24px;bottom:28px;text-align:center;color:#fff;font-size:40px;font-weight:700;line-height:1.3;
  text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 0 14px rgba(0,0,0,.7)}}
.subline small{{display:block;font-size:22px;font-weight:500;opacity:.92}}
.plate{{position:absolute;left:30px;top:30px;background:rgba(10,12,18,.72);color:#fff;border-radius:12px;padding:12px 16px;font-size:22px;line-height:1.35;border:1px solid rgba(255,255,255,.25)}}
.plate small{{display:block;font-size:17px;opacity:.75}}
.srt{{font-family:{MONO};margin-top:30px;font-size:21px;line-height:1.5;color:var(--ink2)}}
.srt b{{display:block;font-size:34px;font-weight:800;color:var(--ink)}}
.srt .tc{{color:var(--ink3)}}
.stickers{{display:flex;flex-wrap:wrap;gap:12px;margin-top:auto;padding-top:26px}}
.stk{{background:#fff;border:2.5px solid var(--ink);border-radius:999px;padding:12px 22px;font-size:24px;font-weight:700;transform:rotate(-2deg)}}
.stk:nth-child(2n){{transform:rotate(2deg)}} .stk.hot{{background:var(--ink);color:#fff}}
.foot{{display:flex;justify-content:space-between;align-items:center;margin-top:24px}}
.foot .url{{background:var(--ink);color:#fff;border-radius:999px;padding:14px 28px;font-size:26px;font-weight:800;letter-spacing:.01em}}
.foot .note{{font-size:19px;color:var(--ink3);font-family:{MONO};letter-spacing:.03em}}
.cue{{display:grid;grid-template-columns:200px 1fr;gap:16px;padding:24px 0;border-bottom:2px dashed var(--rule)}}
.cue:last-of-type{{border-bottom:none}}
.cue .i{{font-family:{MONO};font-size:46px;font-weight:800;line-height:1}}
.cue .t{{font-family:{MONO};font-size:17px;color:var(--ink3);letter-spacing:0;margin-top:6px;line-height:1.35}}
.cue h3{{margin:6px 0 8px;font-size:38px;font-weight:800;line-height:1.15}}
.cue p{{margin:0;font-size:25px;line-height:1.55;color:var(--ink2)}}
.lead{{font-size:30px;line-height:1.5;color:var(--ink2);margin:22px 0 0}}
.grow{{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center}}
.big{{font-size:120px;font-weight:900;letter-spacing:-.03em;line-height:1;margin-top:30px}}
'''

def page_b(w, h, pad, body):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS_B}
html,body{{width:{w}px;height:{h}px}} .page{{padding:{pad}}}</style></head><body><div class="page">{body}</div></body></html>'''

def still(sub, sub_small='', stamp='', plate='', raw_stamp=''):
    st = f'<div class="stamp ok" style="right:26px;top:26px;transform:rotate(8deg)">{esc(stamp)}</div>' if stamp else ''
    st += f'<div class="stamp" style="left:26px;top:26px;transform:rotate(-8deg)">{esc(raw_stamp)}</div>' if raw_stamp else ''
    pl = f'<div class="plate">{plate}</div>' if plate else ''
    sm = f'<small>{esc(sub_small)}</small>' if sub_small else ''
    return f'<div class="still"><img src="{STILL}">{pl}<div class="subline">{esc(sub)}{sm}</div>{st}</div>'

def cues(items, tcs):
    return ''.join(f'<div class="cue"><div><div class="i">{i+1}</div><div class="t">{tc}</div></div><div><h3>{esc(t)}</h3><p>{esc(b)}</p></div></div>' for i, ((t, b), tc) in enumerate(zip(items, tcs)))
TCS = ['00:00:01,200<br>--> 00:00:03,400', '00:00:03,900<br>--> 00:00:05,800', '00:00:06,100<br>--> 00:00:08,900']

def raw_cards_zh():
    d = bs.T['zh']
    foot = lambda note: f'<div class="foot"><span class="url">wavesubs.com</span><span class="note">{esc(note)}</span></div>'
    tab = lambda name: f'<div class="filetab"><i></i>{esc(name)}</div><div class="rule"></div>'
    stk = lambda xs, hot=0: '<div class="stickers">' + ''.join(f'<span class="stk{" hot" if i == hot else ""}">{esc(x)}</span>' for i, x in enumerate(xs)) + '</div>'
    frame = lambda scene: f'<div class="grow"><div class="still shotframe" style="box-shadow:10px 10px 0 var(--ink)"><img src="{shot("zh", scene)}"></div></div>'
    cards = []
    cards.append(('cover', tab('Harbor.Lights.S01E03.zh.srt') + '''<div style="position:relative"><div class="h">看生肉，<br>找不到<span class="em">字幕</span>？</div>
<div class="stamp" style="right:10px;top:-6px">生肉</div></div>
<p class="lead">拖进去，本地 AI 直接生成中文字幕。识别对白、对齐时间、翻译，SRT/ASS 放到影片旁边。</p>
<div class="grow" style="margin-top:34px">''' + still('忘了。跑的话五分钟就到。', '忘れた。走れば五分だから。', '熟了') + '</div>' + stk(['不联网 · 不上传', '免费开源', '整季批量', 'Mac · Windows']) + foot('免费 · 开源 · 没有内购')))
    cards.append(('flow', tab('怎么用.srt') + '<div class="h" style="font-size:72px">三条 cue，搞定</div>' + '<div style="margin-top:10px">' + cues(d['steps'], TCS) + '</div>' + frame('home-done') + stk(['自动检测语种', '时间轴对齐到真实说话时刻', 'SRT / ASS']) + foot('两小时电影 M 芯片约 3～6 分钟识别')))
    cards.append(('signs', tab('画面文字.ass') + '<div class="h" style="font-size:72px">画面里的字，<br>也给你<span class="em">翻</span></div>' + '<p class="lead">招牌、便签、短信、聊天气泡、告示、标题卡、人物名牌，按原文的位置写进字幕，不遮对白。</p>'
        + '<div class="grow" style="margin-top:30px">' + still('招牌和短信也有译文', '', '', '<small>画面文字</small>コンビニ 24時間 → 便利店 24 小时') + '</div>' + stk(['不下载模型', '一集多花两三分钟', 'Mac Vision · Windows OCR']) + foot('字幕组的活，本地 AI 顺手干了')))
    cards.append(('editor', tab('编辑.srt') + '<div class="h" style="font-size:72px">点一行，<br>听这句</div>' + f'<p class="lead">{esc(d["ed_p"])}</p>'
        + '<div style="margin-top:6px">' + cues([('点任意一行，直接听这句', 'HEVC、DTS 这些浏览器放不了的格式也能预览，随包带了 ffmpeg'), ('改字、调时间、增删合并', '改完重新导出 SRT 或 ASS，任何播放器都认')], TCS[:2]) + '</div>' + frame('editor') + stk(['HEVC / DTS 也能预览', '改字 · 调时间 · 增删合并']) + foot('改完重新导出，任何播放器都认')))
    cards.append(('batch', tab('整季.srt') + '<div class="h" style="font-size:72px">一季 24 集，<br>拖一次</div>' + f'<p class="lead">{esc(d["ba_p"])}</p>'
        + '<div style="margin-top:6px">' + cues([('同一套设置，个别再调', '整个文件夹用一套识别、翻译设置；某几集要换字幕轨、音轨或引擎，在队列里单独指定'), ('每集都有质检结论', '哪里漏了、哪里语速太快，跑完直接标出来；术语表让人名整季一致')], TCS[:2]) + '</div>' + frame('batch') + stk(['术语表：人名整季一致', '每集都有质检结论']) + foot('跑完每一集字幕都在影片旁边')))
    cards.append(('free', tab('说明.txt') + '<div class="h" style="font-size:72px">免费。开源。<br>不联网。</div>' + '<div style="margin-top:14px">' + cues([('不上传', '影片、字幕、你的电脑配置，什么都不发出去；识别和翻译都在这台电脑上完成'), ('没有账号', '下载、打开、拖文件，三步之间没有注册和登录'), ('MIT 开源', '代码在 GitHub 上，谁都能看、能改、能自己打包')], TCS) + '</div>' + frame('settings') + stk(['macOS 12+ · Apple Silicon', 'Windows 10+', '免费 · 没有内购'], 2) + foot('github.com/jason-jm/wavesubs')))
    return cards

def raw_x_en():
    d = bs.T['en']
    foot = lambda note: f'<div class="foot"><span class="url">wavesubs.com</span><span class="note">{esc(note)}</span></div>'
    tab = lambda name: f'<div class="filetab"><i></i>{esc(name)}</div><div class="rule"></div>'
    two = lambda left, right: f'<div style="display:flex;gap:40px;flex:1;min-height:0;margin-top:22px"><div style="flex:0 0 500px;display:flex;flex-direction:column">{left}</div><div class="grow" style="flex:1;min-width:0;margin-top:0;justify-content:center">{right}</div></div>'
    stk = lambda xs: '<div class="stickers" style="padding-top:18px">' + ''.join(f'<span class="stk" style="font-size:20px;padding:9px 16px">{esc(x)}</span>' for x in xs) + '</div>'
    return [
        ('x1-cover', tab('Harbor.Lights.S01E03.en.srt') + two('<div class="h" style="font-size:66px;margin-top:8px">Watching raws?<br>Still no <span class="em">subs</span>?</div><p class="lead" style="font-size:23px">Drop the file in. Local AI recognizes the dialogue, fixes the timing, translates it, and writes SRT/ASS next to the video.</p>' + stk(['No upload', 'Free & open source', 'macOS · Windows']),
                                                          still("Forgot it. It's five minutes if I run.", '忘れた。走れば五分だから。', 'SUBBED', raw_stamp='RAW')) + foot('free · open source · no account')),
        ('x2-flow', tab('how-it-works.srt') + '<div class="h" style="font-size:54px;margin-top:10px">Three cues, done</div>' + '<div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:26px">' + ''.join(f'<div><div class="i" style="font-family:{MONO};font-size:40px;font-weight:800">{i+1}</div><div class="t" style="font-family:{MONO};font-size:15px;color:var(--ink3)">{tc}</div><h3 style="margin:8px 0 6px;font-size:28px;font-weight:800;line-height:1.15">{esc(t)}</h3><p style="margin:0;font-size:19px;line-height:1.5;color:var(--ink2)">{esc(b)}</p></div>' for i, ((t, b), tc) in enumerate(zip(d['steps'], TCS))) + '</div><div class="grow"></div>' + foot('a two-hour film: about 3–6 minutes on Apple Silicon')),
        ('x3-editor', tab('edit.srt') + two('<div class="h" style="font-size:60px;margin-top:8px">Click a line,<br>hear the line</div>' + f'<p class="lead" style="font-size:23px">{esc(d["ed_p"])}</p>' + stk(['HEVC / DTS preview', 'Glossary keeps names consistent']),
                                            f'<div class="still shotframe" style="box-shadow:10px 10px 0 var(--ink)"><img src="{shot("en", "editor")}"></div>') + foot('fix text or timing, export again')),
    ]

# ============================================================ 渲染
def render(page_html, w, h, out_jpg, tmp):
    p = os.path.join(tmp, os.path.basename(out_jpg) + '.html'); open(p, 'w', encoding='utf-8').write(page_html)
    prefix = os.path.join(tmp, os.path.basename(out_jpg))
    r = subprocess.run(['npx', 'electron', os.path.join(ROOT, 'scripts', 'shoot-page.cjs'), 'file://' + p, prefix, str(w), str(h), '0'],
                       cwd=ROOT, check=True, capture_output=True, text=True, env={**os.environ, 'OFFSCREEN': '1', 'CHECK_OVERFLOW': '.page'})
    m = [l for l in r.stdout.splitlines() if l.startswith('overflow=')]
    n = int(m[-1].split('=')[1]) if m else 0
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '90', prefix + '-0.png', '--out', out_jpg], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(' ', os.path.relpath(out_jpg, ROOT) + (f'   ⚠ 内容超出 {n}px' if n > 0 else ''))

if __name__ == '__main__':
    posts = sys.argv[1:] or ['update', 'raw']
    tmp = tempfile.mkdtemp(prefix='wavesubs-posts-')
    try:
        for post in posts:
            outdir = os.path.join(OUT, post)
            if os.path.isdir(outdir): shutil.rmtree(outdir)
            os.makedirs(outdir)
            if post == 'update':
                cards = update_cards_zh()
                for i, (cid, body) in enumerate(cards, 1):
                    render(page_a(1080, 1440, '60px 72px 56px', body, f'v1.0.8 · 更新说明 · {i:02d}/{len(cards):02d}'), 1080, 1440, os.path.join(outdir, f'zh-{i:02d}-{cid}.jpg'), tmp)
                for cid, body in update_x_en():
                    render(page_a(1200, 675, '44px 56px 40px', body, 'v1.0.8 · changelog · 2026-09-20'), 1200, 675, os.path.join(outdir, f'en-{cid}.jpg'), tmp)
            else:
                cards = raw_cards_zh()
                for i, (cid, body) in enumerate(cards, 1):
                    render(page_b(1080, 1440, '56px 64px 52px', body), 1080, 1440, os.path.join(outdir, f'zh-{i:02d}-{cid}.jpg'), tmp)
                for cid, body in raw_x_en():
                    render(page_b(1200, 675, '40px 56px 36px', body), 1200, 675, os.path.join(outdir, f'en-{cid}.jpg'), tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
