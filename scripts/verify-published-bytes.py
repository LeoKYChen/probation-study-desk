#!/usr/bin/env python3
"""Compare every artifact byte at one explicitly supplied preview URL. Never writes remotely."""
import argparse, concurrent.futures, hashlib, json, time, urllib.request
from pathlib import Path

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('directory',type=Path)
    parser.add_argument('url')
    args=parser.parse_args()
    if not args.url.startswith('https://'):
        parser.error('An HTTPS preview URL is required')
    manifest=json.loads((args.directory/'mirror-manifest.json').read_text())
    paths=manifest['file_sha256']
    assert paths and len(paths)==manifest['tracked_site_file_count']
    def check(name):
        expected=(args.directory/name).read_bytes()
        if name!='mirror-manifest.json':
            assert hashlib.sha256(expected).hexdigest()==paths[name],name
        last=None
        for attempt in range(4):
            try:
                request=urllib.request.Request(args.url.rstrip('/')+'/'+name,headers={'Cache-Control':'no-cache'})
                with urllib.request.urlopen(request,timeout=25) as response:
                    actual=response.read()
                if actual==expected:
                    return name
                last='bytes differ'
            except Exception as error:
                last=str(error)
            time.sleep(3)
        raise RuntimeError(name+': '+str(last))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        checked=list(pool.map(check,[*paths,'mirror-manifest.json']))
    print(f"PASS: {len(checked)} published files match commit {manifest['source_commit']} byte for byte")
if __name__=='__main__':
    main()
