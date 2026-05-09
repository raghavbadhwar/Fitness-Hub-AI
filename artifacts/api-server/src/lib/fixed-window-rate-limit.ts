import type { Request, RequestHandler } from "express";

type Env = NodeJS.ProcessEnv;

export type FixedWindowRateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  maxKeys?: number;
  pruneIntervalMs?: number;
  store?: FixedWindowRateLimitStore;
  getKey: (req: Request) => string;
  onLimitExceeded?: (args: { req: Request; key: string; count: number; resetAt: number }) => void;
  onStoreError?: (args: { req: Request; error: unknown }) => void;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type FixedWindowRateLimitIncrementArgs = {
  key: string;
  now: number;
  windowMs: number;
};

export interface FixedWindowRateLimitStore {
  increment(args: FixedWindowRateLimitIncrementArgs): Promise<RateLimitEntry> | RateLimitEntry;
}

const DEFAULT_MAX_KEYS = 10_000;

export class InMemoryFixedWindowRateLimitStore implements FixedWindowRateLimitStore {
  private readonly requestCounts = new Map<string, RateLimitEntry>();
  private lastPrunedAt = 0;

  constructor(
    private readonly options: {
      maxKeys?: number;
      pruneIntervalMs?: number;
    } = {},
  ) {}

  increment({ key, now, windowMs }: FixedWindowRateLimitIncrementArgs): RateLimitEntry {
    this.prune(now);

    const entry = this.requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      if (!entry && this.requestCounts.size >= this.maxKeys) {
        this.deleteOldestEntry();
      }

      const nextEntry = { count: 1, resetAt: now + windowMs };
      this.requestCounts.set(key, nextEntry);
      return nextEntry;
    }

    entry.count += 1;
    return entry;
  }

  private get maxKeys() {
    return this.options.maxKeys ?? DEFAULT_MAX_KEYS;
  }

  private get pruneIntervalMs() {
    return this.options.pruneIntervalMs ?? 10_000;
  }

  private prune(now: number) {
    if (now - this.lastPrunedAt < this.pruneIntervalMs && this.requestCounts.size <= this.maxKeys) {
      return;
    }

    this.lastPrunedAt = now;

    for (const [key, entry] of this.requestCounts) {
      if (entry.resetAt <= now) {
        this.requestCounts.delete(key);
      }
    }

    while (this.requestCounts.size > this.maxKeys) {
      if (!this.deleteOldestEntry()) return;
    }
  }

  private deleteOldestEntry() {
    const oldestKey = this.requestCounts.keys().next().value;
    if (typeof oldestKey !== "string") {
      return false;
    }

    this.requestCounts.delete(oldestKey);
    return true;
  }
}

export class HttpFixedWindowRateLimitStore implements FixedWindowRateLimitStore {
  constructor(
    private readonly options: {
      endpoint: string;
      token?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async increment(args: FixedWindowRateLimitIncrementArgs): Promise<RateLimitEntry> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }

    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        algorithm: "fixed-window",
        key: args.key,
        now: args.now,
        windowMs: args.windowMs,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rate limit store request failed (${response.status})`);
    }

    const payload = (await response.json()) as Partial<RateLimitEntry>;
    if (
      typeof payload.count !== "number" ||
      !Number.isFinite(payload.count) ||
      typeof payload.resetAt !== "number" ||
      !Number.isFinite(payload.resetAt)
    ) {
      throw new Error("Rate limit store returned an invalid payload");
    }

    return {
      count: Math.max(1, Math.floor(payload.count)),
      resetAt: payload.resetAt,
    };
  }
}

export function createFixedWindowRateLimitStore({
  env = process.env,
  maxKeys,
  pruneIntervalMs,
  fetchImpl,
}: {
  env?: Env;
  maxKeys?: number;
  pruneIntervalMs?: number;
  fetchImpl?: typeof fetch;
} = {}): FixedWindowRateLimitStore {
  const storeKind = env.AI_RATE_LIMIT_STORE?.trim().toLowerCase() || "memory";
  if (storeKind === "memory") {
    return new InMemoryFixedWindowRateLimitStore({ maxKeys, pruneIntervalMs });
  }

  if (storeKind === "external-http") {
    const endpoint = env.AI_RATE_LIMIT_EXTERNAL_URL?.trim();
    if (!endpoint) {
      throw new Error(
        "AI_RATE_LIMIT_EXTERNAL_URL is required when AI_RATE_LIMIT_STORE=external-http",
      );
    }

    return new HttpFixedWindowRateLimitStore({
      endpoint,
      token: env.AI_RATE_LIMIT_EXTERNAL_TOKEN?.trim() || undefined,
      fetchImpl,
    });
  }

  throw new Error(`Unsupported AI_RATE_LIMIT_STORE value: ${storeKind}`);
}

export function createFixedWindowRateLimiter({
  windowMs,
  maxRequests,
  maxKeys = DEFAULT_MAX_KEYS,
  pruneIntervalMs = Math.min(windowMs, 10_000),
  store = new InMemoryFixedWindowRateLimitStore({ maxKeys, pruneIntervalMs }),
  getKey,
  onLimitExceeded,
  onStoreError,
}: FixedWindowRateLimiterOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const now = Date.now();
      const key = getKey(req);
      const entry = await store.increment({ key, now, windowMs });

      if (entry.count > maxRequests) {
        onLimitExceeded?.({ req, key, count: entry.count, resetAt: entry.resetAt });
        res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
        return;
      }

      next();
    } catch (error) {
      onStoreError?.({ req, error });
      res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    }
  };
}
