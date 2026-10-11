import type { ComponentType } from "react";
import Motivation from "./pitch-00-motivation.mdx";
import Intervention from "./pitch-01-intervention.mdx";
import Requirements from "./pitch-02-requirements.mdx";
import Comparison from "./pitch-03-comparison.mdx";
import Policy from "./pitch-04-policy.mdx";
import Runtime from "./pitch-05-runtime.mdx";
import Memory from "./pitch-06-memory.mdx";
import Learning from "./pitch-07-learning.mdx";
import Limits from "./pitch-08-limits.mdx";
import WhyJev from "./03-why-jev.mdx";
import AnswersToLevel from "./04-answers-to-level.mdx";
import Harness from "./05-harness.mdx";
import Iterations from "./06-iterations.mdx";
import Honest from "./07-honest.mdx";

export interface SlideMeta {
  title: string;
  act: string | null;
  appendix?: boolean;
  /** Highest build step on the slide; the main pitch has no hidden builds. */
  steps: number;
}

/** Nine slides on the motivation, design and evidence, then detailed references for Q&A. */
export const SLIDES: (SlideMeta & { Content: ComponentType })[] = [
  { title: "Why this project", act: "Walkthrough", steps: 0, Content: Motivation },
  { title: "Checking every turn", act: "Walkthrough", steps: 0, Content: Requirements },
  { title: "Why Jev", act: "Walkthrough", steps: 0, Content: Comparison },
  { title: "One conversation, two checks", act: "Walkthrough", steps: 0, Content: Intervention },
  { title: "Questions to risk levels", act: "Walkthrough", steps: 0, Content: Policy },
  { title: "Where the checks run", act: "Walkthrough", steps: 0, Content: Runtime },
  { title: "Risk across turns", act: "Walkthrough", steps: 0, Content: Memory },
  { title: "What testing changed", act: "Walkthrough", steps: 0, Content: Learning },
  { title: "Current limits", act: "Walkthrough", steps: 0, Content: Limits },
  { title: "Model comparison", act: "Appendix", appendix: true, steps: 2, Content: WhyJev },
  { title: "Signals and policy", act: "Appendix", appendix: true, steps: 3, Content: AnswersToLevel },
  { title: "Inside the harness", act: "Appendix", appendix: true, steps: 4, Content: Harness },
  { title: "Iteration history", act: "Appendix", appendix: true, steps: 3, Content: Iterations },
  { title: "Evaluation limits", act: "Appendix", appendix: true, steps: 4, Content: Honest },
];
