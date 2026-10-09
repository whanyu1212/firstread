"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { SlideMeta } from "@/slides";
import { Rail } from "./deck/Rail";
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

export function DeckShell({ index, slides, children }: { index: number; slides: SlideMeta[]; children: ReactNode }) {
  const router = useRouter();
  const total = slides.length;
  const { title, act, steps } = slides[index - 1]!;
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

  return (
    <MotionConfig reducedMotion="user">
      <StepContext.Provider value={step}>
        <main className="deck flex min-h-dvh flex-col text-ink">
          <section className="slide mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 py-12 sm:px-12">
            {children}
          </section>
          <footer className="px-4 pb-4 sm:px-6">
            <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-2.5 text-sm sm:rounded-full sm:px-5">
              <Link href="/" aria-label="FirstRead home" className="shrink-0">
                <Logo size="sm" />
              </Link>
              <Rail slides={slides} index={index} step={step} />
              <p className="min-w-0 flex-1 truncate">
                {act && <span className="text-muted max-sm:hidden">{act}: </span>}
                {title}
              </p>
              <nav className="flex shrink-0 items-center gap-3 text-muted" aria-label="Slide controls">
                <button type="button" onClick={back} disabled={atStart} aria-label="Back" className="hover:text-ink disabled:opacity-30">
                  ←
                </button>
                <span className="font-mono whitespace-nowrap">
                  {index} / {total}
                </span>
                <button type="button" onClick={forward} disabled={atEnd} aria-label="Forward" className="hover:text-ink disabled:opacity-30">
                  →
                </button>
                <Link href="/demo" className="ml-2 hover:text-ink">
                  Demo
                </Link>
              </nav>
            </div>
          </footer>
        </main>
      </StepContext.Provider>
    </MotionConfig>
  );
}
