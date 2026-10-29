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
    "storage",
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
    if parts and parts[0] == "storage" and path not in {"storage/indexeddb.js", "storage/study30-mixed-backup.js", "storage/daily-shared-repository.js"}:
        return False
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
    print(f"Daily questions: {len(questions['questions'])}; juvenile research issues: {len(issues['issues'])}")
    print("Only the dedicated Cloudflare preview branch may receive this build.")

if __name__ == "__main__":
    main()
