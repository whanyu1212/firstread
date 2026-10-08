import type { ComponentType } from "react";
import Problem from "./01-problem.mdx";
import Requirements from "./02-requirements.mdx";
import WhyJev from "./03-why-jev.mdx";
import Live from "./04-live.mdx";

/**
 * Slide order. The full outline (3 acts, ~12 slides) is in Linear HY-24. `steps` is how many
 * build steps follow a slide's first state: the highest `at` on that slide.
 */
export const SLIDES: { title: string; steps: number; Content: ComponentType }[] = [
  { title: "The problem", steps: 2, Content: Problem },
  { title: "What the check needs", steps: 3, Content: Requirements },
  { title: "Why Jev", steps: 2, Content: WhyJev },
  { title: "One conversation, replayed", steps: 1, Content: Live },
];
