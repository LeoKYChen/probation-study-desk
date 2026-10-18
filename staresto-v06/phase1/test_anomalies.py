#!/usr/bin/env python3
"""Regression checks for structural-anomaly triage, never an answer-quality approval."""
from collections import Counter
from audit import OUTPUT, obj

ANSWER_FLAG = "答案不在選項"
OPTION_FLAG = "選項不足或數量異常"


def main():
    summary = obj(OUTPUT / "summary.json")
    candidates = obj(OUTPUT / "candidates.json")
    audit = obj(OUTPUT / "ANOMALY_REVIEW.json")
    rows = audit["records"]
    flagged = {
        r["id"] for r in candidates
        if ANSWER_FLAG in r["blocks"] or OPTION_FLAG in r["blocks"]
    }
    assert audit["schema"] == "staresto-v06-phase1-anomaly-review-v1"
    assert summary["allowedForProduction"] == audit["releaseApproved"] == 0
    assert audit["sourceCandidateRows"] == len(candidates) == 4733
    assert len(rows) == audit["flaggedUniqueRecords"] == len(flagged)
    assert {r["id"] for r in rows} == flagged
    assert all(r["manualReviewRequired"] and r["published"] is False for r in rows)
    assert all(r["answerFlag"] or r["optionsFlag"] for r in rows)
    assert sum(audit["byDiagnosis"].values()) == len(rows)
    assert sum(audit["byCategory"].values()) == len(rows)
    choice = audit["choiceAnswerDiagnostics"]
    assert len(choice) == audit["byDiagnosis"].get("選擇題格式需人工查核", 0)
    assert sum(audit["choiceAnswerDiagnosticCounts"].values()) == len(choice)
    assert len({q["id"] for q in choice}) == len(choice)
    assert all(q["manualReviewRequired"] and q["published"] is False for q in choice)
    assert all(q["sourcePath"] == "passage-completion/zhikao/items.json" for q in choice)
    assert all(q["detectedTwelveOptionTruncation"] is True for q in choice)
    assert all(q["missingOptionKeys"] == ["K", "L"] for q in choice)
    assert all(q["rawAnswer"] == q["normalizedAnswer"] and q["rawAnswer"] in ("K", "L") for q in choice)
    assert all(q["rawOptionKeys"] == list("ABCDEFGHIJKL") for q in choice)
    assert all(q["normalizedOptionKeys"] == list("ABCDEFGHIJ") for q in choice)
    assert all(q["retainedOptionContentMatchesOriginal"] for q in choice)
    assert sum(audit["bySourcePath"].values()) == len(rows)
    assert sum(audit["overlap"].values()) == len(rows)
    assert audit["flagCounts"][ANSWER_FLAG] == summary["blockingReasons"][ANSWER_FLAG]
    assert audit["flagCounts"][OPTION_FLAG] == summary["blockingReasons"][OPTION_FLAG]
    assert sum(r["answerFlag"] for r in rows) == audit["flagCounts"][ANSWER_FLAG]
    assert sum(r["optionsFlag"] for r in rows) == audit["flagCounts"][OPTION_FLAG]
    actual = Counter("both" if r["answerFlag"] and r["optionsFlag"]
                     else "answer" if r["answerFlag"] else "options" for r in rows)
    assert actual["both"] == audit["overlap"].get("同時出現", 0)
    assert actual["answer"] == audit["overlap"].get("只有答案警示", 0)
    assert actual["options"] == audit["overlap"].get("只有選項警示", 0)
    assert all(r["diagnosis"] == "非標準類別或混合題格式警示" for r in rows
               if r["category"] in ("英文作文", "中譯英", "混合題"))
    print("PASS anomaly triage: records preserved, overlapping flags accounted for, zero auto-release")


if __name__ == "__main__":
    main()
