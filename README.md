# FirstRead

A safety layer for mental health companion agents. FirstRead reads every turn
before anything reaches the user: it checks the user's message for signs of
self-harm risk, then checks the companion's draft reply before it is sent.
Both checks use [Jev](https://docs.typesafe.ai/introduction/quickstart), which
returns calibrated probabilities fast enough to run on every turn.

```
user message ──► check_user ──► risk level (only goes up within a conversation)
                                     │
companion LLM ──► draft ──► check_reply ──► SEND | REPLACE | ESCALATE
```

- **SEND**: the draft is fine and goes out unchanged.
- **REPLACE**: the draft is swapped for a safe reply that points to support.
- **ESCALATE**: crisis reply goes out and a human reviewer is alerted.

## Scope

FirstRead flags risk and routes conversations to people. It does not diagnose,
and it is not a replacement for human crisis support. The question set is
loosely structured like the Columbia Protocol (ideation → plan → intent) but is
not a validated clinical instrument.

## Quickstart

```bash
cp .env.example .env        # add your AI_GATEWAY_API_KEY (Vercel) or TYPESAFE_API_KEY
uv sync
uv run pytest               # policy + wiring tests, no API key needed
uv run python evals/run_eval.py
uv run python examples/chat_demo.py
```

## Layout

| Path | What it is |
| --- | --- |
| `src/firstread/questions.py` | Jev questions for the user check and the reply check |
| `src/firstread/policy.py` | Thresholds: probabilities → risk level → action. Tune these. |
| `src/firstread/guard.py` | `FirstRead` class: calls Jev, keeps the risk level sticky |
| `src/firstread/templates.py` | Fallback replies and crisis resources (localise these) |
| `evals/cases.jsonl` | Synthetic test conversations with expected risk levels |
| `evals/run_eval.py` | High-risk recall and false-alarm rate |
| `examples/chat_demo.py` | Terminal chat; plug your companion LLM into `draft_reply()` |

## Next steps

- [ ] Get an API key and run the eval to get baseline numbers
- [ ] Grow `evals/cases.jsonl` (sarcasm, lyrics, slow build-ups, non-English)
- [ ] Tune thresholds in `policy.py` for high-risk recall first, false alarms second
- [ ] Plug a real companion LLM into the demo
- [ ] Run `check_user` in parallel with drafting to hide latency
- [ ] Reviewer view for escalated conversations
