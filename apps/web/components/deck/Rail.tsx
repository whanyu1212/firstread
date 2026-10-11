"use client";

import Link from "next/link";
import type { SlideMeta } from "@/slides";

/**
 * Where the talk is, drawn as FirstRead's margin rule: one dot per slide, the rule solid up to the
 * current slide and dashed after it, like the demo's rule before a turn is read. The current dot
 * fills as its build steps play. The rule breaks between acts.
 */
export function Rail({ slides, index, step, offset = 0 }: { slides: SlideMeta[]; index: number; step: number; offset?: number }) {
  return (
    <ol className="flex items-center" aria-label="Slides">
      {slides.map((s, i) => {
        const n = i + offset + 1;
        const fill = n < index ? 1 : n === index ? (step + 1) / (s.steps + 1) : 0;
        const newAct = i > 0 && s.act !== slides[i - 1]!.act;
        return (
          <li key={n} className="flex items-center">
            {i > 0 &&
              (newAct ? (
                <span className="w-3 sm:w-5" aria-hidden="true" />
              ) : (
                <span
                  className="h-[3px] w-5 sm:w-10"
                  style={{
                    background:
                      n <= index
                        ? "var(--color-accent)"
                        : "repeating-linear-gradient(90deg, rgb(23 23 23 / 0.25) 0 4px, transparent 4px 8px)",
                  }}
                  aria-hidden="true"
                />
              ))}
            <Link
              href={`/deck/${n}`}
              aria-label={`Slide ${n}: ${s.title}`}
              aria-current={n === index ? "step" : undefined}
              title={s.title}
              className="group -m-1.5 rounded-full p-1.5"
            >
              <span
                className={`relative block size-4 rounded-full border-2 transition-[border-color,box-shadow] ${n <= index ? "border-accent" : "border-ink/25 group-hover:border-ink/50"} ${n === index ? "shadow-[0_0_0_5px_rgb(0_104_214/0.18)]" : ""}`}
              >
                <span
                  className="absolute inset-0.5 rounded-full bg-accent transition-transform duration-500 motion-reduce:transition-none"
                  style={{ transform: `scale(${fill})` }}
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
