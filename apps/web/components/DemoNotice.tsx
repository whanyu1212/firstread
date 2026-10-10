import { SINGAPORE } from "firstread/resources";

/**
 * Always visible on /demo (HY-153): a public mental health demo with no human behind it must say
 * so, and must show where real help is. Every contact stays on screen at every width, as the
 * sources give them; only the privacy detail folds. Kept to a strip so the conversation keeps the
 * screen.
 */
export function DemoNotice() {
  return (
    <section aria-label="About this demo" className="glass shrink-0 rounded-xl px-4 py-2 text-sm">
      <div className="flex gap-2.5">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-level-watch" aria-hidden="true" />
        <div>
          <span className="font-semibold">This is a demonstration, not a support service. No one reads these chats,</span>{" "}
          so please don't share personal details. If you need to talk to someone now:{" "}
          {SINGAPORE.lines.map((l) => (
            <span key={l.name}>
              <span className="font-medium">{l.name}</span>, {l.contact} ({l.hours}).{" "}
            </span>
          ))}
          In immediate danger, call <span className="font-medium">{SINGAPORE.emergency}</span>.{" "}
          <details className="inline [&[open]]:block">
            <summary className="inline cursor-pointer text-accent">Where your messages go</summary>
            <span className="mt-1 block max-w-[70ch] text-ink/75">
              Messages go to OpenAI (on the demo's key, or yours if you add one) for the companion, and to Jev through Vercel AI Gateway for FirstRead's checks.
              Conversations are kept for a short time, then deleted.
            </span>
          </details>
        </div>
      </div>
    </section>
  );
}
