# FirstRead

A safety layer for mental health companion agents. FirstRead reads every turn
before anything reaches the user: it checks the user's message for signs of
self-harm risk, then checks the companion's draft reply before it is sent.
Both checks use [Jev](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe)
through Vercel AI Gateway, which returns calibrated probabilities fast enough to
run on every turn. The two checks run in parallel.

```
user message ──► user check ──► risk level (only goes up within a conversation)
                                     │
companion LLM ──► draft ──► reply check ──► send | replace | escalate
```

- **send**: the draft is fine and goes out unchanged.
- **replace**: the draft is swapped for a safe reply that points to support.
- **escalate**: crisis reply goes out immediately and a human reviewer is alerted.

## Scope

FirstRead flags risk and routes conversations to people. It does not diagnose,
and it is not a replacement for human crisis support. The question set is
loosely structured like the Columbia Protocol (ideation → plan → intent) but is
not a validated clinical instrument.

## Quickstart

Requires Node 22+ and pnpm.

```bash
cp .env.example .env        # add your AI_GATEWAY_API_KEY (or TYPESAFE_API_KEY)
pnpm install
pnpm test                   # policy + wiring tests, no API key needed
pnpm eval                   # run the test conversations against Jev
pnpm fetch:bhh              # download the Between Help and Harm benchmark (CC-BY-NC-4.0)
pnpm eval:bhh               # score it: recall, false alarms, latency
pnpm demo                   # terminal chat
```

## Layout

pnpm workspace. The library is framework-free so any companion app can use it;
the Next.js demo app will live in `apps/`.

| Path | What it is |
| --- | --- |
| `packages/firstread/src/questions.ts` | Jev questions for the user check and the reply check |
| `packages/firstread/src/policy.ts` | Thresholds: probabilities → risk level → action. Tune these. |
| `packages/firstread/src/guard.ts` | `FirstRead` class: calls Jev, keeps the risk level sticky |
| `packages/firstread/src/jev.ts` | Jev adapter on TypeSafe's SDK (`@typesafe-ai/sdk`), routed through AI Gateway |
| `packages/firstread/src/templates.ts` | Fallback replies and crisis resources (localise these) |
| `packages/firstread/evals/` | Synthetic test conversations and the eval script |
| `packages/firstread/examples/chat-demo.ts` | Terminal chat; plug your companion LLM into `draftReply()` |

## Next steps

- [ ] Run the eval to get baseline numbers
- [ ] Grow `evals/cases.jsonl` (sarcasm, lyrics, slow build-ups, non-English)
- [ ] Tune thresholds in `policy.ts` for high-risk recall first, false alarms second
- [ ] Next.js demo app in `apps/web` with AI SDK 7 `useChat` and a live FirstRead panel
- [ ] Reviewer view for escalated conversations
