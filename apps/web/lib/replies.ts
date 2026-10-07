import { type Replies, repliesFor } from "firstread";
import { SINGAPORE, formatResources } from "firstread/resources";

/**
 * FirstRead's replacement replies for this demo: Singapore's verified lines, and a crisis reply
 * that doesn't promise a person. The library's default says "I'm bringing in a person from our
 * team"; on a public demo no one is on call, and a false promise at that moment is the worst kind.
 */
export const DEMO_REPLIES: Replies = {
  ...repliesFor("SG"),
  crisis:
    "Thank you for trusting me with this. Your safety matters most right now. In a real deployment, " +
    "a person from the team would be alerted at this point. This demo can't do that, so please reach " +
    `out to someone right now. ${formatResources(SINGAPORE)}`,
};
