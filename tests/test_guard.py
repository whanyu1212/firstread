"""Guard wiring tests with a fake Jev client (no API key needed)."""

from types import SimpleNamespace

from firstread import Action, Conversation, FirstRead, RiskLevel
from firstread import templates


class FakeClient:
    """Answers every Noul with a fixed probability, overridable per key."""

    def __init__(self):
        self.overrides: dict[str, float] = {}
        self.states: list[str] = []

    def system_one(self, state, questions):
        self.states.append(state)
        answers = {k: SimpleNamespace(noul=self.overrides.get(k, 0.0)) for k in questions}
        return SimpleNamespace(answers=answers)


def make():
    client = FakeClient()
    return client, FirstRead(client=client)


def test_safe_turn_sends_draft():
    client, guard = make()
    client.overrides["offers_support_resources"] = 0.0
    audit = guard.audit(Conversation(), "hi", "hello!")
    assert audit.action is Action.SEND
    assert audit.reply == "hello!"


def test_crisis_turn_sends_crisis_reply():
    client, guard = make()
    client.overrides["intent"] = 0.9
    audit = guard.audit(Conversation(), "...", "draft")
    assert audit.action is Action.ESCALATE
    assert audit.reply == templates.CRISIS_REPLY


def test_risk_is_sticky_across_turns():
    client, guard = make()
    conv = Conversation()
    client.overrides["plan"] = 0.5
    guard.audit(conv, "first", "draft")
    client.overrides.clear()
    audit = guard.audit(conv, "feeling better", "draft")
    assert audit.level is RiskLevel.ELEVATED
    # elevated + draft with no support resources -> replaced
    assert audit.action is Action.REPLACE


def test_jev_sees_prior_turns_and_draft():
    client, guard = make()
    conv = Conversation()
    guard.audit(conv, "earlier message", "earlier reply")
    guard.audit(conv, "latest message", "the draft")
    reply_state = client.states[-1]
    assert "earlier message" in reply_state
    assert "latest message" in reply_state
    assert "the draft" in reply_state


def test_gateway_key_routes_through_vercel(monkeypatch):
    from firstread.guard import GATEWAY_BASE_URL, _client_config

    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gw-key")
    cfg = _client_config(None)
    assert cfg == {"api_key": "gw-key", "base_url": GATEWAY_BASE_URL, "model": "typesafe-ai/jev"}


def test_direct_key_takes_priority(monkeypatch):
    from firstread.guard import _client_config

    monkeypatch.setenv("TYPESAFE_API_KEY", "ts-key")
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gw-key")
    assert _client_config(None) == {}
