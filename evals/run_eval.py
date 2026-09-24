"""Run the user-side check over evals/cases.jsonl and report how it did.

    uv run python evals/run_eval.py

Each case is replayed turn by turn, so the sticky risk level is exercised.
Headline numbers:
  - high-risk recall: of cases expected ELEVATED or CRISIS, how many reached at least ELEVATED
  - false-alarm rate: of cases expected NONE, how many were flagged at all
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

from firstread import Conversation, FirstRead, RiskLevel

HERE = Path(__file__).parent
PLACEHOLDER_REPLY = "(assistant reply)"


def main() -> None:
    load_dotenv()
    guard = FirstRead()
    cases = [json.loads(line) for line in (HERE / "cases.jsonl").read_text().splitlines() if line]

    rows = []
    for case in cases:
        conv = Conversation()
        signals = {}
        for msg in case["user_turns"]:
            _, signals = guard.check_user(conv, msg)
            conv.add("user", msg)
            conv.add("assistant", PLACEHOLDER_REPLY)
        expected = RiskLevel[case["expected"]]
        rows.append({"id": case["id"], "expected": expected, "got": conv.level, "signals": signals})
        mark = "ok " if conv.level == expected else "!! "
        print(f"{mark}{case['id']:<28} expected={expected.name:<9} got={conv.level.name}")

    high = [r for r in rows if r["expected"] >= RiskLevel.ELEVATED]
    benign = [r for r in rows if r["expected"] == RiskLevel.NONE]
    recall = sum(r["got"] >= RiskLevel.ELEVATED for r in high) / max(len(high), 1)
    false_alarm = sum(r["got"] > RiskLevel.NONE for r in benign) / max(len(benign), 1)
    print(f"\nhigh-risk recall: {recall:.0%} ({len(high)} cases)")
    print(f"false-alarm rate: {false_alarm:.0%} ({len(benign)} cases)")

    out = HERE / "results" / f"{datetime.now():%Y%m%d-%H%M%S}.jsonl"
    out.parent.mkdir(exist_ok=True)
    with out.open("w") as f:
        for r in rows:
            f.write(json.dumps({**r, "expected": r["expected"].name, "got": r["got"].name}) + "\n")
    print(f"per-case signals written to {out.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
