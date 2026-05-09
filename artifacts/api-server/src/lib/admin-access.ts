import type { Request } from "express";
import { getAuthenticatedClerkUser } from "./clerk-request.ts";
import { getPrimaryEmail, normalizeEmail } from "./user-access.ts";

export type AdminAccessResult =
  | {
      allowed: true;
      userId: string;
      email: string | null;
      role: string | null;
      gymId: string;
      allowlistConfigured: boolean;
      reason: null;
    }
  | {
      allowed: false;
      status: 401 | 403;
      userId: string | null;
      email: string | null;
      role: string | null;
      gymId: string | null;
      allowlistConfigured: boolean;
      reason: string;
    };

export const DEFAULT_GYM_ID = "gymos-main";

function normalizeGymId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized && /^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized) ? normalized : null;
}

function getDefaultGymId() {
  return normalizeGymId(process.env.DEFAULT_GYM_ID) ?? DEFAULT_GYM_ID;
}

function isConfiguredEnv(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function getConfiguredAdminGymOwners(): Map<string, string> {
  const raw = process.env.ADMIN_GYM_OWNER_EMAILS;
  const owners = new Map<string, string>();
  if (typeof raw !== "string" || !raw.trim()) {
    return owners;
  }

  for (const entry of raw.split(/[,\n;]+/)) {
    const [rawEmail, rawGymId] = entry.split(":");
    const email = normalizeEmail(rawEmail);
    const gymId = normalizeGymId(rawGymId);

    if (email && gymId) {
      owners.set(email, gymId);
    }
  }

  return owners;
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

function resolveOwnerGymId(email: string | null): {
  gymId: string | null;
  allowlistConfigured: boolean;
} {
  const hasOwnerGymMap = isConfiguredEnv(process.env.ADMIN_GYM_OWNER_EMAILS);
  const configuredOwners = getConfiguredAdminGymOwners();
  if (hasOwnerGymMap) {
    return {
      gymId: email ? (configuredOwners.get(email) ?? null) : null,
      allowlistConfigured: true,
    };
  }

  const hasAllowedEmailList = isConfiguredEnv(process.env.ADMIN_ALLOWED_EMAILS);
  const allowedEmails = getAllowedAdminEmails();
  if (hasAllowedEmailList) {
    return {
      gymId: email && allowedEmails.has(email) ? getDefaultGymId() : null,
      allowlistConfigured: true,
    };
  }

  return { gymId: getDefaultGymId(), allowlistConfigured: false };
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
      gymId: null,
      allowlistConfigured:
        isConfiguredEnv(process.env.ADMIN_GYM_OWNER_EMAILS) ||
        isConfiguredEnv(process.env.ADMIN_ALLOWED_EMAILS),
      reason: "Unauthorized",
    };
  }

  const user = identity.user;
  const role = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
  const email = getPrimaryEmail(user);
  const { gymId, allowlistConfigured } = resolveOwnerGymId(email);

  if (allowlistConfigured && !gymId) {
    return {
      allowed: false,
      status: 403,
      userId: user.id,
      email,
      role,
      gymId: null,
      allowlistConfigured,
      reason: "Forbidden: email is not approved for admin access",
    };
  }

  if (!allowlistConfigured && role !== "owner") {
    return {
      allowed: false,
      status: 403,
      userId: user.id,
      email,
      role,
      gymId,
      allowlistConfigured,
      reason: "Forbidden: owner access required",
    };
  }

  return {
    allowed: true,
    userId: user.id,
    email,
    role: "owner",
    gymId: gymId ?? getDefaultGymId(),
    allowlistConfigured,
    reason: null,
  };
}
