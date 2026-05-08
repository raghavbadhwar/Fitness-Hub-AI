import pino from "pino";
import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

type RequestLogContext = {
  route?: string | null;
  userId?: string | null;
  gymId?: string | null;
  role?: string | null;
};

function safeString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 180) : null;
}

function normalizeRoute(path: string | undefined): string | null {
  const cleanPath = typeof path === "string" ? path.split("?")[0] : "";
  return cleanPath && cleanPath.startsWith("/") ? cleanPath : null;
}

export function setRequestLogContext(res: Response, context: RequestLogContext) {
  const current =
    typeof res.locals.requestLogContext === "object" && res.locals.requestLogContext !== null
      ? (res.locals.requestLogContext as RequestLogContext)
      : {};
  const next: RequestLogContext = { ...current };

  for (const key of ["route", "userId", "gymId", "role"] as const) {
    const value = safeString(context[key]);
    if (value !== undefined) {
      next[key] = value;
    }
  }

  res.locals.requestLogContext = next;
}

export function attachApiRequestLogContext(req: Request, res: Response, next: NextFunction) {
  setRequestLogContext(res, {
    route: normalizeRoute(req.path),
    userId: getAuth(req)?.userId ?? null,
  });
  next();
}

export function getRequestLogContext(req: Request, res: Response): RequestLogContext {
  const context =
    typeof res.locals.requestLogContext === "object" && res.locals.requestLogContext !== null
      ? (res.locals.requestLogContext as RequestLogContext)
      : {};

  return {
    route: context.route ?? normalizeRoute(req.url),
    userId: context.userId ?? null,
    gymId: context.gymId ?? null,
    role: context.role ?? null,
  };
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

export function apiErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  req.log?.error?.({ err, ...getRequestLogContext(req, res) }, "Unhandled API error");

  if (res.headersSent) {
    next(err);
    return;
  }

  res.status(500).json({ error: "Internal server error", requestId: req.id ?? null });
}
