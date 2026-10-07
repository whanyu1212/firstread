import "server-only";
import { FirstRead } from "firstread";
import { DEMO_REPLIES } from "./replies";

/** The demo's guard: Jev through AI Gateway (AI_GATEWAY_API_KEY), with the demo's replies. */
export const guard = new FirstRead({ replies: DEMO_REPLIES });
