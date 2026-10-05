import type { ComponentType } from "react";
import Problem from "./01-problem.mdx";
import Requirements from "./02-requirements.mdx";
import WhyJev from "./03-why-jev.mdx";
import Live from "./04-live.mdx";

/** Slide order. The full outline (3 acts, ~12 slides) is in Linear HY-24. */
export const SLIDES: { title: string; Content: ComponentType }[] = [
  { title: "The problem", Content: Problem },
  { title: "What the check needs", Content: Requirements },
  { title: "Why Jev", Content: WhyJev },
  { title: "The companion, live", Content: Live },
];
