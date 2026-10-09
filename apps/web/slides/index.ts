import type { ComponentType } from "react";
import Cover from "./00-cover.mdx";
import Problem from "./01-problem.mdx";
import Requirements from "./02-requirements.mdx";
import WhyJev from "./03-why-jev.mdx";
import Live from "./04-live.mdx";

export interface SlideMeta {
  title: string;
  /** Where the slide sits in the talk; null for the cover. */
  act: string | null;
  /** Build steps after the slide's first state: the highest `at` on that slide. */
  steps: number;
}

/** Slide order. The full outline (3 acts, ~12 slides) is in Linear HY-24. */
export const SLIDES: (SlideMeta & { Content: ComponentType })[] = [
  { title: "What would Jev do?", act: null, steps: 0, Content: Cover },
  { title: "The problem", act: "Act 1, the pain point", steps: 2, Content: Problem },
  { title: "What the check needs", act: "Act 1, the pain point", steps: 3, Content: Requirements },
  { title: "Why Jev", act: "Act 1, the pain point", steps: 2, Content: WhyJev },
  { title: "One conversation, replayed", act: "Act 3, the result", steps: 1, Content: Live },
];
