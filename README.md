# FirstRead

A safety layer for mental health companion agents. FirstRead reads every turn
before anything reaches the user: it checks the user's message for signs of
self-harm risk, then checks the companion's draft reply before it is sent.
Both checks use [Jev](https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe)
through Vercel AI Gateway, which returns yes/no probabilities fast enough to run
on every turn. On the BHH test split, real risk rises at every step of Jev's
probability, so a cutoff means the same on every message; in the middle range the
numbers run low, so FirstRead's cutoffs are set from measured recall rather than
read as odds. The user check runs while the companion writes its draft, so it
adds almost no wait.

```
user message ──► user check ──► risk level (rises at once, comes down slowly)
                                     │
companion LLM ──► draft ──► reply check ──► send | replace | escalate
```

- **send**: the draft is fine and goes out unchanged.
- **replace**: the draft is swapped for a safe reply that points to support.
- **escalate**: crisis reply goes out immediately and a human reviewer is alerted.

The risk level belongs to the conversation, not to one message (`risk.ts`). It rises as soon as
a message warrants it, and one calm message never lowers it. ELEVATED settles to WATCH after
several calm turns in a row (`settleAfter`), never to NONE. Only a person clears CRISIS
(`clearCrisis()`), and only down to ELEVATED.

The user check starts as soon as the message arrives (`guard.startTurn()`), so it runs
while the companion writes its draft; `finish(draft)` adds the reply check. Both must answer
within 3s of the draft being ready. If Jev is slow, rate-limited or down, FirstRead **fails
closed**: the draft is not sent, and the user gets a reply matched to the risk level already
known (a gentle holding reply, the support reply, or the crisis reply). Those turns are marked
in `audit.failures`; re-check them later with `guard.recheck()`.

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
pnpm eval:bhh --client luna # same questions on an LLM baseline (needs OPENAI_API_KEY)
pnpm compare:bhh            # Jev vs the baselines: AUC, recall at matched false alarms, calibration
pnpm demo                   # terminal chat
pnpm dev                    # web app: the deck at /deck, the demo at /demo (needs OPENAI_API_KEY)
```

## Layout

pnpm workspace. The library is framework-free so any companion app can use it;
the Next.js app in `apps/web` holds the presentation deck and the live demo.

| Path | What it is |
| --- | --- |
| `packages/firstread/src/questions.ts` | Jev questions for the user check and the reply check |
| `packages/firstread/src/policy.ts` | Thresholds: probabilities → risk level → action. Tune these. |
| `packages/firstread/src/guard.ts` | `FirstRead` class: calls Jev, keeps the risk level sticky |
| `packages/firstread/src/jev.ts` | Jev adapter on TypeSafe's SDK (`@typesafe-ai/sdk`), routed through AI Gateway |
| `packages/firstread/src/templates.ts` | Fallback replies; `repliesFor("SG")` localises them from `resources.ts` |
| `packages/firstread/evals/` | Synthetic test conversations and the eval script |
| `packages/firstread/evals/llm-client.ts` | Eval-only LLM baselines (gpt-6-luna, gpt-6-sol) behind the same interface as Jev |
| `packages/firstread/examples/chat-demo.ts` | Terminal chat; plug your companion LLM into `draftReply()` |
| `apps/web` | Next.js app: `/deck` (slides in `slides/*.mdx`) and `/demo`, where FirstRead guards a companion agent. One turn (`lib/turn.ts`): the user check runs alongside one companion call (`lib/companion.ts`, with skills in `lib/skills/`), CRISIS short-circuits, and the reply check runs before anything is sent. `pnpm --filter web eval:pipeline` replays the multi-turn conversations through it |
| `packages/firstread/src/resources.ts` | Verified crisis lines by country (Singapore first), used by the fallback replies and the agent |

## Next steps

- [ ] Run the eval to get baseline numbers
- [ ] Grow `evals/cases.jsonl` (sarcasm, lyrics, slow build-ups, non-English)
- [ ] Tune thresholds in `policy.ts` for high-risk recall first, false alarms second
- [x] Next.js app in `apps/web` with AI SDK 7 `useChat`: deck and demo routes
- [ ] Live FirstRead panel on the demo (HY-19)
- [ ] Reviewer view for escalated conversations
