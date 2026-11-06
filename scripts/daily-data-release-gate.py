#!/usr/bin/env python3
"""Allow unattended releases only when deployed bytes differ in daily data files."""
import json, os, re, urllib.request
from pathlib import Path

ALLOWED = {'daily-simulation/questions.json', 'daily-simulation/documents.json', 'file-data/daily.generated.js'}
MONTH_JSON = re.compile(r'daily-simulation/archives/(20\d{2}-(?:0[1-9]|1[0-2]))/index\.json')
MONTH_JS = re.compile(r'file-data/archives/(20\d{2}-(?:0[1-9]|1[0-2]))/index\.js')
QUESTION_INDEX = 'daily-simulation/questions-monthly.json'
QUESTION_OFFLINE_INDEX = 'file-data/questions-monthly.generated.js'
QUESTION_SHARD = re.compile(r'daily-simulation/question-shards/([0-9a-f]{64})\.json')
QUESTION_SHARD_JS = re.compile(r'file-data/question-shards/([0-9a-f]{64})\.js')
REPOSITORY = 'LeoKYChen/probation-study-desk'

def eligible(previous, current):
    for manifest in (previous, current):
        if manifest.get('repository') != REPOSITORY or not re.fullmatch('[0-9a-f]{40}', manifest.get('source_commit', '')):
            return False
        hashes = manifest.get('file_sha256')
        if not isinstance(hashes, dict) or not hashes or any(not isinstance(h, str) or not re.fullmatch('[0-9a-f]{64}', h) for h in hashes.values()):
            return False
    before, after = previous['file_sha256'], current['file_sha256']
    # New content-addressed shards may be added, never deleted or overwritten.
    # Application code and every existing unrelated file must stay byte-identical.
    if before.keys() - after.keys():
        return False
    added = after.keys() - before.keys()
    monthly_live = any(MONTH_JSON.fullmatch(p) for p in before)
    questions_live = QUESTION_INDEX in before and QUESTION_OFFLINE_INDEX in before
    new_questions = False
    monthly_data = set()
    for path in added:
        match = re.fullmatch(r'daily-simulation/news-shards/([0-9a-f]{64})\.json', path)
        offline = re.fullmatch(r'file-data/news-shards/([0-9a-f]{64})\.js', path)
        if match:
            if after[path] != match.group(1):
                return False
        elif offline:
            if 'daily-simulation/news-shards/' + offline.group(1) + '.json' not in after:
                return False
        elif path in (QUESTION_INDEX, QUESTION_OFFLINE_INDEX):
            if not questions_live:
                # First conversion needs manual release of website and all shards.
                return False
            new_questions = True
        elif (m := QUESTION_SHARD.fullmatch(path)):
            if not questions_live or after[path] != m.group(1):
                return False
            new_questions = True
        elif (m := QUESTION_SHARD_JS.fullmatch(path)):
            if not questions_live or 'daily-simulation/question-shards/' + m.group(1) + '.json' not in after:
                return False
            new_questions = True
        elif (m := MONTH_JSON.fullmatch(path)):
            if not monthly_live:
                # First v2->v3 migration requires explicit reviewed release.
                return False
            monthly_data.add(m.group(1))
        elif (m := MONTH_JS.fullmatch(path)):
            if not monthly_live:
                return False
            key = 'daily-simulation/archives/' + m.group(1) + '/index.json'
            if key not in after:
                return False
        else:
            return False
    changed = {p for p in before if before[p] != after[p]}
    # The existing archive can be updated by a reviewed manual sync, but
    # only alongside a new master index. Other app code remains frozen.
    monthly_changed = {p for p in changed if MONTH_JSON.fullmatch(p) or MONTH_JS.fullmatch(p)}
    question_meta_changed = {p for p in changed if p in (QUESTION_INDEX, QUESTION_OFFLINE_INDEX)}
    if questions_live and 'daily-simulation/questions.json' in changed:
        # The authoritative bank is now the new month manifest, never a stale legacy JSON.
        return False
    if any(QUESTION_SHARD.fullmatch(p) or QUESTION_SHARD_JS.fullmatch(p) for p in changed):
        return False  # Immutable content-addressed shard and offline wrapper
    if (question_meta_changed or new_questions):
        if not questions_live or QUESTION_INDEX not in changed or QUESTION_OFFLINE_INDEX not in changed:
            return False

    if monthly_changed and not monthly_live:
        return False
    if monthly_changed or monthly_data:
        if 'daily-simulation/documents.json' not in changed:
            return False
    return bool(changed or added) and changed <= ALLOWED | monthly_changed | question_meta_changed

def main():
    allowed = False
    try:
        current = json.loads(Path('cloudflare-main-mirror-dist/mirror-manifest.json').read_text())
        request = urllib.request.Request('https://probation-study30-test.pages.dev/mirror-manifest.json', headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response:
            previous = json.load(response)
        allowed = eligible(previous, current)
    except Exception:
        print('Automatic daily release blocked: live manifest unavailable or invalid; use manual release.')
    if os.environ.get('DAILY_RELEASE_REQUIRED') == 'true' and not allowed:
        raise RuntimeError('Production changed or daily data eligibility was lost; refusing automatic release')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('allowed=' + str(allowed).lower() + '\n')
    print('Daily data-only release eligible: ' + str(allowed).lower())

if __name__ == '__main__':
    main()
