# FirstRead: design walkthrough

The main deck is `/deck/1` through `/deck/9`: motivation, requirements, model choice, a concrete intervention, then policy and runtime details. The detailed appendix is `/deck/10` through `/deck/14`.

Use the three-minute script for a timed submission. In a conversation with judges, allow five to six minutes: pause on the comparison, policy rules, and iteration chart rather than rushing the reasoning. There are no hidden builds in the main deck; the appendix keeps its step-by-step diagrams.

## Three-minute route

### 0:00–0:20 — Why this project

“The cost of ongoing therapy in Singapore made us think about a more accessible companion. But checking every turn with another LLM could add a long wait. Jev made that worth revisiting. FirstRead tests the safety layer; it is not a therapy service.”

### 0:20–0:37 — What checking every turn demands

“Checking every turn creates three constraints: latency, cost, and scores we can use. We overlap the user check with generation, measure its cost separately, and ask specific questions. We choose cutoffs from observed errors; a score of 0.3 is not a clinical probability.”

### 0:37–0:55 — Why Jev

“We compared five models on the same questions. Jev had the highest AUC, but GLM was close: 0.976 against 0.992. GLM’s median check took about three times as long, with a higher recorded cost. That makes Jev a useful fit, while leaving calibration and clinical reliability unresolved.”

### 0:55–1:17 — One conversation, two checks

“FirstRead checks the user message and the companion’s draft before delivery. Here is a recorded synthetic turn. The draft is empathetic, but FirstRead reads elevated risk, where our policy also requires support resources. The draft lacks them, so it is replaced. Whether this opener deserved elevated risk is itself a question we need to evaluate.”

### 1:17–1:35 — Questions to risk levels

“For each yes/no question, Jev returns a probability of yes. Here, intent scores 0.96, above our 0.35 CRISIS cutoff. Each question has its own cutoffs. No matching rule means NONE; otherwise, the highest level wins. These answer probabilities are not probabilities of harm.”

### 1:35–1:53 — Where the checks run

“This timeline is the first actual recorded turn. The user check finishes during drafting; the reply check adds about 0.44 seconds. Both checks have a three-second deadline from the draft being ready. On failure, we withhold the draft and use a fallback. The missing assessment is still missing.”

### 1:53–2:10 — Why risk needs memory

“A risk ledger preserves earlier concern, and one calm message cannot erase a crisis. But persistence can amplify a mistaken assessment. Five held-out conversations exceeded their labelled ceiling, and one that should escalate was missed. We need better initial readings and recovery behavior without losing sensitivity.”

### 2:10–2:28 — Catching more risk also raised false alarms

“Testing exposed weak signals that added up and preparation without explicit intent. Adding questions and rules raised recall from 88.1 to 96 percent, but false alarms rose from 1.5 to 3.5 percent. These are historical snapshots, not proof that each change was an unqualified improvement.”

### 2:28–3:00 — What works, what remains unresolved

“We can inspect the full intervention. The next work is labelled reply evaluation, conversation recovery, and an actual human response workflow. Today’s demo records escalation events; it does not alert a staffed team.”

> **Recorded demo cue — allow roughly 15 seconds.** Preload `/demo` in a separate tab and select **See FirstRead intervene**. Show the saved first-turn draft replacement and the second-turn CRISIS short-circuit, using the replay controls to skip ahead if needed. Call it a recording of the real pipeline, not a live request. Return to slide 9 for questions.

## Rehearsal notes

- Slide 1 states the personal motivation, not proof of unmet need or effectiveness. Singapore has subsidised care; costs vary. Psychological first aid is practical support, distinct from therapy. The latency concern concerns LLM-based judges, not every earlier guardrail.

- Rehearse the timing; the script is roughly 400 words plus a short demo. For a strict three-minute slot, preload the recording so navigation does not consume the demo window.
- On slide 4, the recorded assessment is ELEVATED. Do not present that as a clinical finding or proof that the classification is correct. The example demonstrates how the policy changes a reply.
- On slide 3, explain what the comparison supports: model choice for this check. AUC uses 1,750 self-harm/no-risk messages; latency uses all 2,044 shared messages. Test labels are model-generated. The cost estimate covers Jev user checks only, excluding the companion and reply check.
- On slide 5, start with the worked intent example: yes/no question → P(yes) 0.96 → policy cutoff 0.35 → CRISIS. The score comes directly from Jev; FirstRead sets the cutoffs. Then read across the matrix: there is no single overall score divided into four bands. Check marks indicate met cutoffs, not clinical findings. Five of 14 user questions are shown, in shortened form; the full policy also includes combined rules such as plan plus means. NONE means no rule matches, though conversation memory can retain a higher earlier level.
- On slide 7, keep the small synthetic holdout results as counts. Do not turn them into population-level reliability claims.
- On slide 8, the later test-miss fix is outside the historical iteration numbers. Distinguish those historical false-alarm rates from the current model-comparison operating point.
- For the longer walkthrough, pause on the question: what evidence would justify changing a cutoff or allowing risk to settle sooner?

## Appendix routes

| Route | Question | Detail |
| --- | --- | --- |
| `/deck/10` | How do the models compare across thresholds? | Full ROC and latency charts, with scoring-interface caveats |
| `/deck/11` | How do all the rules work? | Signals, cutoffs, and conversation-state walkthrough |
| `/deck/12` | How does the harness deliver a reply? | Step-by-step timing, outcomes, and deadline |
| `/deck/13` | Which changes produced those results? | Iteration chart, saved-run provenance, and commit references |
| `/deck/14` | What could bias the evaluation? | Split discipline, historical caveats, and remaining gaps |

## Evidence and boundaries

- [MOH: outpatient mental health costs](https://www.moh.gov.sg/newsroom/assessing-out-of-pocket-costs-for-outpatient-mental-health-treatment-across-public-and-private-settings/): Singapore affordability context; subsidised care exists and costs vary.
- [WHO: psychological first aid](https://www.who.int/publications/i/item/9789241548205): humane, practical support after serious distress; inspiration for the project, not an endorsement or validation of this companion.

- [All 18 Jev questions](https://github.com/whanyu1212/firstread/blob/main/packages/firstread/src/questions.ts): 14 user-message questions and 4 companion-reply questions, with the exact wording used by the checks. Slide 5 links here in a new tab.
- `README.md`: benchmark scope, cost basis, conversation holdout counts, label provenance, and limitations.
- `apps/web/slides/data/bhh.json`: model AUC and measured latency. Jev’s median is 503 ms, GLM’s 1,562 ms; displayed values are rounded.
- `apps/web/slides/data/replay-crisis.json`: genuine saved draft, delivered reply, signals, and timings. These are synthetic messages, not user research or clinical cases.
- `apps/web/slides/data/iterations.json`: historical recall, false alarms, and policy commits.
- `packages/firstread/src/policy.ts`: explicit rules and thresholds. The presentation reads the selected matching rules from `levelEvidence`.
- `packages/firstread/src/guard.ts` and `risk.ts`: deadlines, fallback behavior, ledger, settling, and explicit CRISIS clearing.
- `apps/web/lib/turn.ts` and `handoff.ts`: generation short-circuit and stored handoff event. There is no staffed recipient in the public demo.

The reply check has no independent labelled evaluation. The questions and thresholds are not a validated clinical instrument. A benchmark, a runnable integration, and an inspectable audit each answer different questions; none substitutes for evaluating the actual response workflow.
