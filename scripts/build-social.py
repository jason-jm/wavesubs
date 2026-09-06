#!/usr/bin/env python3
"""社交分享卡片（og:image / Twitter card / GitHub social preview）：每种语言一张 1280×640。
用官网文案里的两行标题 + 编辑器截图 + hero 底图渲染成 HTML，再用 Electron 截图。
用法：python3 scripts/build-social.py   → docs/assets/social/<lang>.jpg
"""
import os, sys, html, subprocess, importlib.util, tempfile, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(ROOT, 'scripts', 'build-site.py'))
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
OUT = os.path.join(ROOT, 'docs', 'assets', 'social'); os.makedirs(OUT, exist_ok=True)
esc = lambda s: html.escape(s, quote=True)

def card(k):
    d = bs.T[k]; sh = bs.SHOTS.get(k, k); a = lambda p: 'file://' + os.path.join(ROOT, 'docs', 'assets', p)
    foot = ' · '.join(d['cta_note'])
    return f'''<!doctype html><html lang="{bs.HTML_LANG[k]}"><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1280px;height:640px;overflow:hidden;background:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Hiragino Sans GB","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#e8edf5;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:url({a('hero-wave.jpg')}) center/cover no-repeat;opacity:.6}}
.grad{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,15,23,.94) 0%,rgba(11,15,23,.82) 50%,rgba(11,15,23,.35) 100%)}}
.col{{position:absolute;left:72px;top:56px;bottom:52px;width:780px;display:flex;flex-direction:column;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600}}
.brand img{{width:56px;height:56px;border-radius:14px}}
h1{{margin:0 0 14px;font-size:68px;line-height:1.1;letter-spacing:-.5px;font-weight:700;color:#fff}}
.h2{{margin:0;font-size:38px;line-height:1.2;font-weight:700;background:linear-gradient(90deg,#5fd4d0,#f0a07a);-webkit-background-clip:text;background-clip:text;color:transparent}}
.foot{{font-size:23px;color:#aab4c5}} .foot b{{color:#e8edf5;font-weight:600}} .foot span{{margin:0 12px;color:#7b8798}}
.shot{{position:absolute;right:-150px;bottom:-140px;width:700px;border-radius:16px;border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 120px rgba(0,0,0,.7);transform:rotate(-5deg)}}
</style></head><body><div class="bg"></div><div class="grad"></div>
<img class="shot" src="{a(f'shots/{sh}-dark-editor.jpg')}">
<div class="col">
  <div class="brand"><img src="{a('icon.png')}"><span>Wave Subs</span></div>
  <div><h1>{esc(d['h1'])}</h1><p class="h2">{esc(d['h2'])}</p></div>
  <div class="foot"><b>macOS</b><span>·</span><b>Windows</b><span>·</span>{esc(foot)}<span>·</span>wavesubs.com</div>
</div></body></html>'''

tmp = tempfile.mkdtemp(prefix='wavesubs-social-')
try:
    for k in bs.LANGS:
        page = os.path.join(tmp, f'{k}.html'); open(page, 'w', encoding='utf-8').write(card(k))
        prefix = os.path.join(tmp, k)
        subprocess.run(['npx', 'electron', os.path.join(ROOT, 'scripts', 'shoot-page.cjs'), 'file://' + page, prefix, '1280', '640', '0'],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        png = prefix + '-0.png'; out = os.path.join(OUT, f'{k}.jpg')
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '86', '--resampleWidth', '1280', png, '--out', out], check=True, stdout=subprocess.DEVNULL)
        print(f'{out}: {os.path.getsize(out)//1024} KB')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
