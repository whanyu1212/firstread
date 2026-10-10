import type { ComponentType } from "react";
import Cover from "./00-cover.mdx";
import Problem from "./01-problem.mdx";
import Requirements from "./02-requirements.mdx";
import WhyJev from "./03-why-jev.mdx";
import AnswersToLevel from "./04-answers-to-level.mdx";
import Harness from "./05-harness.mdx";
import Iterations from "./06-iterations.mdx";
import Honest from "./07-honest.mdx";
import Live from "./08-live.mdx";

export interface SlideMeta {
  title: string;
  /** Where the slide sits in the talk; null for the cover. */
  act: string | null;
  /** Build steps after the slide's first state: the highest `at` on that slide. */
  steps: number;
}

const ACT_1 = "Act 1, the pain point";
const ACT_2 = "Act 2, the process";
const ACT_3 = "Act 3, the result";

/** Slide order. The full outline (3 acts, ~12 slides) is in Linear HY-24; Act 2 is HY-168. */
export const SLIDES: (SlideMeta & { Content: ComponentType })[] = [
  { title: "What would Jev do?", act: null, steps: 0, Content: Cover },
  { title: "The problem", act: ACT_1, steps: 2, Content: Problem },
  { title: "What the check needs", act: ACT_1, steps: 3, Content: Requirements },
  { title: "Why Jev", act: ACT_1, steps: 2, Content: WhyJev },
  { title: "Jev's answers to a level", act: ACT_2, steps: 3, Content: AnswersToLevel },
  { title: "Jev in the harness", act: ACT_2, steps: 4, Content: Harness },
  { title: "The iteration loop", act: ACT_2, steps: 3, Content: Iterations },
  { title: "Staying honest", act: ACT_2, steps: 4, Content: Honest },
  { title: "One conversation, replayed", act: ACT_3, steps: 1, Content: Live },
];
