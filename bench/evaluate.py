#!/usr/bin/env python3
"""把生成的字幕与影片自带字幕（ground truth）对比，输出可量化的质量指标。

注意：GT 是人工精修过的字幕，会做口语化压缩、省略语气词，
所以 WER 永远不会是 0。这里关心的是**系统性问题**与**相对改进**：
漏段、幻觉、时间轴偏移，以及改动前后的指标变化。
"""
import re
import sys
import unicodedata
from pathlib import Path

TIME_RE = re.compile(
    r'(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{2}):(\d{2})[,.](\d{1,3})'
)


def parse_srt(path):
    raw = Path(path).read_bytes()
    for enc in ('utf-8-sig', 'utf-8', 'gb18030', 'shift_jis', 'latin-1'):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    cues, i = [], 0
    while i < len(lines):
        m = TIME_RE.search(lines[i])
        if not m:
            i += 1
            continue
        g = [int(x) for x in m.groups()]
        start = (g[0] * 3600 + g[1] * 60 + g[2]) + g[3] / 1000
        end = (g[4] * 3600 + g[5] * 60 + g[6]) + g[7] / 1000
        i += 1
        buf = []
        while i < len(lines) and lines[i].strip() and not TIME_RE.search(lines[i]):
            buf.append(lines[i])
            i += 1
        body = '\n'.join(buf).strip()
        if body and end > start:
            cues.append((start, end, body))
    return cues


# SDH 标记、说话人标签、歌词记号等，不属于语音内容
SDH_PATTERNS = [
    re.compile(r'\[[^\]]*\]'),          # [DOOR CREAKS]
    re.compile(r'\([^)]*\)'),           # (laughs)
    re.compile(r'♪[^♪]*♪?'),            # ♪ lyrics ♪
    re.compile(r'<[^>]+>'),             # <i>
    re.compile(r'\{\\[^}]*\}'),         # ASS 覆写
    re.compile(r'^\s*[-–—]\s*', re.M),  # 对话破折号
    re.compile(r'^[A-Z][A-Z0-9 .\'#-]{1,20}:\s*', re.M),  # SPEAKER:
]

CJK = re.compile(r'[぀-ヿ㐀-䶿一-鿿豈-﫿]')


def normalize(text):
    for pat in SDH_PATTERNS:
        text = pat.sub(' ', text)
    text = unicodedata.normalize('NFKC', text).lower()
    # 去掉除 CJK/字母/数字/空白之外的一切
    text = ''.join(ch if (ch.isalnum() or ch.isspace()) else ' ' for ch in text)
    return re.sub(r'\s+', ' ', text).strip()


def tokenize(text):
    """CJK 按字切，其余按词切（中日文没有空格分词）"""
    out = []
    for chunk in text.split():
        if CJK.search(chunk):
            out.extend(list(chunk))
        else:
            out.append(chunk)
    return out


def levenshtein(a, b):
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def windowed_error_rate(gt, hyp, window=30.0):
    """按时间窗切片后逐窗对齐，避免整片 O(n²) 且对局部时移更稳健"""
    if not gt:
        return None, 0
    horizon = max(c[1] for c in gt)
    edits = total = 0
    for w0 in range(0, int(horizon) + 1, int(window)):
        w1 = w0 + window
        g = tokenize(normalize(' '.join(c[2] for c in gt if c[0] < w1 and c[1] > w0)))
        h = tokenize(normalize(' '.join(c[2] for c in hyp if c[0] < w1 and c[1] > w0)))
        if not g and not h:
            continue
        edits += levenshtein(g, h)
        total += len(g)
    return (edits / total if total else None), total


def timing_metrics(gt, hyp):
    """句子起点/终点偏差。正数=我们晚，负数=我们早"""
    starts, ends, missed = [], [], 0
    for gs, ge, _ in gt:
        best, best_ov = None, 0
        for hs, he, _ in hyp:
            if he <= gs or hs >= ge:
                continue
            ov = min(he, ge) - max(hs, gs)
            if ov > best_ov:
                best, best_ov = (hs, he), ov
        if best is None:
            missed += 1
        else:
            starts.append(best[0] - gs)
            ends.append(best[1] - ge)
    return starts, ends, missed


def onset_metrics(gt, hyp, gap=1.5):
    """只看「一段话的第一句」——用户最能感知的提前/延后就在这里"""
    deltas = []
    prev_end = -99.0
    for gs, ge, _ in gt:
        if gs - prev_end > gap:  # 这是一个新语音块的开头
            cands = [h for h in hyp if h[1] > gs - 3 and h[0] < ge]
            if cands:
                deltas.append(min(cands, key=lambda h: abs(h[0] - gs))[0] - gs)
        prev_end = max(prev_end, ge)
    return deltas


def median(xs):
    if not xs:
        return float('nan')
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def pct_within(xs, t):
    return 100 * sum(1 for x in xs if abs(x) <= t) / len(xs) if xs else float('nan')


def speech_coverage(gt, hyp):
    """GT 认为有人说话的时间里，我们覆盖了多少"""
    def merge(cues):
        out = []
        for s, e, _ in sorted(cues):
            if out and s <= out[-1][1]:
                out[-1][1] = max(out[-1][1], e)
            else:
                out.append([s, e])
        return out
    g, h = merge(gt), merge(hyp)
    if not g:
        return float('nan')
    total = sum(e - s for s, e in g)
    covered, j = 0.0, 0
    for gs, ge in g:
        while j < len(h) and h[j][1] <= gs:
            j += 1
        k = j
        while k < len(h) and h[k][0] < ge:
            covered += max(0, min(h[k][1], ge) - max(h[k][0], gs))
            k += 1
    return 100 * covered / total


def structural(hyp):
    dups = sum(1 for i in range(1, len(hyp)) if hyp[i][2].strip() == hyp[i - 1][2].strip())
    longs = sum(1 for s, e, _ in hyp if e - s > 15)
    gaps = []
    prev = 0.0
    for s, e, _ in hyp:
        if s - prev > 60:
            gaps.append((prev, s))
        prev = max(prev, e)
    return dups, longs, gaps


def evaluate(name, gt_path, hyp_path):
    gt, hyp = parse_srt(gt_path), parse_srt(hyp_path)
    wer, ref_tokens = windowed_error_rate(gt, hyp)
    starts, ends, missed = timing_metrics(gt, hyp)
    onsets = onset_metrics(gt, hyp)
    dups, longs, gaps = structural(hyp)
    cov = speech_coverage(gt, hyp)

    print(f'\n===== {name} =====')
    print(f'GT {len(gt)} 条 / 生成 {len(hyp)} 条 · 参照词数 {ref_tokens}')
    print(f'词错率 WER      {wer * 100:6.1f}%   (GT 为人工精修字幕，10~25% 属正常范围)')
    print(f'语音覆盖率      {cov:6.1f}%   (GT 有人说话的时间里我们出字幕的比例)')
    print(f'漏掉的 GT 条目  {missed:6d}    ({100 * missed / len(gt):.1f}%)')
    print(f'句首偏差 中位   {median(onsets):+6.2f}s  ±0.5s内 {pct_within(onsets, 0.5):.0f}% · ±1s内 {pct_within(onsets, 1.0):.0f}%')
    print(f'起点偏差 中位   {median(starts):+6.2f}s  终点偏差 中位 {median(ends):+6.2f}s')
    print(f'结构问题        重复 {dups} · 超15s长条 {longs} · >60s空洞 {len(gaps)}')
    if gaps[:3]:
        print(f'  空洞位置: ' + ', '.join(f'{int(a // 60)}:{int(a % 60):02d}→{int(b // 60)}:{int(b % 60):02d}' for a, b in gaps[:3]))
    return {'wer': wer, 'cov': cov, 'onset': median(onsets), 'missed': missed, 'dups': dups, 'gaps': len(gaps)}


if __name__ == '__main__':
    if len(sys.argv) < 4 or (len(sys.argv) - 1) % 3:
        print('用法: evaluate.py <名称> <GT.srt> <生成.srt> [名称 GT 生成 ...]')
        sys.exit(1)
    args = sys.argv[1:]
    for i in range(0, len(args), 3):
        evaluate(args[i], args[i + 1], args[i + 2])
