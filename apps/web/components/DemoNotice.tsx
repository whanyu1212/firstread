import { SINGAPORE } from "firstread/resources";

/**
 * Always visible on /demo (HY-153): a public mental health demo with no human behind it must say
 * so, and must show where real help is. The numbers stay on screen; only the privacy detail folds.
 */
export function DemoNotice() {
  return (
    <section aria-label="About this demo" className="rounded-lg border border-level-watch/30 bg-level-watch/[0.06] px-4 py-3 text-sm">
      <p className="font-semibold">This is a demonstration, not a support service. No one reads these chats.</p>
      <p className="mt-1 text-muted">If you need to talk to someone now:</p>
      <ul className="mt-0.5 flex flex-wrap gap-x-6 gap-y-0.5 text-muted">
        {SINGAPORE.lines.map((l) => (
          <li key={l.name}>
            <span className="text-ink">{l.name}</span>, {l.contact} ({l.hours})
          </li>
        ))}
        <li>
          In immediate danger, call <span className="text-ink">{SINGAPORE.emergency}</span>
        </li>
      </ul>
      <p className="mt-1.5 text-muted">Please don't share personal details.</p>
      <details className="mt-0.5 text-muted">
        <summary className="cursor-pointer text-accent">Where your messages go</summary>
        <p className="mt-1 max-w-[70ch]">
          Messages go to OpenAI (with your key) for the companion, and to Jev
          through Vercel AI Gateway for FirstRead's checks. Conversations are kept for a short time, then deleted.
        </p>
      </details>
    </section>
  );
}
