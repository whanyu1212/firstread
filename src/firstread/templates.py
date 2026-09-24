"""Fallback replies used when a draft is blocked.

Resource lines are US-centric (988). Localise them for your demo audience.
"""

RESOURCES = (
    "If you're in the US, you can call or text 988 to reach the Suicide & Crisis Lifeline, "
    "any time. Outside the US, findahelpline.com lists free, confidential lines near you. "
    "If you're in immediate danger, please contact your local emergency number."
)

SAFE_REPLY = (
    "I'm really glad you told me this, and I want to make sure you get the right support. "
    "It sounds like you're carrying a lot right now. "
    "Talking to someone trained to help can make a real difference. " + RESOURCES
)

CRISIS_REPLY = (
    "Thank you for trusting me with this. Your safety matters most right now. "
    "I'm bringing in a person from our team, and I'd also really encourage you to reach "
    "out to someone right now. " + RESOURCES
)
