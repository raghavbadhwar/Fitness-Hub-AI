/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains without requiring CNAME DNS configuration.
 *
 * See: https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi
 *
 * IMPORTANT:
 * - Controlled by CLERK_PROXY_ENABLED=true|false
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import type { Request, RequestHandler } from "express";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

function parseClerkProxyEnabled(): boolean {
  const raw = process.env.CLERK_PROXY_ENABLED;

  if (raw == null) {
    throw new Error("CLERK_PROXY_ENABLED must be set to 'true' or 'false'.");
  }

  if (raw !== "true" && raw !== "false") {
    throw new Error("CLERK_PROXY_ENABLED must be either 'true' or 'false'.");
  }

  return raw === "true";
}

export function clerkProxyMiddleware(): RequestHandler {
  if (!parseClerkProxyEnabled()) {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required when CLERK_PROXY_ENABLED=true.");
  }

  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    pathRewrite: (path: string) => path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = (req as Request).protocol || "https";
        const host = req.headers.host || "";
        const proxyUrl = `${protocol}://${host}${CLERK_PROXY_PATH}`;

        proxyReq.setHeader("Clerk-Proxy-Url", proxyUrl);
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const clientIp = req.ip || req.socket?.remoteAddress || "";
        if (clientIp) {
          proxyReq.setHeader("X-Forwarded-For", clientIp);
        }
      },
    },
  }) as RequestHandler;
}
