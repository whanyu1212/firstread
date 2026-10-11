# FirstRead demo video

The recorded walkthrough introduces FirstRead as a **runtime safety layer for AI
companions**. The companion holds the conversation; FirstRead checks the conversation and
draft replies, then applies a policy to decide what gets delivered.

## Delivery

- Recorded from [the deployed site](https://firstread-mu.vercel.app/) on 11 October 2026.
- Final cut: **5:09** (309.067 seconds), 1920 × 1080, 30 fps.
- Voice: AI-generated OpenAI Cedar, `gpt-4o-mini-tts`, speed `0.90`.
- Captions: 59 authored cues aligned to transcribed word timestamps, in a dedicated band
  below the footage. Maximum two lines; narration is disclosed as AI-generated on screen.
- Audio: narration only. Approximately −16.3 LUFS integrated and −1.48 dBTP true peak.
- The deck and demo were captured as separate clips; the edit combines them by topic.

## Chapters

| Time | Chapter |
| --- | --- |
| 0:00 | What FirstRead is |
| 0:20 | Motivation |
| 0:56 | How FirstRead works |
| 1:49 | Recorded demo |
| 3:40 | Evidence and trade-offs |
| 4:27 | Limits and next steps |

Chapter times are rounded down to the beginning of the containing second.

## Recording and editing notes

- Open with the editorial relationship diagram: the user message and recent context feed
  the companion and FirstRead in parallel. The companion supplies its draft to FirstRead,
  which applies the checks and delivery policy before a reply reaches the user.
- Follow with the motivation and architecture from the deck, then two recorded demo
  scenarios: ordinary exam-related hyperbole, followed by a conversation that progresses
  from an Elevated assessment to Crisis and retains that risk after “okay”.
- Show the draft, reply-check result, replacement, and timings in close-up. When inspecting
  an earlier turn, exclude the sidebar's final conversation state so a later Crisis label
  is not confused with the earlier Elevated assessment.
- Preserve the source interaction speed and recorded latency figures. Trim navigation and
  hold a frame when narration needs longer; do not imply these are live requests.
- Return to the deck for speed, recall versus false alarms, risk memory, and remaining work.
- Keep the limits explicit: synthetic messages with real model outputs, historical benchmark
  results rather than clinical validation, and escalation events that do not notify a human
  in the public demo.
- The new opening adds 20.5 seconds. The following 19 sections retain the approved source
  picture segments, narration recordings, and section durations.

## Local media and handoff

Generated media and editing work stay in the ignored `output/` directory. They are not
included in a Git clone. Keep or share a separate media archive before moving workstations.

| Local path | Contents |
| --- | --- |
| `output/recordings/` | Separate source deck and demo recordings, plus raw captures |
| `output/cedar-opening-cut/firstread-cedar-captioned.mp4` | Final video with captions |
| `output/cedar-opening-cut/firstread-cedar-clean.mp4` | Matching video without burned captions |
| `output/cedar-opening-cut/firstread-opening-preview.mp4` | The 20.5-second opening on its own |
| `output/cedar-opening-cut/firstread-narration.m4a` | Narration audio |
| `output/cedar-opening-cut/firstread-captions.srt` | Caption text and timing |
| `output/cedar-opening-cut/edit-plan.json` | Narration, source selections, and crops |
| `output/cedar-opening-cut/timeline.json` | Section and narration timing |

For a revision, update the narration and visual selections, align the captions to the actual
voice recording, and rebuild the timeline and video. Check the export itself: wording,
caption presence and timing, transition frames, audio levels, and total duration. The final
cut's transcript matched its script and all 59 burned caption cues matched their source
images during export verification. Listening review remains part of final acceptance.

## Final narration

The text below matches the final spoken script. Section times are approximate; the local
timeline and SRT retain precise timing. Written-out numbers reflect the spoken wording.

### 0:00 — How FirstRead fits

FirstRead is a runtime safety layer for AI companions. The companion holds the conversation. FirstRead checks the conversation, checks each draft reply, and applies a policy to decide what gets delivered. Our proof of concept focuses on mental health support.

### 0:20 — Why this project

FirstRead started with a concern about access to mental health support in Singapore. Ongoing therapy can be a significant expense, even with subsidised options available. That made me interested in a companion that could offer everyday support and help people reach human care.

### 0:39 — Checking every turn

But building a companion also means taking responsibility for what happens when someone expresses distress, or when the companion gives an inappropriate reply. The question became: can we check every turn quickly enough to intervene before a reply reaches the user?

### 0:56 — One conversation, two checks

FirstRead sits around the companion. While the companion drafts, Jev reads the user's message and recent context in parallel. Once the draft is ready, Jev checks that too. The draft is held until the policy decides what can be delivered.

### 1:14 — From questions to risk levels

There are fourteen questions about the user and four about the reply. Jev returns a probability of yes for each question. FirstRead compares those answers with question-specific cutoffs and combined rules, producing None, Watch, Elevated, or Crisis.

### 1:32 — Scores need a policy

These levels aren't four bands of one overall score. And the answers aren't clinical probabilities of harm. Conversation history also matters: a concerning disclosure shouldn't disappear just because the next message sounds calm.

### 1:49 — Inside the demo

These are recorded synthetic conversations, using real model outputs.

### 1:55 — Ordinary conversation passes through

First, a harmless example: This exam is literally killing me, lol. In this run, FirstRead finds no sign of risk, and the companion's reply passes through unchanged. The checks need to leave room for ordinary conversation.

### 2:11 — Inspecting the first intervention

Now the user says, “Everything feels pointless lately.” Our policy classifies this turn as Elevated. The companion produces an empathetic draft, which we can inspect here.

### 2:24 — Why the draft is withheld

At this level, the policy requires support resources. Jev's answer to ‘Does the draft offer support resources?’ is zero point zero eight, below the required cutoff of zero point five. So FirstRead withholds the draft and sends the configured replacement, which includes support contacts.

### 2:45 — The policy still needs evaluation

This demonstrates the intervention mechanism. Whether that opening message warrants Elevated is itself something we need to evaluate.

### 2:54 — The checks overlap with generation

The timing shows why running the first check in parallel helps. In this turn, Jev reads the user while the companion writes. The reply check then adds about four-tenths of a second after the draft is ready.

### 3:09 — When the conversation reaches Crisis

The next message indicates intent and preparation. FirstRead raises the conversation to Crisis, stops the companion, sends the crisis response, and emits an escalation event. In this public demo, that event does not notify a human.

### 3:25 — Risk retained after “ok”

When the user then says okay, the conversation remains at Crisis. Another draft isn't generated. The earlier disclosure is still carried forward, and we can inspect exactly which messages are being retained.

### 3:40 — Why Jev made this worth testing

Jev made this approach worth testing because of its measured speed and useful scores. In our benchmark run, its median user check took half a second. But speed alone doesn't establish safety.

### 3:55 — Recall improved; false alarms rose

Across three saved policy versions, we caught more of the benchmark's risk messages. Recall rose from about eighty-eight to ninety-six percent. False alarms also rose, from one point five to three point five percent. Those are historical benchmark results, not clinical validation.

### 4:16 — Memory can preserve mistakes, too

Risk memory brings another trade-off: it preserves important context, but it can also preserve a mistaken assessment and make later replies unnecessarily cautious.

### 4:27 — What this proof of concept demonstrates

What this proof of concept demonstrates is an inspectable path from the user's message, through the checks and policy, to the reply actually delivered.

### 4:38 — What comes next

The next work is to independently evaluate the reply checks, reduce unnecessary escalation, and test how conversations recover after risk has been raised. A real deployment would also need a staffed human response workflow.

### 4:55 — Visible decisions. Testable behavior.

For me, the useful result is that these decisions are visible and testable. We can see where FirstRead intervenes, understand why, and identify where its judgment still needs work.
