#!/usr/bin/env python3
"""Audit byte-identical tracked files without changing repository contents.

The optional phase-one gate covers only three redundant root build copies.
Identical bytes elsewhere can be required for offline URLs or mirrors.
"""
import argparse
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT_UNUSED_COPIES = (
    "index (1).html",
    "index-DWXubpQf.js",
    "index-JfbeKn1C.css",
)
REQUIRED = (
    "index.html",
    "juvenile-news/index.html",
    "juvenile-news/source/index.html",
    "juvenile-news/assets/index-DWXubpQf.js",
    "juvenile-news/assets/index-JfbeKn1C.css",
    "juvenile-news/issues.json",
    "juvenile-news/source/public/issues.json",
    "v2.5/questions.js",
    "professional/source-main-questions.js",
    "offline-manifest.json",
)


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def audit(repo):
    output = subprocess.check_output(["git", "ls-files", "-z"], cwd=repo)
    paths = sorted(p.decode("utf-8") for p in output.split(b"\0") if p)
    hashes, groups = {}, defaultdict(list)
    for name in paths:
        file = repo / name
        if not file.is_file() or file.is_symlink():
            continue
        size = file.stat().st_size
        digest = sha256(file)
        hashes[name] = digest
        groups[(digest, size)].append(name)
    duplicates = [
        {"paths": names, "bytes_each": size}
        for (_, size), names in groups.items() if len(names) > 1
    ]
    duplicates.sort(key=lambda item: (-item["bytes_each"], item["paths"][0]))
    return hashes, {
        "tracked_files": len(hashes),
        "root_files": sum("/" not in path for path in hashes),
        "identical_groups": len(duplicates),
        "extra_copies": sum(len(g["paths"]) - 1 for g in duplicates),
        "extra_copy_bytes": sum((len(g["paths"]) - 1) * g["bytes_each"] for g in duplicates),
        "groups": duplicates,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--check-phase1", action="store_true")
    args = parser.parse_args()
    hashes, report = audit(args.repo.resolve())
    errors = []
    if args.check_phase1:
        errors.extend("Redundant root copy remains: " + p for p in ROOT_UNUSED_COPIES if p in hashes)
        errors.extend("Required asset missing: " + p for p in REQUIRED if p not in hashes)
        for a, b in (
            ("juvenile-news/issues.json", "juvenile-news/source/public/issues.json"),
            ("v2.5/questions.js", "professional/source-main-questions.js"),
        ):
            if a in hashes and b in hashes and hashes[a] != hashes[b]:
                errors.append("Mirror differs: " + a + " != " + b)
    report["phase1_ok"] = not errors
    report["phase1_errors"] = errors
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
