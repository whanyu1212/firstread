import "server-only";
import { Redis } from "@upstash/redis";

/**
 * The deployed app's Redis (Upstash, from the Vercel Marketplace, HY-22): sessions and the demo's
 * limits. Null when it isn't configured, as in local development, where both stay in memory.
 * The marketplace integration sets the KV_ names; a database made on Upstash directly, the others.
 */
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;
