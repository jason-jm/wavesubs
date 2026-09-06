#!/usr/bin/env python3
"""3:4 竖版宣传图（小红书 / Instagram 信息流），每种语言 11 张，2160×2880。
封面 + 8 个功能页（对应 store/screenshots 的 8 张界面截图）+ 配置要求表 + 常见问题。
文案全部复用官网各语言文案（scripts/build-site.py 的 T 字典），不另外翻译。
用法：python3 scripts/build-cards.py [lang ...]   → store/social/3x4/<lang>/<序号>-<id>.jpg
只重出某几张：CARDS=export,faq python3 scripts/build-cards.py zh
"""
import os, sys, html, subprocess, importlib.util, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(ROOT, 'scripts', 'build-site.py'))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
esc = lambda s: html.escape(s, quote=True)
FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Segoe UI",Roboto,Helvetica,Arial,sans-serif'
W, H = 1080, 1440   # 逻辑像素，离屏 2× 截出 2160×2880
SHOT_DIR = os.path.join(ROOT, 'store', 'screenshots')
OUT = os.path.join(ROOT, 'store', 'social', '3x4')

def shot_path(k, scene):
    """优先用 2880×1800 的 PNG 原图；没有就退回官网的 1920 JPEG"""
    loc = bs.SHOTS.get(k, k)
    p = os.path.join(SHOT_DIR, loc, f'{scene}.png')
    if not os.path.exists(p):
        p = os.path.join(ROOT, 'docs', 'assets', 'shots', f'{loc}-dark-{scene}.jpg')
    return 'file://' + p

CSS = f'''
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#0b0f17;font-family:{FONT};color:#e8edf5;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:url(file://{os.path.join(ROOT,'docs','assets','hero-wave.jpg')}) 55% 30%/cover no-repeat;opacity:.55}}
.grad{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,15,23,.6) 0%,rgba(11,15,23,.9) 40%,rgba(11,15,23,.98) 100%)}}
.col{{position:absolute;left:64px;right:64px;top:56px;bottom:52px;display:flex;flex-direction:column}}
.top{{display:flex;align-items:center;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:600}} .brand img{{width:56px;height:56px;border-radius:14px}}
.idx{{font-size:22px;color:#7b8798;letter-spacing:1px;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 14px}}
.kicker{{margin-top:40px;font-size:28px;font-weight:600;color:#5fd4d0;letter-spacing:.5px}}
h1{{margin:10px 0 0;font-size:68px;line-height:1.14;letter-spacing:-.5px;font-weight:700;color:#fff}}
h1.small{{font-size:52px}}
.h2{{margin:8px 0 0;font-size:36px;line-height:1.25;font-weight:700;background:linear-gradient(90deg,#5fd4d0,#f0a07a);-webkit-background-clip:text;background-clip:text;color:transparent}}
.lead{{margin:22px 0 0;font-size:32px;line-height:1.55;color:#aab4c5}}
.bullets{{margin:22px 0 0;padding:0;list-style:none;display:grid;gap:12px}}
.bullets li{{position:relative;padding-left:36px;font-size:31px;line-height:1.5;color:#d5dbe6}}
.bullets li::before{{content:"";position:absolute;left:4px;top:18px;width:12px;height:12px;border-radius:50%;background:linear-gradient(90deg,#5fd4d0,#f0a07a)}}
.steps{{margin-top:26px;display:grid;gap:18px}}
.step{{display:flex;gap:18px;align-items:flex-start}}
.step .k{{flex:none;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#5fd4d0,#7fb3ff);color:#0b0f17;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center}}
.step h3{{margin:4px 0 6px;font-size:34px;font-weight:700}} .step p{{margin:0;font-size:29px;line-height:1.5;color:#aab4c5}}
.pills{{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}} .pill{{font-size:27px;color:#d5dbe6;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);border-radius:999px;padding:10px 22px}}
.shotwrap{{flex:1;display:flex;align-items:center;justify-content:center;margin:26px 0 18px;min-height:0}}
.shot{{max-width:100%;max-height:100%;object-fit:contain;border-radius:18px;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 90px rgba(0,0,0,.7);display:block}}
.spacer{{flex:1}}
.foot{{font-size:26px;color:#aab4c5;line-height:1.5;text-align:center}} .foot b{{color:#e8edf5;font-weight:600}} .foot span{{margin:0 10px;color:#7b8798}} .foot .l2{{font-size:30px;margin-top:2px}}
table{{border-collapse:collapse;width:100%;margin-top:26px;font-size:28px}}
th,td{{text-align:left;padding:18px 14px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:top;line-height:1.35}}
th{{font-size:23px;color:#7b8798;font-weight:600}} td:first-child{{font-weight:700;white-space:nowrap}} td.note{{color:#aab4c5;font-size:25px}}
.faq{{margin-top:26px;display:grid;gap:22px}} .faq h3{{margin:0 0 8px;font-size:35px;font-weight:700}} .faq p{{margin:0;font-size:29px;line-height:1.55;color:#aab4c5}}
.cards{{display:grid;gap:14px;margin-top:22px}} .card{{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);border-radius:16px;padding:18px 22px}}
.card b{{display:block;font-size:32px;margin-bottom:6px}} .card span{{font-size:28px;line-height:1.5;color:#aab4c5}}
'''

def page(k, idx, total, body, kicker=''):
    d = bs.T[k]; icon = 'file://' + os.path.join(ROOT, 'docs', 'assets', 'icon.png')
    foot = ' · '.join(d['cta_note'])
    return f'''<!doctype html><html lang="{bs.HTML_LANG[k]}"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="bg"></div><div class="grad"></div>
<div class="col">
  <div class="top"><div class="brand"><img src="{icon}"><span>Wave Subs</span></div><div class="idx">{idx:02d} / {total}</div></div>
  {body}
  <div class="foot"><div>{esc(foot)}</div><div class="l2"><b>macOS</b><span>·</span><b>Windows</b><span>·</span><b>wavesubs.com</b></div></div>
</div></body></html>'''

def cards(k):
    d = bs.T[k]; s = lambda scene: shot_path(k, scene)
    pills = lambda xs: '<div class="pills">' + ''.join(f'<span class="pill">{esc(x)}</span>' for x in xs) + '</div>'
    bullets = lambda xs: '<ul class="bullets">' + ''.join(f'<li>{esc(x)}</li>' for x in xs) + '</ul>'
    shot = lambda scene: f'<div class="shotwrap"><img class="shot" src="{s(scene)}"></div>'
    combos = d['req_combo']
    out = []
    # 1 封面
    out.append(('cover', f'''<h1 style="margin-top:56px">{esc(d['h1'])}</h1><p class="h2">{esc(d['h2'])}</p>
      <p class="lead">{esc(d['lead'])}</p>{pills(d['pills'])}{shot('editor')}'''))
    # 2 流程：拖入 + 识别对齐
    st = d['steps']
    out.append(('flow', f'''<div class="kicker">{esc(d['how_h2'])}</div><h1 class="small">{esc(d['how_sub'])}</h1>
      <div class="steps">{''.join(f'<div class="step"><div class="k">{i+1}</div><div><h3>{esc(t)}</h3><p>{esc(b)}</p></div></div>' for i,(t,b) in enumerate(st[:2]))}</div>{shot('home-running')}'''))
    # 3 翻译并导出
    out.append(('export', f'''<h1 style="margin-top:44px">{esc(st[2][0])}</h1><p class="lead">{esc(st[2][1])}</p>{pills([d['pills'][0], d['pills'][2]])}{shot('home-done')}'''))
    # 4 编辑器
    out.append(('editor', f'''<h1 style="margin-top:44px">{esc(d['ed_h2'])}</h1><p class="lead">{esc(d['ed_p'])}</p>{pills([d['hero_note']])}{shot('editor')}'''))
    # 5 翻译模型
    out.append(('translate', f'''<h1 style="margin-top:44px">{esc(d['tr_h2'])}</h1><p class="lead">{esc(d['tr_p'])}</p>{bullets(d['tr_li'])}{shot('translate-models')}'''))
    # 6 批量
    out.append(('batch', f'''<h1 style="margin-top:44px">{esc(d['ba_h2'])}</h1><p class="lead">{esc(d['ba_p'])}</p>{shot('batch')}'''))
    # 7 术语表
    out.append(('glossary', f'''<h1 class="small" style="margin-top:44px">{esc(d['tr_li'][0])}</h1><p class="lead">{esc(d['tr_li'][2])}</p>{pills([d['pills'][1], d['tr_li'][1]])}{shot('glossary')}'''))
    # 8 模型页
    out.append(('models', f'''<h1 style="margin-top:44px">{esc(d['req_h2'])}</h1><p class="lead">{esc(d['req_sub'])}</p>
      {bullets([f"{m}: {a} + {l}" for m,a,l,_ in combos[:3]])}{shot('models')}'''))
    # 9 配置要求表（纯文字）
    rows = ''.join(f'<tr><td>{esc(m)}</td><td>{esc(a)}<br>{esc(l)}</td><td class="note">{esc(n)}</td></tr>' for m,a,l,n in combos)
    cc = d['req_combo_cols']
    out.append(('requirements', f'''<div class="kicker">{esc(d['req_h2'])}</div><h1 class="small">{esc(d['req_combo_h3'])}</h1>
      <table><thead><tr><th>{esc(cc[0])}</th><th>{esc(cc[1])} + {esc(cc[2])}</th><th>{esc(cc[3])}</th></tr></thead><tbody>{rows}</tbody></table>
      <p class="lead" style="font-size:21px">{esc(d['req_notes'][1])}</p><div class="spacer"></div>'''))
    # 10 隐私
    out.append(('privacy', f'''<h1 style="margin-top:44px">{esc(d['pr_h2'])}</h1><p class="lead">{esc(d['pr_sub'])}</p>
      <div class="cards">{''.join(f'<div class="card"><b>{esc(t)}</b><span>{esc(b)}</span></div>' for t,b in d['pr_cards'])}</div>{shot('settings')}'''))
    # 11 常见问题
    qa = d['faq'][:5]
    out.append(('faq', f'''<h1 style="margin-top:44px">{esc(d['faq_h2'])}</h1>
      <div class="faq">{''.join(f'<div><h3>{esc(q)}</h3><p>{esc(a)}</p></div>' for q,a in qa)}</div><div class="spacer"></div>'''))
    return out

def shoot(page_path, prefix):
    r = subprocess.run(['npx', 'electron', os.path.join(ROOT, 'scripts', 'shoot-page.cjs'), 'file://' + page_path, prefix, str(W), str(H), '0'],
                       cwd=ROOT, check=True, capture_output=True, text=True, env={**os.environ, 'OFFSCREEN': '1', 'CHECK_OVERFLOW': '.col'})
    m = [l for l in r.stdout.splitlines() if l.startswith('overflow=')]
    n = int(m[-1].split('=')[1]) if m else 0
    if n > 0: print(f'  ⚠ 内容超出 {n}px: {os.path.basename(prefix)}')
    return prefix + '-0.png'

langs = sys.argv[1:] or bs.LANGS
tmp = tempfile.mkdtemp(prefix='wavesubs-cards-')
try:
    for k in langs:
        outdir = os.path.join(OUT, k); os.makedirs(outdir, exist_ok=True)
        cs = cards(k)
        only = [x for x in os.environ.get('CARDS', '').split(',') if x]
        for i, (cid, body) in enumerate(cs, 1):
            if only and cid not in only: continue
            p = os.path.join(tmp, f'{k}-{i}.html'); open(p, 'w', encoding='utf-8').write(page(k, i, len(cs), body))
            png = shoot(p, os.path.join(tmp, f'{k}-{i}'))
            out = os.path.join(outdir, f'{i:02d}-{cid}.jpg')
            subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', png, '--out', out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f'{k}: {len(cs)} 张 → {os.path.relpath(outdir, ROOT)}')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
