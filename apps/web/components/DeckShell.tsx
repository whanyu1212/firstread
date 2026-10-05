"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " "]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

/** Typing in a demo slide's chat box must never change the slide. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function DeckShell({
  index,
  total,
  title,
  children,
}: {
  index: number;
  total: number;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const go = (n: number) => {
      if (n >= 1 && n <= total && n !== index) router.push(`/deck/${n}`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      let target: number | undefined;
      if (NEXT_KEYS.has(e.key)) target = index + 1;
      else if (PREV_KEYS.has(e.key)) target = index - 1;
      else if (e.key === "Home") target = 1;
      else if (e.key === "End") target = total;
      if (target === undefined) return;
      e.preventDefault();
      go(target);
    };
    window.addEventListener("keydown", onKey);
    if (index < total) router.prefetch(`/deck/${index + 1}`);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, router]);

  return (
    <main className="flex min-h-dvh flex-col bg-canvas text-ink">
      <section className="slide mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-12 sm:px-12">
        {children}
      </section>
      <footer className="flex items-center justify-between gap-4 px-6 py-4 text-sm text-muted sm:px-12">
        <span className="truncate">FirstRead · {title}</span>
        <nav className="flex shrink-0 items-center gap-3" aria-label="Slides">
          <Link
            href={`/deck/${index - 1}`}
            aria-disabled={index === 1}
            className={index === 1 ? "pointer-events-none opacity-30" : "hover:text-ink"}
          >
            ←
          </Link>
          <span className="whitespace-nowrap tabular-nums">
            {index} / {total}
          </span>
          <Link
            href={`/deck/${index + 1}`}
            aria-disabled={index === total}
            className={index === total ? "pointer-events-none opacity-30" : "hover:text-ink"}
          >
            →
          </Link>
          <Link href="/demo" className="ml-3 hover:text-ink">
            Demo
          </Link>
        </nav>
      </footer>
      <div className="h-1 bg-line">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${(100 * index) / total}%` }} />
      </div>
    </main>
  );
}
