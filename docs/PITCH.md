# FirstRead: three-minute pitch

This script follows the six-slide main deck at `/deck/1` through `/deck/6`. The appendix at `/deck/7` through `/deck/11` is for questions, not part of the timed talk.

## Timed script

### 0:00–0:22 — Slide 1: empathy is not enough

“A companion can sound caring and still miss a safety obligation. In this recorded example, it acknowledges pain and asks a thoughtful follow-up. But FirstRead assesses elevated risk, so our policy also requires support resources. FirstRead checks every turn before anyone sees the answer.”

### 0:22–0:55 — Slide 2: the reply that actually went out

“This is a genuine recorded turn. The user said, ‘everything feels pointless lately.’ Jev read elevated risk while the companion drafted, then checked that draft. Its support-resource score was 0.08, below the required 0.50, so FirstRead chose `replace`. The draft stayed hidden; a support reply went out. The user check took 1.55 seconds alongside the 3.92-second draft; the reply check added 0.44.”

### 0:55–1:20 — Slide 3: why Jev

“That is why Jev fits. We ask fourteen structured yes-or-no questions about the user message and four about the draft. Its probabilities become explicit, testable policy. The user check starts beside draft generation and is usually finished first; only the reply check sits after the draft.”

### 1:20–1:47 — Slide 4: memory and failure behavior

“Safety has to survive one turn. FirstRead carries forward the conversation’s risk and earlier signals. One calm message cannot erase a crisis; only a person can clear it. If Jev is slow, unavailable, or rate-limited, FirstRead fails closed: it withholds the unchecked draft, sends a cautious reply matched to known risk, records the failure, and can recheck later.”

### 1:47–2:20 — Slide 5: evidence, with limits

“On the Between Help and Harm test split, Jev reached 0.992 AUC on the 1,750-message scored subset. Latency across all 2,044 messages was 0.50 seconds median and 0.67 at p90. The recorded estimate is four cents per thousand Jev user checks, not the whole app. Test labels are model-generated, the reply check lacks its own labelled evaluation, and this is not clinically validated.”

### 2:20–3:00 — Slide 6: working proof of concept and next steps

“The proof of concept works end to end: draft, checks, decision, safe reply, audit, and a recorded escalation event.”

> **Recorded demo cue — 20 seconds.** Open `/demo`, choose the recommended **See FirstRead intervene** scenario, and play or skip through the recorded run. Say: “This recording used the real pipeline, Jev checks, and timings.” Point out the draft replacement on turn one, then the CRISIS short-circuit and recorded handoff event on turn two. Do not call it a live run.

“The demo records that event, but nobody is on call and no human is alerted. Next we connect a staffed escalation destination, build a labelled reply-safety evaluation, and test the workflow with human reviewers. FirstRead is the safety layer; people remain the escalation path.”

## Appendix routes

| Route | Use when asked about | Evidence shown |
| --- | --- | --- |
| `/deck/7` | Why Jev instead of a general model? | ROC, latency, and cost comparison from the BHH runs |
| `/deck/8` | How do probabilities become an action? | Jev answers mapped through policy to a risk level |
| `/deck/9` | Where does the check sit in the product? | The harness: user check beside drafting, reply check before delivery, fail-closed deadline |
| `/deck/10` | How was the policy improved? | Miss-driven iterations: 88.1% → 95.4% → 96.0% recall, with false alarms also shown |
| `/deck/11` | What remains unproven? | Honest limits: over-escalation, no labelled reply-check eval, no fallback classifier, no staffed demo escalation |

## Rehearsal notes

- Target about 140 spoken words per minute. The script has roughly 350 spoken words; the 20-second recording and short slide transitions bring the total to three minutes.
- Load `/demo` before presenting. Keep the recorded recommended scenario selected. Recordings need no API key and should be described as recorded; reserve “live” for a typed run that is actually calling the services.
- On slide 2, pause on the three states: companion draft → `replace` decision → delivered support reply. The first turn is ELEVATED, not CRISIS.
- On slide 6, the CRISIS turn stops the companion, sends the crisis reply in about 0.42 seconds, and writes a handoff event. It does not notify a staffed team.
- If time is short, keep the caveats on slide 5 and shorten the demo commentary, rather than skipping the distinction between a recorded event and human escalation.

## Q&A evidence notes

- **What exactly was measured?** AUC used 1,750 of the 2,044 BHH test messages, excluding 294 other-crisis messages. Latency used all 2,044 messages. At a 5% false-alarm rate, Jev recalled 96% of self-harm messages.
- **What does the cost mean?** `$0.04 per 1,000` is the recorded estimate for Jev user checks from eval token usage and list price. It excludes the companion model, the reply check, storage, network, and application operations.
- **Are the labels clinical ground truth?** No. BHH validation labels are human-labelled, but the reported test split labels were produced by a majority of three gpt-4o-mini runs. FirstRead’s questions are loosely Columbia-style and are not a validated clinical instrument.
- **Does CRISIS alert someone today?** The runtime creates and stores a handoff record when the level first reaches CRISIS. The public demo has no staffed recipient; the reply says this explicitly. Connecting, acknowledging, and auditing a real human workflow is future integration work.
- **What happens during an outage?** After the draft is ready, both checks have a three-second deadline. On timeout, rate limit, or service failure, the draft is withheld and a level-appropriate fallback is sent. There is no fallback classifier, so an unread message can remain unassessed until recheck.
- **What is the largest evaluation gap?** The reply check has no labelled evaluation of its own. Conversation tests are small synthetic sets that expose patterns and misses, not a basis for clinical or population-level claims.

## Claim sources

- `README.md` — benchmark scope, latency, cost, limitations, data handling, and demo boundary
- `apps/web/slides/data/bhh.json` — 2,044 total messages; 519 positive and 1,231 negative scored cases; AUC and latency
- `apps/web/slides/data/replay-crisis.json`, turn 0 — the draft, replacement, delivered reply, signals, and timings; turn 1 — CRISIS short-circuit and handoff record
- `packages/firstread/src/guard.ts` and `packages/firstread/src/risk.ts` — deadline, fail-closed behavior, remembered risk, recheck, and human-only CRISIS clearing
- `apps/web/lib/turn.ts` and `apps/web/lib/handoff.ts` — CRISIS short-circuit, stored handoff event, and the public demo’s explicit no-one-on-call wording
- `packages/firstread/evals/fetch-bhh.ts` and `packages/firstread/evals/llm-client.ts` — test-label source and the Jev price used for recorded estimates
