"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionConfig } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { deckSection } from "@/lib/deck-navigation";
import type { SlideMeta } from "@/slides";
import { Rail } from "./deck/Rail";
import { StepContext } from "./deck/steps";
import { Logo } from "./Logo";
import styles from "./deck/DeckStyles.module.css";

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
  const { first, last, appendixStart } = deckSection(slides, index);
  const inAppendix = first === appendixStart;
  const total = last - first + 1;
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
    else if (index < last) router.push(`/deck/${index + 1}`);
  }, [index, last, steps, router, setStep]);

  const back = useCallback(() => {
    if (current.current > 0) setStep(current.current - 1);
    else if (index > first) router.push(`/deck/${index - 1}${LAST_STEP}`);
  }, [index, first, router, setStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === " " && e.target instanceof HTMLElement && e.target.closest("button, a, summary")) return;
      if (NEXT_KEYS.has(e.key)) forward();
      else if (PREV_KEYS.has(e.key)) back();
      // Already on the first or last slide, navigating wouldn't remount it, so set the step here.
      else if (e.key === "Home") {
        if (index === first) setStep(0);
        else router.push(`/deck/${first}`);
      } else if (e.key === "End") {
        if (index === last) setStep(steps);
        else router.push(`/deck/${last}${LAST_STEP}`);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    if (index < last) router.prefetch(`/deck/${index + 1}`);
    return () => window.removeEventListener("keydown", onKey);
  }, [forward, back, index, first, last, steps, router, setStep]);

  const atStart = index === first && step === 0;
  const atEnd = index === last && step === steps;

  return (
    <MotionConfig reducedMotion="user">
      <StepContext.Provider value={step}>
        <main className={`deck ${styles.shell}`}>
          <section className={`slide ${styles.slide}`}>
            {inAppendix && <div className={styles.appendixLabel}>FirstRead <span>/</span> Technical appendix <span className={styles.appendixNumber}>A{index - first + 1}</span></div>}
            {children}
          </section>
          <footer className={styles.footer}>
            <div className={styles.footerBar}>
              <Link href="/" aria-label="FirstRead home" className="shrink-0">
                <Logo size="sm" />
              </Link>
              <Rail slides={slides.slice(first - 1, last)} index={index} step={step} offset={first - 1} />
              <p className="min-w-0 flex-1 truncate">
                {act && <span className="text-muted max-sm:hidden">{act}: </span>}
                {title}
              </p>
              <nav className="flex shrink-0 items-center gap-3 text-muted" aria-label="Slide controls">
                <button type="button" onClick={back} disabled={atStart} aria-label="Back" className={styles.navButton}>
                  ←
                </button>
                <span className="font-mono whitespace-nowrap">
                  {inAppendix ? "A" : ""}{index - first + 1} / {total}
                </span>
                <button type="button" onClick={forward} disabled={atEnd} aria-label="Forward" className={styles.navButton}>
                  →
                </button>
                {appendixStart <= slides.length && (
                  <Link href={`/deck/${inAppendix ? appendixStart - 1 : appendixStart}`} className="ml-2 hover:text-ink">
                    {inAppendix ? "Back to pitch" : "Appendix"}
                  </Link>
                )}
                <Link href="/demo" className="hover:text-ink">
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
