import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TurnPreview } from "@/components/TurnPreview";
import bhh from "@/slides/data/bhh.json";
import styles from "./home.module.css";

const EVENT_URL = "https://luma.com/ltjmoydo";

// Every benchmark number is read from the deck's chart data.
const jev = bhh.runs.find((r) => r.id === "jev")!;
const others = bhh.runs.filter((r) => r.id !== "jev");
const bestAuc = [...others].sort((a, b) => b.auc - a.auc)[0]!;
const fastest = [...others].sort((a, b) => a.latency.p50 - b.latency.p50)[0]!;
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const count = (n: number) => n.toLocaleString("en-US");

const STATS = [
  {
    value: jev.auc.toFixed(3),
    label: "Risk discrimination (AUC)",
    versus: `Next best: ${bestAuc.name}, ${bestAuc.auc.toFixed(3)}`,
  },
  {
    value: seconds(jev.latency.p50),
    label: "Median time per check",
    versus: `Next fastest: ${fastest.name}, ${seconds(fastest.latency.p50)}`,
  },
];

export default function Home() {
  return (
    <div className={styles.home}>
      <main className="mx-auto max-w-[1280px] px-5 pt-6 pb-8 sm:px-8 lg:px-12 lg:pt-8">
        <header className={styles.header}>
          <Logo />
          <a href={EVENT_URL} target="_blank" rel="noreferrer" className={styles.event}>
            <span className={styles.eventDot} aria-hidden="true" />
            Built for <span className="font-semibold">What Would Jev Do?</span> <span aria-hidden="true">↗</span>
          </a>
        </header>

        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span aria-hidden="true" /> A safety layer for AI companions</p>
            <h1 id="hero-title" className={styles.title}>
              <span>Read the risk.</span>
              <span>Check the reply.</span>
              <span className={styles.accent}>Before it reaches<br />the user.</span>
            </h1>
            <p className={styles.description}>
              FirstRead runs a Jev user check while your mental health companion drafts. A second Jev check reads the draft.
              A policy that remembers risk across turns decides what gets sent.
            </p>
            <div className={styles.actions}>
              <Link href="/demo" className={styles.primary}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 9 6-9 6V4Z" fill="currentColor" /></svg>
                Watch the demo
              </Link>
              <Link href="/deck/1" className={styles.secondary}>
                Explore the evidence <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className={styles.keyNote}>No API key needed for recorded scenarios.</p>
          </div>
          <TurnPreview />
        </section>

        <section className={styles.evidence} aria-labelledby="numbers">
          <div className={styles.evidenceHeading}>
            <p className={styles.sectionNumber}>01 / THE EVIDENCE</p>
            <h2 id="numbers">Jev, measured.</h2>
            <a href="https://github.com/whanyu1212/firstread#single-messages-jev-against-four-general-models">
              Benchmark & methodology <span aria-hidden="true">↗</span>
            </a>
          </div>
          <dl className={styles.metrics}>
            {STATS.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd><span className={styles.value}>{s.value}</span><span className={styles.versus}>{s.versus}</span></dd>
              </div>
            ))}
          </dl>
          <p className={styles.benchmarkNote}>
            Between Help and Harm test split: AUC on {count(bhh.cases.positive)} self-harm messages and {count(bhh.cases.negative)} without risk;
            latency across all {count(bhh.shared)} messages. These are benchmark results, not clinical validation.
          </p>
        </section>

        <footer className={styles.footer}>
          <span className={styles.footerLabel}>Built to be inspected.</span>
          <p>FirstRead flags risk and emits escalation events for the host app to handle. It doesn't diagnose, and it isn't a replacement for human crisis support.</p>
        </footer>
      </main>
    </div>
  );
}
