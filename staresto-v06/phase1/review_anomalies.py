#!/usr/bin/env python3
"""Classify *structural flags* for manual review; never auto-correct or publish questions."""
from collections import Counter
from pathlib import Path
import json

from audit import ROOT, CAT, UPSTREAM, OUTPUT, item_collection, obj, source_identity, write

ANSWER_FLAG = "答案不在選項"
OPTION_FLAG = "選項不足或數量異常"
SPECIAL = {"英文作文", "中譯英", "混合題"}
NON_CHOICE_ANSWER_TYPES = {
    "fill", "short", "longAnswer", "tableFill", "multi", "sentenceNumber",
}
REVIEW_STATES = ("疑似非選擇題格式警示", "選擇題格式需人工查核", "題型不明需人工查核")


def classify(row, raw):
    answer_type = str(raw.get("answerType") or "").strip()
    if row["category"] in SPECIAL or answer_type in NON_CHOICE_ANSWER_TYPES:
        return REVIEW_STATES[0]
    if row["category"] in {"詞彙與字卡", "文法與克漏字", "閱讀理解", "文意選填", "篇章結構"}:
        return REVIEW_STATES[1]
    return REVIEW_STATES[2]


def option_count(value):
    return len(value) if isinstance(value, (dict, list)) else 0


def main():
    summary = obj(OUTPUT / "summary.json")
    candidates = obj(OUTPUT / "candidates.json")
    index = obj(CAT / "index.json")
    by_id = {r["id"]: r for r in index["records"]}
    if len(by_id) != len(index["records"]):
        raise AssertionError("Index contains duplicate IDs")
    flagged = [
        r for r in candidates
        if ANSWER_FLAG in r["blocks"] or OPTION_FLAG in r["blocks"]
    ]
    shard_cache = {}
    upstream_cache = {}
    by_category = Counter()
    by_class = Counter()
    by_source = Counter()
    answer_type_counts = Counter()
    flag_counts = Counter()
    overlap = Counter()
    records = []
    for r in flagged:
        ix = by_id[r["id"]]
        shard = ix["shard"]
        src = ix["sourcePath"]
        if shard not in shard_cache:
            shard_cache[shard] = obj(CAT / "shards" / shard)["records"]
        normalized = shard_cache[shard][ix["position"]]
        if normalized["id"] != r["id"]:
            raise AssertionError("Normalized shard ID differs: " + r["id"])
        if src not in upstream_cache:
            upstream_cache[src] = item_collection(obj(UPSTREAM / "data" / src))
        raw = upstream_cache[src][ix["position"]]
        check, raw_id = source_identity(ix, raw)
        if check != "MATCH":
            raise AssertionError("Unverified source identity: " + r["id"])
        has_answer_flag = ANSWER_FLAG in r["blocks"]
        has_option_flag = OPTION_FLAG in r["blocks"]
        classification = classify(r, raw)
        answer_type = str(raw.get("answerType") or "未標記")
        by_class[classification] += 1
        by_category[r["category"]] += 1
        by_source[src] += 1
        answer_type_counts[answer_type] += 1
        if has_answer_flag:
            flag_counts[ANSWER_FLAG] += 1
        if has_option_flag:
            flag_counts[OPTION_FLAG] += 1
        overlap["同時出現" if has_answer_flag and has_option_flag else
                "只有答案警示" if has_answer_flag else "只有選項警示"] += 1
        records.append({
            "id": r["id"],
            "sourceItemId": r["sourceItemId"],
            "sourcePath": src,
            "category": r["category"],
            "examDesignation": r["examDesignation"],
            "answerType": answer_type,
            "rawAnswerPresent": raw.get("answer") is not None
               or raw.get("answerKey") is not None or raw.get("answers") is not None
               or raw.get("a") is not None,
            "rawOptionCount": option_count(raw.get("options") if "options" in raw else raw.get("o")),
            "normalizedOptionCount": option_count(normalized.get("options")),
            "normalizedAnswerPresent": normalized.get("answer") is not None,
            "answerFlag": has_answer_flag,
            "optionsFlag": has_option_flag,
            "diagnosis": classification,
            "manualReviewRequired": True,
            "published": False,
        })
    if flag_counts[ANSWER_FLAG] != summary["blockingReasons"][ANSWER_FLAG]:
        raise AssertionError("Answer-flag count inconsistent with phase1 audit")
    if flag_counts[OPTION_FLAG] != summary["blockingReasons"][OPTION_FLAG]:
        raise AssertionError("Option-flag count inconsistent with phase1 audit")
    if len(records) != sum(overlap.values()):
        raise AssertionError("Overlap accounting discrepancy")
    payload = {
        "schema": "staresto-v06-phase1-anomaly-review-v1",
        "sourceSnapshot": summary["upstreamSnapshot"],
        "reviewedBy": "automated structural classification ONLY",
        "sourceCandidateRows": len(candidates),
        "flaggedUniqueRecords": len(records),
        "flagCounts": dict(flag_counts),
        "overlap": dict(overlap),
        "byDiagnosis": dict(by_class),
        "byCategory": dict(by_category),
        "bySourcePath": dict(by_source),
        "byRawAnswerType": dict(answer_type_counts),
        "examplesByDiagnosis": {
            state: [x["id"] for x in records if x["diagnosis"] == state][:15]
            for state in REVIEW_STATES
        },
        "releaseApproved": 0,
        "note": "These are automatic structural warnings; none are proven incorrect or cleared for reuse.",
        "records": records,
    }
    write(OUTPUT / "ANOMALY_REVIEW.json", payload)
    lines = [
        "# Staresto v0.6｜答案／選項結構警示分流報告", "",
        "> 僅重新分類既有自動化警示，不校改原題、不核准權利、不將題目放入正式題庫。", "",
        "## 警示數量（分類可能重疊）", "",
        "| 項目 | 筆數 |", "|---|---:|",
        "| 答案不在選項 | " + str(flag_counts[ANSWER_FLAG]) + " |",
        "| 選項不足或數量異常 | " + str(flag_counts[OPTION_FLAG]) + " |",
        "| 受任一警示影響的不同紀錄 | " + str(len(records)) + " |",
        "| 同時出現兩種警示 | " + str(overlap["同時出現"]) + " |",
        "| 只有答案警示 | " + str(overlap["只有答案警示"]) + " |",
        "| 只有選項警示 | " + str(overlap["只有選項警示"]) + " |",
        "", "## 待人工複核的題型分流", "",
        "| 分流 | 筆數 |", "|---|---:|",
    ]
    for key in REVIEW_STATES:
        lines.append("| " + key + " | " + str(by_class[key]) + " |")
    lines += ["", "## 題目類別分布", "", "| 類別 | 筆數 |", "|---|---:|"]
    for key, count in by_category.most_common():
        lines.append("| " + key + " | " + str(count) + " |")
    lines += [
        "", "## 判讀原則", "",
        "- 「疑似非選擇題格式警示」表示原始資料標示混合題、作文、中譯英或非單選作答型態；**不是證明警示必然誤判**。",
        "- 「選擇題格式需人工查核」表示原題類別通常具有選項，應優先查閱原始卷面、選項字母及答案來源；**不能直接認定答案錯誤**。",
        "- 每筆詳列來源路徑、原題 ID、原始與標準化選項數、作答型態、警示組合及人工審查需求；完整清單見 ANOMALY_REVIEW.json。",
        "- 不因分流結果修改原有 668 題、localStorage 或正式發布資格；正式發布數維持 0。",
        "- 後續人工審核需核對原卷題型、原作者原檔、評分型態、篇章及權利，逐筆標明已確證的原因。",
    ]
    (OUTPUT / "ANOMALY_REVIEW.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("ANOMALY_REVIEW_SUMMARY", json.dumps({
        "unique": len(records), "flagCounts": dict(flag_counts),
        "overlap": dict(overlap), "byDiagnosis": dict(by_class),
        "byCategory": dict(by_category),
        "releaseApproved": 0,
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
