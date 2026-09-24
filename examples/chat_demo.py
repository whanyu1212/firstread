"""Terminal chat with a stub companion, audited by FirstRead on every turn.

    uv run python examples/chat_demo.py

Swap draft_reply() for your real companion LLM. Every audit is appended to
logs/audit.jsonl, which doubles as labeled data for tuning thresholds later.
"""

from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv

from firstread import Action, Conversation, FirstRead

LOG = Path(__file__).parent.parent / "logs" / "audit.jsonl"


def draft_reply(conv: Conversation, user_msg: str) -> str:
    # TODO: call your companion LLM here with conv.turns + user_msg.
    return "That sounds like a lot. Want to tell me more about what's been going on?"


def main() -> None:
    load_dotenv()
    guard = FirstRead()
    conv = Conversation()
    LOG.parent.mkdir(exist_ok=True)
    print("FirstRead demo. Ctrl+C to quit.\n")

    while True:
        try:
            user_msg = input("you> ").strip()
        except (KeyboardInterrupt, EOFError):
            break
        if not user_msg:
            continue

        draft = draft_reply(conv, user_msg)
        audit = guard.audit(conv, user_msg, draft)

        top = sorted(audit.user_signals.items(), key=lambda kv: -kv[1])[:3]
        print(f"  [level={audit.level.name} action={audit.action.value} "
              + " ".join(f"{k}={v:.2f}" for k, v in top) + "]")
        if audit.action is Action.ESCALATE:
            print("  [!! human reviewer alerted]")  # TODO: wire to Slack / pager / dashboard
        print(f"bot> {audit.reply}\n")

        with LOG.open("a") as f:
            f.write(json.dumps(audit.to_dict()) + "\n")


if __name__ == "__main__":
    main()
