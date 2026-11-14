#!/usr/bin/env python3
"""把考選部「評分要點與閱卷委員的話」PDF 轉成 v2.5/official-points.js。

單檔：python3 scripts/extract-moex-points.py <pdf> <年度> <題庫科目> <題庫id前綴> [--merge]
批次：python3 scripts/extract-moex-points.py --batch <評分要點資料夾>
      資料夾結構為 <年度>/<檔名>.pdf；檔名依 FILE_RULES 對應科目（107 年只取律師卷與選試科目）。

題號對應：PDF 的「第一題」→ <前綴>-1。只收錄 PDF 實際有的文字，不改寫、不補內容。
段落由版面推斷：一行明顯比版心短，或以句號、冒號結尾，就視為段落結束。"""
import json, re, subprocess, sys, pathlib, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'v2.5' / 'official-points.js'
NUM = '一二三四五六七八九十'
# 檔名關鍵字 → (題庫科目, id 後綴)。由上而下比對，先中先用。
FILE_RULES = [
    ('民法與民事訴訟法(一', '民法與民事訴訟法', '民法與民訴-一'), ('民法與民事訴訟法(二', '民法與民事訴訟法', '民法與民訴-二'),
    ('民一', '民法與民事訴訟法', '民法與民訴-一'), ('民二', '民法與民事訴訟法', '民法與民訴-二'),
    ('海商', '海商法與海洋法', '海商法與海洋法'), ('海海', '海商法與海洋法', '海商法與海洋法'),
    ('憲法與行政法', '憲法與行政法', 'constitutional-administrative-law'), ('公法', '憲法與行政法', 'constitutional-administrative-law'),
    ('刑法', '刑法與刑事訴訟法', 'criminal-law-procedure'),
    ('公司法', '公司法、保險法與證券交易法', 'commercial-law'), ('商法', '公司法、保險法與證券交易法', 'commercial-law'),
    ('勞動社會法', '勞動社會法', '勞動社會法'), ('勞社', '勞動社會法', '勞動社會法'),
    ('智慧財產法', '智慧財產法', '智慧財產法'), ('智財', '智慧財產法', '智慧財產法'),
    ('財稅', '財稅法', '財稅法'),
]
# 題庫內部代號與原卷題號不一致的例外（原卷題號 → 題庫 id）。
# 112 年憲法與行政法：LawPlayer 下載檔缺第 1 題，題庫原有的 …-1 其實是原卷第 2 題；第 1 題後來由原卷 PDF 補入。
ID_OVERRIDES = {
    'lawplayer-112-constitutional-administrative-law-1': 'moex-112-constitutional-administrative-law-1',
    'lawplayer-112-constitutional-administrative-law-2': 'lawplayer-112-constitutional-administrative-law-1',
}
HEAD = re.compile(r'^(【.+】|[壹貳參肆伍陸柒捌]、|[一二三四五六七八九十]+、|[（(][一二三四五六七八九十]+[）)]|第[（(][一二三四五六七八九十]+[）)]\s*(子題|小題)|[1-9][0-9]?[.、．])')
END = re.compile(r'(。|：|:|。」|。）|！|？|\?)$')
SECTIONS = (('overview', r'總[題體]說明'), ('points', r'評分要點'), ('commentary', r'閱卷委員的話'))
TAG = r'^[ \t\f]*【(?:總[題體]說明|評分要點|閱卷委員的話)】[ \t]*$'


def width(s):
    return sum(2 if unicodedata.east_asian_width(c) in 'WF' else 1 for c in s)


def clean(block, full):
    """block：一個區段的原始文字；full：版心寬度（顯示寬度）。回傳段落陣列。"""
    paras, cur, prev_w, ind0 = [], '', 0, 0
    for ln in block.replace('\f', '\n').split('\n'):
        s = ln.strip()
        if not s or re.fullmatch(r'\d{1,3}', s):
            continue
        w = width(ln.rstrip())
        ind = width(ln) - width(ln.lstrip())
        if cur:
            glue = s[0] in '，。、；：）」』？！,.;:)'          # 標點被版面擠到下一行：一定接回去
            short = prev_w < full * 0.82                      # 上一行沒寫滿：段落結束
            heading = bool(HEAD.match(cur)) and not END.search(cur) and prev_w < full - 3 and (ind > ind0 + 2 or bool(HEAD.match(s)))  # 沒寫滿的標題，後面接縮排內文或另一個標題（寫滿的是懸掛縮排的內文，不拆）
            if not glue and (short or END.search(cur) or heading):
                paras.append(cur); cur = ''
        if not cur:
            ind0 = ind
        cur += s
        prev_w = w
    if cur:
        paras.append(cur)
    return paras


def parse(pdf):
    raw = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True, check=True).stdout
    widths = sorted(width(l.rstrip()) for l in raw.split('\n') if l.strip())
    full = widths[int(len(widths) * 0.9)] if widths else 80
    parts = re.split(r'^[ \t\f]*(第[一二三四五六七八九十]+題)[ \t]*$', raw, flags=re.M)
    out = {}
    for i in range(1, len(parts), 2):
        n = NUM.index(parts[i][1]) + 1
        if n in out:            # 有些檔案整份內容重複多次，只取第一次
            continue
        body, sec = parts[i + 1], {}
        marks = [(m.start(), m.end(), m.group(0)) for m in re.finditer(TAG, body, flags=re.M)]
        for key, name in SECTIONS:
            text = ''
            for j, (a, b, tag) in enumerate(marks):
                if re.search(name, tag):
                    text = body[b:marks[j + 1][0] if j + 1 < len(marks) else len(body)]
                    break
            sec[key] = clean(text, full)
        out[n] = sec
    return out


def load():
    if not OUT.exists():
        return {}
    m = re.search(r'= (\{.*\});', OUT.read_text(encoding='utf-8'), flags=re.S)
    return json.loads(m.group(1)) if m else {}


def save(data):
    ordered = dict(sorted(data.items(), key=lambda kv: (kv[1]['subject'], -kv[1]['year'], kv[0])))
    OUT.write_text('/* 由 scripts/extract-moex-points.py 產生。內容摘自考選部公布之「評分要點與閱卷委員的話」，僅供自我檢核，非唯一答案。 */\n'
                   'window.OFFICIAL_POINTS = ' + json.dumps(ordered, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')


def entries(pdf, year, subject, prefix):
    return {ID_OVERRIDES.get(f'{prefix}-{n}', f'{prefix}-{n}'): {'year': int(year), 'subject': subject, 'questionNo': n, **sec} for n, sec in parse(pdf).items()}


def batch(folder):
    data, report = {}, []
    for pdf in sorted(pathlib.Path(folder).glob('*/*.pdf')):
        year, name = pdf.parent.name, pdf.name
        if not year.isdigit():
            continue
        if '成績' in name:
            report.append((str(pdf), 'skip', '成績統計，不是評分要點')); continue
        if year == '107' and re.match(r'107司', name):
            report.append((str(pdf), 'skip', '107 年司法官卷：題庫收的是律師卷')); continue
        rule = next((r for r in FILE_RULES if r[0] in name), None)
        if not rule:
            report.append((str(pdf), 'skip', '檔名對不到科目')); continue
        got = entries(pdf, year, rule[1], f'lawplayer-{year}-{rule[2]}')
        if not got:
            report.append((str(pdf), 'skip', '讀不到文字（掃描檔）或找不到「第一題」')); continue
        data.update(got)
        report.append((str(pdf), 'ok', ' '.join(f"{v['questionNo']}:{len(v['overview'])}/{len(v['points'])}/{len(v['commentary'])}" for k, v in got.items())))
    return data, report


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--batch':
        data, report = batch(sys.argv[2])
        save(data)
        for path, status, note in report:
            print(status.upper().ljust(5), path, '|', note)
        print(f'共 {len(data)} 題寫入 {OUT}')
    else:
        pdf, year, subject, prefix = sys.argv[1:5]
        data = load() if '--merge' in sys.argv else {}
        got = entries(pdf, year, subject, prefix)
        data.update(got); save(data)
        for k, v in got.items():
            print(k, {a: len(b) for a, b in v.items() if isinstance(b, list)})
