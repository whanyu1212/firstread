"use client";

import { MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * The landing page's glow behind the deck, rearranged for each slide: on a slide change the light
 * drifts to its next place, the one motion that marks the change. It lives in the deck's layout,
 * so it stays mounted from slide to slide. With reduced motion on, it moves without animating.
 * Soft enough on a wide screen that it sets the mood without competing with the text over it.
 */
const BLOB = "absolute rounded-full blur-[max(7vw,48px)]";
// Each arrangement: [x, y] offsets in vw for the blue, sage and lower blue lights.
const PLACES: [number, number][][] = [
  [[0, 0], [0, 0], [0, 0]],
  [[48, 6], [-58, 10], [-22, -4]],
  [[18, 30], [-20, -18], [30, -10]],
  [[62, -2], [-66, 22], [-34, -14]],
  [[6, 18], [-30, -6], [12, -18]],
];

export function DeckGlow() {
  // The layout also renders around a 404 (/deck/1.5, /deck/-1), so anything but a slide number
  // gets the first arrangement.
  const n = Number(usePathname().split("/").at(-1));
  const slide = Number.isInteger(n) && n > 0 ? n : 1;
  const place = PLACES[(slide - 1) % PLACES.length]!;
  const move = (i: number) => ({ x: `${place[i]![0]}vw`, y: `${place[i]![1]}vw` });
  const transition = { duration: 1.6, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <motion.div className={`${BLOB} -top-[12vw] -left-[10vw] size-[40vw] bg-glow-blue opacity-50 lg:opacity-45`} initial={false} animate={move(0)} transition={transition} />
        <motion.div className={`${BLOB} top-1/4 -right-[12vw] size-[44vw] bg-glow-sage opacity-50 lg:opacity-45`} initial={false} animate={move(1)} transition={transition} />
        <motion.div className={`${BLOB} -bottom-[14vw] left-1/3 size-[35vw] bg-glow-blue opacity-40 lg:opacity-35`} initial={false} animate={move(2)} transition={transition} />
      </div>
    </MotionConfig>
  );
}
