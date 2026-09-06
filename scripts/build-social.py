#!/usr/bin/env python3
"""社交分享图：每种语言 4 张。
  docs/assets/social/<lang>.jpg        1280×640   官网 og:image / Twitter card（轻）
  store/social/<lang>@2x.jpg           2560×1280  横版高清，发 X / 微博 / 知乎用
  store/social/<lang>-9x16.jpg         1080×1920  竖版，小红书 / 抖音 / Stories
  store/social/<lang>-3x4.jpg          1080×1440  竖版，小红书信息流 / Instagram
用官网文案里的两行标题 + 编辑器截图 + hero 底图渲染成 HTML，Electron 离屏截图（Retina 2×）。
用法：python3 scripts/build-social.py [lang ...]
"""
import os, sys, html, subprocess, importlib.util, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(ROOT, 'scripts', 'build-site.py'))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
OUT_WEB = os.path.join(ROOT, 'docs', 'assets', 'social'); os.makedirs(OUT_WEB, exist_ok=True)
OUT_POST = os.path.join(ROOT, 'store', 'social'); os.makedirs(OUT_POST, exist_ok=True)
esc = lambda s: html.escape(s, quote=True)
FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Segoe UI",Roboto,Helvetica,Arial,sans-serif'

def assets(k):
    sh = bs.SHOTS.get(k, k); a = lambda p: 'file://' + os.path.join(ROOT, 'docs', 'assets', p)
    return a('hero-wave.jpg'), a('icon.png'), a(f'shots/{sh}-dark-editor.jpg')

def landscape(k):
    """1280×640 逻辑像素；离屏 2× 截出 2560×1280"""
    d = bs.T[k]; bg, icon, shot = assets(k); foot = ' · '.join(d['cta_note'])
    return f'''<!doctype html><html lang="{bs.HTML_LANG[k]}"><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1280px;height:640px;overflow:hidden;background:#0b0f17;font-family:{FONT};color:#e8edf5;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:url({bg}) center 60%/cover no-repeat;opacity:.75}}
.grad{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,15,23,.92) 0%,rgba(11,15,23,.78) 50%,rgba(11,15,23,.3) 100%)}}
.col{{position:absolute;left:72px;top:56px;bottom:52px;width:780px;display:flex;flex-direction:column;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600}} .brand img{{width:56px;height:56px;border-radius:14px}}
h1{{margin:0 0 14px;font-size:68px;line-height:1.1;letter-spacing:-.5px;font-weight:700;color:#fff}}
.h2{{margin:0;font-size:38px;line-height:1.2;font-weight:700;background:linear-gradient(90deg,#5fd4d0,#f0a07a);-webkit-background-clip:text;background-clip:text;color:transparent}}
.foot{{font-size:19px;color:#aab4c5;white-space:nowrap;line-height:1.5}} .foot b{{color:#e8edf5;font-weight:600}} .foot span{{margin:0 10px;color:#7b8798}} .foot .l2{{font-size:22px;margin-top:2px}}
.shot{{position:absolute;right:-150px;bottom:-140px;width:700px;border-radius:16px;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.7);transform:rotate(-5deg)}}
</style></head><body><div class="bg"></div><div class="grad"></div>
<img class="shot" src="{shot}">
<div class="col">
  <div class="brand"><img src="{icon}"><span>Wave Subs</span></div>
  <div><h1>{esc(d['h1'])}</h1><p class="h2">{esc(d['h2'])}</p></div>
  <div class="foot"><div>{esc(foot)}</div><div class="l2"><b>macOS</b><span>·</span><b>Windows</b><span>·</span><b>wavesubs.com</b></div></div>
</div></body></html>'''

def portrait(k, w, h):
    """w×h 逻辑像素（540×960 或 540×720）；离屏 2× 截出 1080×1920 / 1080×1440"""
    d = bs.T[k]; bg, icon, shot = assets(k); foot = ' · '.join(d['cta_note'])
    tall = h >= 900
    return f'''<!doctype html><html lang="{bs.HTML_LANG[k]}"><head><meta charset="utf-8"><style>
html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:#0b0f17;font-family:{FONT};color:#e8edf5;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:url({bg}) 60% 40%/cover no-repeat;opacity:.7}}
.grad{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,15,23,.55) 0%,rgba(11,15,23,.85) 45%,rgba(11,15,23,.97) 100%)}}
.col{{position:absolute;left:44px;right:44px;top:{56 if tall else 40}px;bottom:{44 if tall else 32}px;display:flex;flex-direction:column}}
.brand{{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:600}} .brand img{{width:42px;height:42px;border-radius:11px}}
.title{{margin-top:{56 if tall else 30}px}}
h1{{margin:0 0 10px;font-size:{46 if tall else 40}px;line-height:1.12;letter-spacing:-.4px;font-weight:700;color:#fff}}
.h2{{margin:0;font-size:{26 if tall else 23}px;line-height:1.25;font-weight:700;background:linear-gradient(90deg,#5fd4d0,#f0a07a);-webkit-background-clip:text;background-clip:text;color:transparent}}
.lead{{margin:{18 if tall else 12}px 0 0;font-size:{16 if tall else 14.5}px;line-height:1.55;color:#aab4c5}}
.pills{{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}} .pill{{font-size:13px;color:#aab4c5;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);border-radius:999px;padding:5px 12px}}
.shotwrap{{flex:1;display:flex;align-items:center;margin:{22 if tall else 14}px 0}}
.shot{{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.65);display:block}}
.foot{{font-size:{14 if tall else 13}px;color:#aab4c5;line-height:1.5;text-align:center}} .foot b{{color:#e8edf5;font-weight:600}} .foot span{{margin:0 8px;color:#7b8798}} .foot .l2{{font-size:{17 if tall else 15}px;margin-top:2px}}
</style></head><body><div class="bg"></div><div class="grad"></div>
<div class="col">
  <div class="brand"><img src="{icon}"><span>Wave Subs</span></div>
  <div class="title"><h1>{esc(d['h1'])}</h1><p class="h2">{esc(d['h2'])}</p>{'<p class="lead">' + esc(d['lead']) + '</p><div class="pills">' + ''.join('<span class="pill">' + esc(x) + '</span>' for x in d['pills']) + '</div>' if tall else ''}</div>
  <div class="shotwrap"><img class="shot" src="{shot}"></div>
  <div class="foot"><div>{esc(foot)}</div><div class="l2"><b>macOS</b><span>·</span><b>Windows</b><span>·</span><b>wavesubs.com</b></div></div>
</div></body></html>'''

def shoot(page, prefix, w, h):
    subprocess.run(['npx', 'electron', os.path.join(ROOT, 'scripts', 'shoot-page.cjs'), 'file://' + page, prefix, str(w), str(h), '0'],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env={**os.environ, 'OFFSCREEN': '1'})
    return prefix + '-0.png'

def jpg(src, out, width, q=86):
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(q), '--resampleWidth', str(width), src, '--out', out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return f'{os.path.relpath(out, ROOT)} ({os.path.getsize(out)//1024} KB)'

langs = sys.argv[1:] or bs.LANGS
tmp = tempfile.mkdtemp(prefix='wavesubs-social-')
try:
    for k in langs:
        page = os.path.join(tmp, f'{k}.html'); open(page, 'w', encoding='utf-8').write(landscape(k))
        png = shoot(page, os.path.join(tmp, k), 1280, 640)          # 2560×1280
        print(jpg(png, os.path.join(OUT_WEB, f'{k}.jpg'), 1280), '|', jpg(png, os.path.join(OUT_POST, f'{k}@2x.jpg'), 2560, 88))
        for name, (w, h) in {'9x16': (540, 960), '3x4': (540, 720)}.items():
            page = os.path.join(tmp, f'{k}-{name}.html'); open(page, 'w', encoding='utf-8').write(portrait(k, w, h))
            png = shoot(page, os.path.join(tmp, f'{k}-{name}'), w, h)   # 1080×1920 / 1080×1440
            print('  ', jpg(png, os.path.join(OUT_POST, f'{k}-{name}.jpg'), 1080, 88))
finally:
    shutil.rmtree(tmp, ignore_errors=True)
