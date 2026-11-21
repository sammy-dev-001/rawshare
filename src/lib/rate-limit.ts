import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Upstash env vars are provided
const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a Redis client if configured
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Upload presign rate limiter — 600 requests per hour per IP.
// Each file upload triggers multiple API calls (presign + optional multipart chunks),
// so the old 200/hr limit was easily exhausted with a modest batch of files.
export const rateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(600, "1 h"),
      analytics: true,
      prefix: "rawshare_ratelimit",
    })
  : {
      limit: async (identifier: string) => {
        console.warn("Upstash Redis not configured. Rate limiting is bypassed for:", identifier);
        return { success: true, pending: Promise.resolve(), limit: 600, remaining: 599, reset: 0 };
      },
    };

// Chunk sign rate limiter — higher ceiling for the high-frequency multipart
// sign-part calls (one API hit per 10 MB chunk). 1000 req/hr should cover even
// very large batch uploads without false-positive throttling.
export const chunkRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, "1 h"),
      analytics: true,
      prefix: "rawshare_chunk_ratelimit",
    })
  : {
      limit: async (identifier: string) => {
        console.warn("Upstash Redis not configured. Chunk rate limiting is bypassed for:", identifier);
        return { success: true, pending: Promise.resolve(), limit: 1000, remaining: 999, reset: 0 };
      },
    };
