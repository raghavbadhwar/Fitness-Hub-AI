import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userAccessControls,
  userAccessStatusEnum,
  userProfiles,
  userRoleEnum,
  type UserAccessStatus,
  type UserRole,
} from "@workspace/db";
import { getAuthenticatedClerkUser, type ClerkUserAccessIdentity } from "./clerk-request.ts";

type ProfileAccessRecord = {
  clerkId: string;
  name: string;
  role: string;
};

type EmailAccessRecord = {
  email: string;
  role: string;
  status: string;
  note?: string | null;
  createdByClerkId?: string | null;
  updatedAt?: Date;
  createdAt?: Date;
};

export type CallerAccess =
  | {
      allowed: true;
      userId: string;
      email: string | null;
      role: UserRole;
      profile: ProfileAccessRecord | null;
      control: EmailAccessRecord | null;
    }
  | {
      allowed: false;
      statusCode: 401 | 403;
      userId: string | null;
      email: string | null;
      role: UserRole | null;
      status: "unauthorized" | "pending_approval" | "revoked";
      message: string;
      profile: ProfileAccessRecord | null;
      control: EmailAccessRecord | null;
    };

export const grantableUserRoles = ["member", "trainer"] as const;
export type GrantableUserRole = (typeof grantableUserRoles)[number];

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function getPrimaryEmail(user: ClerkUserAccessIdentity): string | null {
  return normalizeEmail(user.emailAddresses?.[0]?.emailAddress ?? null);
}

export function isUserRole(value: unknown): value is UserRole {
  return userRoleEnum.includes(value as UserRole);
}

export function isGrantableUserRole(value: unknown): value is GrantableUserRole {
  return grantableUserRoles.includes(value as GrantableUserRole);
}

export function isUserAccessStatus(value: unknown): value is UserAccessStatus {
  return userAccessStatusEnum.includes(value as UserAccessStatus);
}

export function displayNameForClerkUser(user: ClerkUserAccessIdentity) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    getPrimaryEmail(user)?.split("@")[0] ||
    "User"
  );
}

export async function getProfileForClerkId(userId: string): Promise<ProfileAccessRecord | null> {
  const [profile] = await db
    .select({
      clerkId: userProfiles.clerkId,
      name: userProfiles.name,
      role: userProfiles.role,
    })
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);

  return profile ?? null;
}

export async function getAccessControlForEmail(
  email: string | null,
): Promise<EmailAccessRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const [control] = await db
    .select()
    .from(userAccessControls)
    .where(eq(userAccessControls.email, normalizedEmail))
    .limit(1);

  return control ?? null;
}

function resolveApprovedRole(
  user: ClerkUserAccessIdentity,
  profile: ProfileAccessRecord | null,
  control: EmailAccessRecord | null,
): UserRole {
  if (profile?.role === "owner" || user.publicMetadata?.role === "owner") {
    return "owner";
  }

  if (control?.status === "approved" && isUserRole(control.role)) {
    return control.role;
  }

  if (isUserRole(profile?.role)) {
    return profile.role;
  }

  if (isUserRole(user.publicMetadata?.role)) {
    return user.publicMetadata.role;
  }

  return "member";
}

export async function resolveUserAccessForClerkUser(
  user: ClerkUserAccessIdentity,
  providedProfile?: ProfileAccessRecord | null,
): Promise<CallerAccess> {
  const email = getPrimaryEmail(user);
  const [profile, control] = await Promise.all([
    providedProfile === undefined
      ? getProfileForClerkId(user.id)
      : Promise.resolve(providedProfile),
    getAccessControlForEmail(email),
  ]);
  const role = resolveApprovedRole(user, profile, control);

  if (role === "owner") {
    return { allowed: true, userId: user.id, email, role, profile, control };
  }

  if (control?.status === "revoked") {
    return {
      allowed: false,
      statusCode: 403,
      userId: user.id,
      email,
      role,
      status: "revoked",
      message: "Your gym team has turned off member app access for this email.",
      profile,
      control,
    };
  }

  if (control?.status === "pending") {
    return {
      allowed: false,
      statusCode: 403,
      userId: user.id,
      email,
      role,
      status: "pending_approval",
      message: "Your gym team needs to allow this email before you can enter the member app.",
      profile,
      control,
    };
  }

  if (control?.status === "approved" || profile) {
    return { allowed: true, userId: user.id, email, role, profile, control };
  }

  return {
    allowed: false,
    statusCode: 403,
    userId: user.id,
    email,
    role,
    status: "pending_approval",
    message: "Your gym team needs to allow this email before you can enter the member app.",
    profile,
    control,
  };
}

export async function resolveCallerAccess(req: Request): Promise<CallerAccess> {
  const identity = await getAuthenticatedClerkUser(req);
  if (!identity) {
    return {
      allowed: false,
      statusCode: 401,
      userId: null,
      email: null,
      role: null,
      status: "unauthorized",
      message: "Unauthorized",
      profile: null,
      control: null,
    };
  }

  return resolveUserAccessForClerkUser(identity.user);
}

export async function requireApprovedAccess(
  req: Request,
  res: Response,
  roles?: readonly UserRole[],
): Promise<Extract<CallerAccess, { allowed: true }> | null> {
  const access = await resolveCallerAccess(req);

  if (!access.allowed) {
    res.status(access.statusCode).json({
      error: access.message,
      status: access.status,
      email: access.email,
      role: access.role,
    });
    return null;
  }

  if (roles && !roles.includes(access.role)) {
    res.status(403).json({ error: "You do not have permission to perform this action" });
    return null;
  }

  return access;
}
