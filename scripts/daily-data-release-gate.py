#!/usr/bin/env python3
"""Allow unattended releases only when deployed bytes differ in daily data files."""
import json, os, re, urllib.request
from pathlib import Path

ALLOWED = {'daily-simulation/questions.json', 'daily-simulation/documents.json', 'file-data/daily.generated.js'}
REPOSITORY = 'LeoKYChen/probation-study-desk'

def eligible(previous, current):
    for manifest in (previous, current):
        if manifest.get('repository') != REPOSITORY or not re.fullmatch('[0-9a-f]{40}', manifest.get('source_commit', '')):
            return False
        hashes = manifest.get('file_sha256')
        if not isinstance(hashes, dict) or not hashes or any(not isinstance(h, str) or not re.fullmatch('[0-9a-f]{64}', h) for h in hashes.values()):
            return False
    before, after = previous['file_sha256'], current['file_sha256']
    # Never auto-delete or add deployed files; compare the entire deployed tree,
    # not just this push, so pending application changes cannot ride along.
    if before.keys() != after.keys():
        return False
    changed = {p for p in before if before[p] != after[p]}
    return bool(changed) and changed <= ALLOWED

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
