#!/usr/bin/env python3
"""Build an isolated Cloudflare mirror from the SAME committed GitHub Pages files.

Only tracked, published static site directories are included. No private browser
records, Google Drive files, Cloudflare credentials, or test artifacts are added.
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "cloudflare-main-mirror-dist"
ROOT_FILES = {
    ".nojekyll",
    "index.html",
    "legacy-home.html",
    "offline.css",
    "offline.js",
    "file-compat.js",
    "ai-prompt-customizer.js",
    "dual-ai-bridge.js",
    "offline-manifest.json",
    "manifest.webmanifest",
    "shared-ui.css",
    "sw.js",
    "favicon.ico",
    "favicon.svg",
}
SITE_DIRS = {
    "study-desk",
    "police-exams",
    "cloud-sync",
    "backup",
    "lectures",
    "offline",
    "print",
    "v2.5",
    "professional",
    "daily-simulation",
    "common-subjects",
    "juvenile-news",
    "active-recall",
    "law-scoring",
    "dongdong-time",
    "study30",
    "pwa",
    "assets",
    "reference-notes",
}
SOURCE_ONLY = {"juvenile-news/source"}
DENY_PARTS = {"node_modules", "__pycache__", ".git", ".github"}
REQUIRED = (
    "index.html",
    "lectures/index.html",
    "lectures/core.js",
    "lectures/app.js",
    "lectures/style.css",
    "lectures/calendar.css",
    "offline/index.html",
    "print/index.html",
    "print/print-model.js",
    "print/app.js",
    "print/style.css",
    "professional/index.html",
    "professional/app.js",
    "professional/source-main-questions.js",
    "professional/source-related-questions.js",
    "professional/sw.js",
    "v2.5/index.html",
    "v2.5/questions.js",
    "v2.5/related-questions.js",
    "v2.5/backup-core.js",
    "daily-simulation/index.html",
    "daily-simulation/questions.json",
    "common-subjects/index.html",
    "common-subjects/english-assistant/index.html",
    "juvenile-news/index.html",
    "juvenile-news/issues.json",
    "sw.js",
    "offline-manifest.json",
    "ai-prompt-customizer.js",
    "dual-ai-bridge.js",
    "police-exams/index.html",
    "police-exams/catalog.json",
    "police-exams/questions.approved.js",
    "police-exams/approved-loader.js",
)

def allowed(path: str) -> bool:
    parts = PurePosixPath(path).parts
    if parts and parts[0] == "cloud-sync" and not path.endswith(".js"):
        return False
    if not parts or any(part in DENY_PARTS for part in parts):
        return False
    if parts[0] == "police-exams":
        return path in {
            "police-exams/index.html", "police-exams/catalog.json",
            "police-exams/questions.approved.js", "police-exams/approved-loader.js",
        }
    if len(parts) == 1:
        return path in ROOT_FILES
    if "/".join(parts[:2]) in SOURCE_ONLY:
        return False
    return parts[0] in SITE_DIRS and not path.endswith((".cjs", ".py", ".ts", ".tsx"))

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def validate_reading_news(folder: Path) -> int:
    """Fail closed when the mirrored news index cannot be resolved without missing or corrupt files."""
    import re
    base = folder / "daily-simulation"
    index = json.loads((base / "documents.json").read_text("utf-8"))
    ids = set()
    def add_document(d, month=None):
        if not isinstance(d, dict) or not isinstance(d.get("id"), str) or not d["id"] or d["id"] in ids:
            raise RuntimeError("Duplicate or missing news ID")
        if month is not None and not str(d.get("date", "")).startswith(month + "-"):
            raise RuntimeError("News item recorded under the wrong archive month")
        ids.add(d["id"])
    def read_shards(shards, expected, month=None):
        if not isinstance(shards, list) or not shards:
            raise RuntimeError("Empty news shard index")
        seen = set()
        count = 0
        for part in shards:
            p = part.get("path") if isinstance(part, dict) else None
            if not isinstance(p, str) or not re.fullmatch(r"news-shards/[0-9a-f]{64}\.json", p) or p in seen:
                raise RuntimeError("Invalid or duplicate news shard path")
            seen.add(p)
            payload_bytes = (base / p).read_bytes()
            if len(payload_bytes) > 1000000:
                raise RuntimeError("News shard exceeds 1MB")
            if hashlib.sha256(payload_bytes).hexdigest() != p.split("/")[-1][:-5]:
                raise RuntimeError("News shard SHA-256 mismatch")
            payload = json.loads(payload_bytes)
            documents = payload.get("documents") if isinstance(payload, dict) else None
            if payload.get("schemaVersion") != 1 or not isinstance(documents, list) or len(documents) != part.get("count"):
                raise RuntimeError("News shard count mismatch")
            for d in documents:
                add_document(d, month)
                count += 1
        if count != expected:
            raise RuntimeError("News total count mismatch")
        return count
    version = index.get("schemaVersion")
    if version == 1:
        for d in index["documents"]:
            add_document(d)
        return len(ids)
    if version == 2:
        return read_shards(index.get("shards"), index.get("count"))
    if version != 3 or not isinstance(index.get("months"), list) or not isinstance(index.get("catalog"), list):
        raise RuntimeError("Unknown news archive format")
    months = set()
    total = 0
    for entry in index["months"]:
        month = entry.get("month") if isinstance(entry, dict) else None
        if not isinstance(month, str) or not re.fullmatch(r"20\d{2}-(?:0[1-9]|1[0-2])", month) or month in months:
            raise RuntimeError("Invalid or duplicate archived month")
        months.add(month)
        expected_path = f"archives/{month}/index.json"
        if entry.get("index") != expected_path:
            raise RuntimeError("Unsafe monthly index path")
        sub = json.loads((base / expected_path).read_text("utf-8"))
        if sub.get("schemaVersion") != 1 or sub.get("month") != month or sub.get("count") != entry.get("count"):
            raise RuntimeError("Monthly index count mismatch")
        total += read_shards(sub.get("shards"), entry["count"], month)
    if total != index.get("count") or len(index["catalog"]) != total or index.get("activeMonth") not in months:
        raise RuntimeError("Monthly master catalog count mismatch")
    cat_ids = set()
    for d in index["catalog"]:
        if not isinstance(d, dict) or d.get("id") not in ids or d["id"] in cat_ids or d.get("month") not in months:
            raise RuntimeError("Monthly article catalog contains invalid or repeated ID")
        cat_ids.add(d["id"])
    if cat_ids != ids:
        raise RuntimeError("Monthly article catalog lost IDs")
    return total


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT
    ).decode("utf-8").split("\0")
    copied = []
    for relative in tracked:
        if not relative or not allowed(relative):
            continue
        original = ROOT / relative
        if original.is_symlink():
            raise ValueError(f"Symlink is not accepted in mirrored static site: {relative}")
        if not original.is_file():
            raise ValueError(f"Tracked file is missing: {relative}")
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        copied.append(relative)
    for relative in REQUIRED:
        dest = OUT / relative
        if not dest.is_file() or not dest.stat().st_size:
            raise RuntimeError(f"Required static resource missing or empty: {relative}")
        if sha256(ROOT / relative) != sha256(dest):
            raise RuntimeError(f"Mirrored file differs from GitHub source: {relative}")
    reading_count = validate_reading_news(OUT)
    questions = json.loads((OUT / "daily-simulation/questions.json").read_text("utf-8"))
    if not isinstance(questions.get("questions"), list) or not questions["questions"]:
        raise RuntimeError("Daily question bank is missing")
    if questions.get("count") != len(questions["questions"]):
        raise RuntimeError("Daily question count is inconsistent")
    issues = json.loads((OUT / "juvenile-news/issues.json").read_text("utf-8"))
    if not isinstance(issues.get("issues"), list) or not issues["issues"]:
        raise RuntimeError("Weekly research data is missing")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip()
    metadata = {
        "repository": "LeoKYChen/probation-study-desk",
        "source_commit": commit,
        "deployment_role": "github-main-static-site",
        "tracked_site_file_count": len(copied),
        "required_file_sha256": {path: sha256(OUT / path) for path in REQUIRED},
        "file_sha256": {path: sha256(OUT / path) for path in sorted(copied)},
    }
    (OUT / "mirror-manifest.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Prepared {len(copied)} identical static resources from commit {commit}")
    print(f"Daily questions: {len(questions['questions'])}; news articles: {reading_count}; juvenile research issues: {len(issues['issues'])}")
    print("Only the dedicated Cloudflare preview branch may receive this build.")

if __name__ == "__main__":
    main()
