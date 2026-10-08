"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { StepContext } from "./deck/steps";
import { Logo } from "./Logo";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "PageDown", " "]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);
/** Arriving on a slide by going back lands on its last step, as in Keynote. */
const LAST_STEP = "#last";

/** Typing in a slide's input must never change the slide. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function DeckShell({
  index,
  total,
  steps,
  title,
  children,
}: {
  index: number;
  total: number;
  /** Build steps after the slide's first state; 0 for a slide with none. */
  steps: number;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [step, setStepState] = useState(0);
  // Read and written synchronously, so quick presses each count.
  const current = useRef(0);
  const setStep = useCallback((n: number) => {
    current.current = n;
    setStepState(n);
  }, []);

  useEffect(() => {
    if (window.location.hash === LAST_STEP) {
      setStep(steps);
      history.replaceState(null, "", window.location.pathname);
    }
  }, [steps, setStep]);

  const forward = useCallback(() => {
    if (current.current < steps) setStep(current.current + 1);
    else if (index < total) router.push(`/deck/${index + 1}`);
  }, [index, total, steps, router, setStep]);

  const back = useCallback(() => {
    if (current.current > 0) setStep(current.current - 1);
    else if (index > 1) router.push(`/deck/${index - 1}${LAST_STEP}`);
  }, [index, router, setStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (NEXT_KEYS.has(e.key)) forward();
      else if (PREV_KEYS.has(e.key)) back();
      // Already on the first or last slide, navigating wouldn't remount it, so set the step here.
      else if (e.key === "Home") {
        if (index === 1) setStep(0);
        else router.push("/deck/1");
      } else if (e.key === "End") {
        if (index === total) setStep(steps);
        else router.push(`/deck/${total}${LAST_STEP}`);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    if (index < total) router.prefetch(`/deck/${index + 1}`);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, back, index, total, steps, router, setStep]);

  const atStart = index === 1 && step === 0;
  const atEnd = index === total && step === steps;
  const progress = (index - 1 + (step + 1) / (steps + 1)) / total;

  return (
    <MotionConfig reducedMotion="user">
      <StepContext.Provider value={step}>
        <main className="deck flex min-h-dvh flex-col bg-page text-ink">
          <section className="slide mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-12 sm:px-12">
            {children}
          </section>
          <footer className="flex items-center justify-between gap-4 px-6 py-4 text-sm text-muted sm:px-12">
            <span className="flex min-w-0 items-center gap-3">
              <Logo size="sm" />
              <span className="truncate">{title}</span>
            </span>
            <nav className="flex shrink-0 items-center gap-3" aria-label="Slides">
              <button type="button" onClick={back} disabled={atStart} aria-label="Back" className="hover:text-ink disabled:opacity-30">
                ←
              </button>
              <span className="font-mono whitespace-nowrap">
                {index} / {total}
              </span>
              <button type="button" onClick={forward} disabled={atEnd} aria-label="Forward" className="hover:text-ink disabled:opacity-30">
                →
              </button>
              <Link href="/demo" className="ml-3 hover:text-ink">
                Demo
              </Link>
            </nav>
          </footer>
          <div className="h-0.5 bg-line">
            <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${100 * progress}%` }} />
          </div>
        </main>
      </StepContext.Provider>
    </MotionConfig>
  );
}
