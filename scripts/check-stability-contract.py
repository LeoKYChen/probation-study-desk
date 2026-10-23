#!/usr/bin/env python3
"""Read-only release contract for the frozen Probation Study Desk.

Checks preserved paths, mirrored published data, and intentionally hidden panels.
An optional PR-base comparison emits freeze-scope review warnings; it does not
block security fixes or the explicitly permitted police-past-paper intake.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", help="Git commit SHA for PR changed-path review")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    policy = json.loads((root / "docs/stability-freeze-policy.json").read_text(encoding="utf-8"))
    errors = []
    if policy.get("schemaVersion") != 1 or len(policy.get("routes", [])) != 14:
        errors.append("Expected policy schema v1 and all 14 user-approved routes")
    decisions = {r.get("id"): r.get("decision") for r in policy.get("routes", [])}
    expected = {
        "A": "keep", "B": "keep", "C": "keep", "D": "keep",
        "E": "keep", "F": "pause", "G": "pause", "H": "archive",
        "I": "hidden", "J": "separate", "K": "pause", "L": "keep",
        "M": "separate", "N": "archive",
    }
    if decisions != expected:
        errors.append("Route decisions no longer match the 2026-10-23 approved freeze")
    if policy.get("baseCommit") != "d46ea4b219e6c8cb4fb38627662b4c79a424a932":
        errors.append("Recovery baseline SHA changed")
    for rel in policy.get("criticalPaths", []):
        file = root / rel
        if not file.is_file():
            errors.append("Critical core/archive asset missing: " + rel)
    for left, right in policy.get("identicalMirrors", []):
        a, b = root / left, root / right
        if a.is_file() and b.is_file() and a.read_bytes() != b.read_bytes():
            errors.append("Published mirror mismatch: " + left + " <> " + right)
    for item in policy.get("hiddenInvariants", []):
        file = root / item["path"]
        if file.is_file() and item["literal"] not in file.read_text(encoding="utf-8"):
            errors.append("Previously hidden UI restored without a route decision: " + item["path"])

    # A referenced script must be available on both hosted and offline versions.
    # Parse the simple Python constant collections, rather than substring-checking
    # the builder (a stray comment should never satisfy this contract).
    import ast
    # These assets become mandatory only after police originals are introduced.
    # Main's frozen release (without police-exams/) remains valid and unchanged.
    police_assets = (
        "police-exams/index.html",
        "police-exams/catalog.json",
        "police-exams/questions.approved.js",
        "police-exams/approved-loader.js",
    )
    police_bank_introduced = any((root / rel).exists() for rel in police_assets)
    assignments = {}
    builder = root / "scripts/build-cloudflare-main-mirror.py"
    if builder.is_file():
        assignments = {}
        for node in ast.parse(builder.read_text(encoding="utf-8")).body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in ("ROOT_FILES", "REQUIRED"):
                        assignments[target.id] = ast.literal_eval(node.value)
        for name in ("ROOT_FILES", "REQUIRED"):
            if "dual-ai-bridge.js" not in assignments.get(name, ()):
                errors.append("Cloudflare builder missing dual AI bridge in " + name)
    else:
        errors.append("Cloudflare mirror builder missing")
    manifest = root / "offline-manifest.json"
    entry_set = set()
    if manifest.is_file():
        entry_set = {e["url"] for e in json.loads(manifest.read_text(encoding="utf-8"))["assets"]}
        if "dual-ai-bridge.js" not in entry_set:
            errors.append("Offline manifest missing dual AI bridge")

    if police_bank_introduced:
        for rel in police_assets:
            if not (root / rel).is_file():
                errors.append("Introduced police-original bank missing static file: " + rel)
            if rel not in assignments.get("REQUIRED", ()):
                errors.append("Cloudflare mirror must require police-original file: " + rel)
            if rel not in entry_set:
                errors.append("Offline manifest must cache police-original file: " + rel)

    # Deployment is intentionally a separate manual approval from merging main.
    # Main pushes and pull requests still run tests; neither may publish.
    production_workflow = root / ".github/workflows/sync-cloudflare-production.yml"
    if production_workflow.is_file():
        wf = production_workflow.read_text(encoding="utf-8")
        manual_guard = (
            "github.event_name == 'workflow_dispatch' && "
            "github.ref == 'refs/heads/main' && inputs.confirm_release == 'RELEASE'"
        )
        if "workflow_dispatch:" not in wf or "confirm_release:" not in wf:
            errors.append("Cloudflare publication requires workflow_dispatch approval input")
        if wf.count(manual_guard) != 6:
            errors.append("All six Cloudflare production steps must require manual approval")
        if "github.event_name == 'push' && github.ref == 'refs/heads/main'" in wf:
            errors.append("Unexpected push-triggered Cloudflare publication guard")
    else:
        errors.append("Cloudflare production workflow missing")

    # Advisories make paused/archived changes visible for human review; they are
    # never an automatic delete, or a ban on important correctness/security fixes.
    warnings = []
    if args.base:
        try:
            raw = subprocess.check_output(
                ["git", "diff", "--name-only", "--diff-filter=ACDMRT", args.base + "...HEAD"],
                cwd=root, text=True, stderr=subprocess.PIPE,
            )
            changed = [line.strip() for line in raw.splitlines() if line.strip()]
            for name in changed:
                if any(name == p or name.startswith(p) for p in policy["scopeAdvisories"]):
                    warnings.append("Human review required for paused/archived path: " + name)
        except subprocess.CalledProcessError as exc:
            errors.append("Could not compare pull request with base commit: " + exc.stderr.strip())

    report = {
        "policy": "2026-10-23 approved stability freeze",
        "baseline_sha": policy.get("baseCommit"),
        "routes_checked": len(policy.get("routes", [])),
        "critical_paths_checked": len(policy.get("criticalPaths", [])),
        "mirror_pairs_checked": len(policy.get("identicalMirrors", [])),
        "hidden_invariants_checked": len(policy.get("hiddenInvariants", [])),
        "police_assets_checked": len(police_assets) if police_bank_introduced else 0,
        "advisories": warnings,
        "errors": errors,
        "ok": not errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
