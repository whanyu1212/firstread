import { REPLY_QUESTIONS, USER_TURN_QUESTIONS } from "firstread";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TurnPreview } from "@/components/TurnPreview";
import bhh from "@/slides/data/bhh.json";

const EVENT_URL = "https://luma.com/ltjmoydo";

// Every number on the page is read from the deck's chart data or the question set, not typed in.
const jev = bhh.runs.find((r) => r.id === "jev")!;
const luna = bhh.runs.find((r) => r.id === "luna")!;
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const count = (n: number) => n.toLocaleString("en-US");
const userQuestions = Object.keys(USER_TURN_QUESTIONS).length;
const replyQuestions = Object.keys(REPLY_QUESTIONS).length;

const STATS = [
  {
    value: jev.auc.toFixed(3),
    versus: `${luna.name}: ${luna.auc.toFixed(3)}`,
    body: `How well each one separates risk from no risk (AUC), on ${count(bhh.cases.positive)} messages with self-harm risk and ${count(bhh.cases.negative)} without.`,
  },
  {
    value: seconds(jev.latency.p50),
    versus: `${luna.name}: ${seconds(luna.latency.p50)}`,
    body: "Median time per check, on the same messages.",
  },
  {
    value: String(userQuestions),
    body: `Questions Jev answers about each message, in one call. Another ${replyQuestions} check the companion's draft.`,
  },
];

/** The kickoff's three questions about Jev, and what FirstRead shows for each. */
const SHOWING = [
  {
    question: "How is Jev different from an LLM?",
    title: "It gives a judgement, not a generation.",
    body: "Jev returns a probability for each yes/no question instead of writing text, so FirstRead sets its thresholds on numbers it can test.",
  },
  {
    question: "Why does Jev lower the cost of judgement?",
    title: "Every turn gets checked, not a sample.",
    body: `One call answers all ${userQuestions} questions about a message in about half a second, so checking every turn is practical.`,
  },
  {
    question: "How does Jev fit into an agent harness?",
    title: "It sits in front of every reply.",
    body: "The user check runs while the companion writes its draft. The draft is then sent, replaced with a reply that points to support, or escalated to a person. If Jev doesn't answer in time, the draft isn't sent.",
  },
];

const LINKS = [
  { href: "/deck/1", title: "Open the deck", body: "Why Jev fits the problem, and how we got here." },
  {
    href: "/demo",
    title: "Try the demo",
    body: "Chat with the companion and watch FirstRead check every turn. You'll need your own OpenAI API key.",
  },
];

export default function Home() {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <Glow />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <a
            href={EVENT_URL}
            target="_blank"
            rel="noreferrer"
            className="glass rounded-2xl px-4 py-1.5 text-sm transition-colors hover:bg-white/80 sm:rounded-full"
          >
            Built for <span className="font-semibold">What Would Jev Do?</span>, AdaL's online hackathon, October
            6–11, 2026
          </a>
        </header>

        <section className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-[minmax(0,13fr)_minmax(0,12fr)]">
          <div>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-6xl">
              What would Jev do?
              <br />
              Read every turn first.
            </h1>
            <p className="mt-6 max-w-[34em] text-xl leading-relaxed">
              FirstRead is a safety layer that reads every turn of a mental health companion.
            </p>
            <p className="mt-4 max-w-[34em] text-lg leading-relaxed text-muted">
              A companion agent talks to people at their most vulnerable. Before any reply goes out, FirstRead checks
              the person's message for signs of self-harm risk, and the companion's draft in case it ignores the risk
              or makes it worse.
            </p>
          </div>
          <div className="glass rounded-[24px] p-3">
            <TurnPreview />
          </div>
        </section>

        <section className="mt-20 lg:mt-28" aria-labelledby="numbers">
          <h2 id="numbers" className="text-2xl font-semibold tracking-tight">
            Jev, measured
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.value} className="glass rounded-2xl p-6">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-4xl font-medium tracking-tight">{s.value}</span>
                  {s.versus && <span className="font-mono text-sm text-muted">{s.versus}</span>}
                </p>
                <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Benchmark: the Between Help and Harm test split. Jev and {luna.name} answered the same questions about the
            same messages.
          </p>
        </section>

        <section className="mt-20 lg:mt-28" aria-labelledby="showing">
          <h2 id="showing" className="text-2xl font-semibold tracking-tight">
            What we're showing with Jev
          </h2>
          <ul className="glass mt-6 divide-y divide-ink/8 rounded-3xl">
            {SHOWING.map((s) => (
              <li key={s.question} className="grid gap-2 p-6 sm:p-8 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10">
                <p className="text-muted">{s.question}</p>
                <div>
                  <p className="text-lg font-semibold">{s.title}</p>
                  <p className="mt-1.5 max-w-[40em] leading-relaxed text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:mt-28" aria-label="See it">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="glass rounded-2xl p-6 transition-colors hover:bg-white/80 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight">{l.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{l.body}</p>
            </Link>
          ))}
        </section>

        <footer className="mt-16 border-t border-ink/10 pt-6 text-sm text-muted">
          FirstRead flags risk and routes conversations to people. It doesn't diagnose, and it isn't a replacement for
          human crisis support.
        </footer>
      </main>
    </div>
  );
}

/**
 * Soft colour behind the glass, so it has something to frost. Still, and fixed to the viewport.
 * Sized to the viewport's width and fainter on a phone: otherwise they cover the page there and take
 * the grey text outside the glass below 4.5:1.
 */
function Glow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[12vw] -left-[10vw] size-[40vw] rounded-full bg-glow-blue opacity-60 blur-[max(7vw,48px)] sm:opacity-90" />
      <div className="absolute top-1/4 -right-[12vw] size-[44vw] rounded-full bg-glow-sage opacity-60 blur-[max(7vw,48px)] sm:opacity-90" />
      <div className="absolute -bottom-[14vw] left-1/3 size-[35vw] rounded-full bg-glow-blue opacity-50 blur-[max(7vw,48px)] sm:opacity-70" />
    </div>
  );
}
