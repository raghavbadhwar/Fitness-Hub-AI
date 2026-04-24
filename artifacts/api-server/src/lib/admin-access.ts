import type { Request } from "express";
import { getAuthenticatedClerkUser } from "./clerk-request.ts";
import { getPrimaryEmail, normalizeEmail } from "./user-access.ts";

export type AdminAccessResult =
  | {
      allowed: true;
      userId: string;
      email: string | null;
      role: string | null;
      allowlistConfigured: boolean;
      reason: null;
    }
  | {
      allowed: false;
      status: 401 | 403;
      userId: string | null;
      email: string | null;
      role: string | null;
      allowlistConfigured: boolean;
      reason: string;
    };

function getAllowedAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (typeof raw !== "string" || !raw.trim()) {
    return new Set();
  }

  return new Set(
    raw
      .split(/[,\n;]+/)
      .map((entry) => normalizeEmail(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );
}

export async function resolveAdminAccess(req: Request): Promise<AdminAccessResult> {
  const identity = await getAuthenticatedClerkUser(req);
  if (!identity) {
    return {
      allowed: false,
      status: 401,
      userId: null,
      email: null,
      role: null,
      allowlistConfigured: getAllowedAdminEmails().size > 0,
      reason: "Unauthorized",
    };
  }

  const user = identity.user;
  const role = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
  const email = getPrimaryEmail(user);
  const allowedEmails = getAllowedAdminEmails();
  const allowlistConfigured = allowedEmails.size > 0;

  if (role !== "owner") {
    return {
      allowed: false,
      status: 403,
      userId: user.id,
      email,
      role,
      allowlistConfigured,
      reason: "Forbidden: owner access required",
    };
  }

  if (allowlistConfigured && (!email || !allowedEmails.has(email))) {
    return {
      allowed: false,
      status: 403,
      userId: user.id,
      email,
      role,
      allowlistConfigured,
      reason: "Forbidden: email is not approved for admin access",
    };
  }

  return {
    allowed: true,
    userId: user.id,
    email,
    role,
    allowlistConfigured,
    reason: null,
  };
}
