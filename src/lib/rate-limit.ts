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

// Create a Ratelimit instance (e.g. 200 requests per hour per IP)
// If Redis is not configured, we export a mock rate limiter that always allows requests.
export const rateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "1 h"),
      analytics: true,
      prefix: "rawshare_ratelimit",
    })
  : {
      limit: async (identifier: string) => {
        console.warn("Upstash Redis not configured. Rate limiting is bypassed for:", identifier);
        return { success: true, pending: Promise.resolve(), limit: 200, remaining: 199, reset: 0 };
      },
    };
