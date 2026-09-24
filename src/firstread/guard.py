"""The FirstRead guard: two Jev calls per turn.

    user message --> check_user() --> risk level (sticky per conversation)
                                           |
    companion LLM --> draft reply --> check_reply() --> SEND | REPLACE | ESCALATE

check_user() does not depend on the draft, so you can run it at the same time
as your companion LLM drafts the reply and only wait on check_reply().
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field

from firstread import policy, questions, templates
from firstread.policy import Action, RiskLevel


GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/typesafe"
GATEWAY_MODEL = "typesafe-ai/jev"


def _client_config(model: str | None) -> dict:
    """A direct TypeSafe key wins; otherwise route through Vercel AI Gateway."""
    if os.getenv("TYPESAFE_API_KEY"):
        return {"model": model} if model else {}
    gateway_key = os.getenv("AI_GATEWAY_API_KEY")
    if gateway_key:
        return {
            "api_key": gateway_key,
            "base_url": GATEWAY_BASE_URL,
            "model": model or GATEWAY_MODEL,
        }
    raise RuntimeError("Set AI_GATEWAY_API_KEY (Vercel) or TYPESAFE_API_KEY in .env")


@dataclass
class Conversation:
    turns: list[tuple[str, str]] = field(default_factory=list)  # (role, text)
    level: RiskLevel = RiskLevel.NONE

    def add(self, role: str, text: str) -> None:
        self.turns.append((role, text))


@dataclass
class TurnAudit:
    level: RiskLevel
    action: Action
    user_signals: dict[str, float]
    reply_signals: dict[str, float]
    draft: str
    reply: str  # what actually goes to the user

    def to_dict(self) -> dict:
        d = asdict(self)
        d["level"] = self.level.name
        d["action"] = self.action.value
        return d


class FirstRead:
    def __init__(self, client=None, model: str | None = None, window: int = 8):
        """
        client: a TypeSafeClient, or any object with the same system_one()
                method (tests pass a fake).
        window: how many recent turns Jev sees, so risk that builds across
                turns is not judged one message at a time.
        """
        if client is None:
            from typesafe_sdk import TypeSafeClient

            client = TypeSafeClient(**_client_config(model or os.getenv("FIRSTREAD_MODEL")))
        self.client = client
        self.window = window

    def check_user(self, conv: Conversation, user_msg: str) -> tuple[RiskLevel, dict[str, float]]:
        state = self._transcript(conv) + f"\n\nLATEST USER MESSAGE:\n{user_msg}"
        signals = self._ask(state, questions.user_turn_questions())
        turn_level = policy.assess_level(signals)
        conv.level = policy.escalate(conv.level, turn_level)
        return conv.level, signals

    def check_reply(
        self, conv: Conversation, user_msg: str, draft: str
    ) -> tuple[Action, dict[str, float]]:
        state = (
            self._transcript(conv)
            + f"\n\nLATEST USER MESSAGE:\n{user_msg}"
            + f"\n\nDRAFT ASSISTANT REPLY:\n{draft}"
        )
        signals = self._ask(state, questions.reply_questions())
        return policy.decide_action(conv.level, signals), signals

    def audit(self, conv: Conversation, user_msg: str, draft: str) -> TurnAudit:
        """Run both checks, pick the reply to send, and record the turn."""
        level, user_signals = self.check_user(conv, user_msg)
        action, reply_signals = self.check_reply(conv, user_msg, draft)

        reply = {
            Action.SEND: draft,
            Action.REPLACE: templates.SAFE_REPLY,
            Action.ESCALATE: templates.CRISIS_REPLY,
        }[action]

        conv.add("user", user_msg)
        conv.add("assistant", reply)
        return TurnAudit(level, action, user_signals, reply_signals, draft, reply)

    def _ask(self, state: str, qs: dict) -> dict[str, float]:
        response = self.client.system_one(state=state, questions=qs)
        return {key: response.answers[key].noul for key in qs}

    def _transcript(self, conv: Conversation) -> str:
        recent = conv.turns[-self.window :]
        if not recent:
            return "CONVERSATION SO FAR: (none)"
        lines = [f"{role.upper()}: {text}" for role, text in recent]
        return "CONVERSATION SO FAR:\n" + "\n".join(lines)
