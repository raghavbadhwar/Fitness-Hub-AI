import type { Request, RequestHandler } from "express";

export type FixedWindowRateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
  pruneIntervalMs?: number;
  getKey: (req: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_MAX_KEYS = 10_000;

export function createFixedWindowRateLimiter({
  windowMs,
  maxRequests,
  maxKeys = DEFAULT_MAX_KEYS,
  pruneIntervalMs = Math.min(windowMs, 10_000),
  getKey,
}: FixedWindowRateLimiterOptions): RequestHandler {
  const requestCounts = new Map<string, RateLimitEntry>();
  let lastPrunedAt = 0;

  function prune(now: number) {
    if (now - lastPrunedAt < pruneIntervalMs && requestCounts.size <= maxKeys) {
      return;
    }

    lastPrunedAt = now;

    for (const [key, entry] of requestCounts) {
      if (entry.resetAt <= now) {
        requestCounts.delete(key);
      }
    }

    while (requestCounts.size > maxKeys) {
      if (!deleteOldestEntry()) return;
    }
  }

  function deleteOldestEntry() {
    const oldestKey = requestCounts.keys().next().value;
    if (typeof oldestKey !== "string") {
      return false;
    }

    requestCounts.delete(oldestKey);
    return true;
  }

  return (req, res, next) => {
    const now = Date.now();
    prune(now);

    const key = getKey(req);
    const entry = requestCounts.get(key);

    if (!entry || now > entry.resetAt) {
      if (!entry && requestCounts.size >= maxKeys) {
        deleteOldestEntry();
      }

      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
      return;
    }

    entry.count += 1;
    next();
  };
}
