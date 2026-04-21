import type { Request } from "express";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";

type ClerkUserWithEmail = {
  id: string;
  publicMetadata?: Record<string, unknown>;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
};

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

function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
}

function getPrimaryEmail(user: ClerkUserWithEmail): string | null {
  return normalizeEmail(user.emailAddresses?.[0]?.emailAddress ?? null);
}

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
  const auth = getAuth(req);
  if (!auth?.userId) {
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

  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = (await clerkClient.users.getUser(auth.userId)) as ClerkUserWithEmail;
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
