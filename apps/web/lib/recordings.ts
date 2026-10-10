import crisis from "@/slides/data/replay-crisis.json";
import hyperbole from "@/slides/data/replay-hyperbole.json";
import longSafeTrip from "@/slides/data/replay-long-safe-trip.json";
import pastWindow from "@/slides/data/replay-past-window.json";
import person from "@/slides/data/replay-person.json";
import type { Recording } from "./replay";

/**
 * Every scenario's recording, by scenario id, for the demo's keyless replays. Re-record with
 * `pnpm --filter web record:replay all` whenever questions, thresholds or the companion change.
 */
export const RECORDINGS: Record<string, Recording> = Object.fromEntries(
  ([crisis, hyperbole, longSafeTrip, pastWindow, person] as Recording[]).map((r) => [r.scenario, r]),
);
