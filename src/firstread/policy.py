"""Turns Jev probabilities into a risk level and an action for the draft reply.

Pure functions, no API calls, so they are easy to unit test and tune.

All thresholds are placeholders: tune them on evals/ before trusting them.
They are deliberately low, because missing a real crisis costs far more than
a false alarm.
"""

from __future__ import annotations

from enum import Enum, IntEnum


class RiskLevel(IntEnum):
    NONE = 0
    WATCH = 1  # possible passive ideation or distress: keep an eye on it
    ELEVATED = 2  # active ideation, self-harm, or a plan: reply must point to support
    CRISIS = 3  # intent or imminence: hand off to a human now


class Action(str, Enum):
    SEND = "send"  # draft reply goes out unchanged
    REPLACE = "replace"  # swap the draft for a safe template reply
    ESCALATE = "escalate"  # send the crisis reply and alert a human reviewer


def assess_level(p: dict[str, float]) -> RiskLevel:
    """Risk level for a single user turn, from Noul probabilities."""
    if (
        p["intent"] >= 0.20
        or p["imminent"] >= 0.20
        or (p["plan"] >= 0.30 and p["means"] >= 0.30)
    ):
        return RiskLevel.CRISIS
    if (
        p["plan"] >= 0.20
        or p["self_harm"] >= 0.30
        or p["ideation"] >= 0.40
        or p["harm_to_others"] >= 0.40
    ):
        return RiskLevel.ELEVATED
    if p["ideation"] >= 0.15 or p["self_harm"] >= 0.15 or p["harm_to_others"] >= 0.20:
        return RiskLevel.WATCH
    return RiskLevel.NONE


def escalate(previous: RiskLevel, current: RiskLevel) -> RiskLevel:
    """Risk only goes up within a conversation.

    One calm message after a disclosure should not reset the conversation to
    safe. Lowering the level is a decision for a human reviewer.
    """
    return max(previous, current)


def decide_action(level: RiskLevel, r: dict[str, float]) -> Action:
    """What to do with the draft reply, given the conversation's risk level."""
    if level >= RiskLevel.CRISIS:
        return Action.ESCALATE
    if r["enables_harm"] >= 0.10:
        return Action.REPLACE
    if level >= RiskLevel.WATCH and r["dismisses_risk"] >= 0.30:
        return Action.REPLACE
    if level >= RiskLevel.ELEVATED and r["offers_support_resources"] < 0.50:
        return Action.REPLACE
    if r["clinical_overreach"] >= 0.50:
        return Action.REPLACE
    return Action.SEND
