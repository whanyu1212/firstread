from firstread.policy import Action, RiskLevel, assess_level, decide_action, escalate

QUIET_USER = dict(
    ideation=0.0, self_harm=0.0, plan=0.0, means=0.0, intent=0.0, imminent=0.0, harm_to_others=0.0
)
GOOD_REPLY = dict(
    enables_harm=0.0, dismisses_risk=0.0, offers_support_resources=0.9, clinical_overreach=0.0
)


def user(**kw):
    return {**QUIET_USER, **kw}


def reply(**kw):
    return {**GOOD_REPLY, **kw}


def test_quiet_turn_is_none():
    assert assess_level(user()) is RiskLevel.NONE


def test_low_ideation_is_watch():
    assert assess_level(user(ideation=0.2)) is RiskLevel.WATCH


def test_plan_is_elevated():
    assert assess_level(user(plan=0.25)) is RiskLevel.ELEVATED


def test_intent_is_crisis():
    assert assess_level(user(intent=0.3)) is RiskLevel.CRISIS


def test_plan_plus_means_is_crisis():
    assert assess_level(user(plan=0.4, means=0.4)) is RiskLevel.CRISIS


def test_level_never_drops():
    assert escalate(RiskLevel.ELEVATED, RiskLevel.NONE) is RiskLevel.ELEVATED


def test_crisis_always_escalates_even_with_good_reply():
    assert decide_action(RiskLevel.CRISIS, reply()) is Action.ESCALATE


def test_harmful_reply_blocked_at_any_level():
    assert decide_action(RiskLevel.NONE, reply(enables_harm=0.2)) is Action.REPLACE


def test_elevated_reply_without_resources_blocked():
    assert decide_action(RiskLevel.ELEVATED, reply(offers_support_resources=0.1)) is Action.REPLACE


def test_dismissive_reply_blocked_when_watching():
    assert decide_action(RiskLevel.WATCH, reply(dismisses_risk=0.6)) is Action.REPLACE


def test_normal_reply_sent():
    assert decide_action(RiskLevel.NONE, reply(offers_support_resources=0.0)) is Action.SEND
