import cors from "cors";
import type { Express, RequestHandler } from "express";

type Env = NodeJS.ProcessEnv;

const CORS_ORIGIN_ENV_KEYS = [
  "CORS_ALLOWED_ORIGINS",
  "ADMIN_BASE_URL",
  "MEMBER_BASE_URL",
  "API_BASE_URL",
  "VITE_API_BASE_URL",
  "EXPO_PUBLIC_API_BASE_URL",
  "VERCEL_URL",
] as const;

export function normalizeOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function getConfiguredCorsOrigins(env: Env = process.env) {
  const origins = CORS_ORIGIN_ENV_KEYS.flatMap((key) => (env[key] ?? "").split(/[,\s]+/))
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  return new Set(origins);
}

export function isLoopbackOrigin(origin: string) {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
    );
  } catch {
    return false;
  }
}

export function isAllowedCorsOrigin({
  origin,
  allowedOrigins,
  isProduction,
}: {
  origin: string;
  allowedOrigins: ReadonlySet<string>;
  isProduction: boolean;
}) {
  return allowedOrigins.has(origin) || (!isProduction && isLoopbackOrigin(origin));
}

export function createCorsMiddleware(env: Env = process.env) {
  const allowedOrigins = getConfiguredCorsOrigins(env);
  const isProduction = env.NODE_ENV === "production";

  return cors({
    credentials: true,
    origin(origin, callback) {
      if (
        !origin ||
        isAllowedCorsOrigin({
          origin,
          allowedOrigins,
          isProduction,
        })
      ) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });
}

export function createSecurityHeadersMiddleware(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join("; "),
    );
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    next();
  };
}

export function configureTrustProxy(app: Express, env: Env = process.env) {
  const configuredTrustProxy = env.TRUST_PROXY?.trim();
  if (configuredTrustProxy) {
    const numericTrustProxy = Number(configuredTrustProxy);
    app.set(
      "trust proxy",
      Number.isInteger(numericTrustProxy) && numericTrustProxy > 0
        ? numericTrustProxy
        : configuredTrustProxy,
    );
    return;
  }

  if (env.VERCEL === "1") {
    app.set("trust proxy", 1);
  }
}
