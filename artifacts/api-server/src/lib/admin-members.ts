import { createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";
import {
  db,
  memberAiProfiles,
  userAccessControls,
  type UserAccessStatus,
  userProfiles,
  type UserRole,
} from "@workspace/db";
import {
  displayNameForClerkUser,
  getPrimaryEmail,
  isUserAccessStatus,
  isUserRole,
  type GrantableUserRole,
} from "./user-access.ts";
import {
  listAllClerkUsers,
  type ClerkUserAccessIdentity,
  type ClerkUserSummary,
} from "./clerk-request.ts";

type ClerkClient = ReturnType<typeof createClerkClient>;

type AccessControlSummary = {
  gymId: string;
  email: string;
  role: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
};

type MemberAiProfileSummary = {
  memorySummary: string;
  updatedAt: Date;
  recentMessages: unknown;
};

export type AdminMemberPayload = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  accessStatus: UserAccessStatus;
  accessUpdatedAt: string | null;
  gymId: string;
  createdAt: string;
  aiMemorySummary: string | null;
  aiLastUpdatedAt: string | null;
  aiRecentMessageCount: number;
};

type AdminMemberListCacheEntry = {
  expiresAt: number;
  promise: Promise<AdminMemberPayload[]>;
};

const DEFAULT_MEMBER_LIST_CACHE_TTL_MS = 15_000;
const memberListCache = new Map<string, AdminMemberListCacheEntry>();

function getMemberListCacheTtlMs() {
  const raw = process.env.ADMIN_MEMBER_LIST_CACHE_TTL_MS;
  if (!raw) {
    return DEFAULT_MEMBER_LIST_CACHE_TTL_MS;
  }

  const ttl = Number.parseInt(raw, 10);
  return Number.isFinite(ttl) && ttl >= 0 ? ttl : DEFAULT_MEMBER_LIST_CACHE_TTL_MS;
}

function cloneAdminMembers(members: AdminMemberPayload[]) {
  return members.map((member) => ({ ...member }));
}

export function clearAdminMemberListCache(gymId?: string) {
  if (gymId) {
    memberListCache.delete(gymId);
    return;
  }

  memberListCache.clear();
}

function isOwnerAccount(
  profile: { role?: string | null } | undefined,
  user: { publicMetadata?: Record<string, unknown> },
) {
  return profile?.role === "owner" || user.publicMetadata?.role === "owner";
}

function buildAdminMemberPayload(
  user: ClerkUserSummary,
  profile?: { name: string; role: string; gymId?: string | null },
  aiProfile?: MemberAiProfileSummary,
  accessControl?: AccessControlSummary,
): AdminMemberPayload {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const resolvedName = profile?.name?.trim() || fullName || null;
  const metadataRole = user.publicMetadata?.role;
  const role = isOwnerAccount(profile, user)
    ? "owner"
    : (isUserRole(profile?.role) && profile.role) ||
      (accessControl?.status === "approved" &&
        isUserRole(accessControl.role) &&
        accessControl.role) ||
      (isUserRole(metadataRole) && metadataRole) ||
      "member";
  const accessStatus =
    role === "owner"
      ? "approved"
      : accessControl && isUserAccessStatus(accessControl.status)
        ? accessControl.status
        : profile
          ? "approved"
          : "pending";
  const recentMessageCount = Array.isArray(aiProfile?.recentMessages)
    ? aiProfile.recentMessages.length
    : 0;

  return {
    id: user.id,
    name: resolvedName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    role,
    accessStatus,
    accessUpdatedAt: accessControl?.updatedAt?.toISOString() ?? null,
    gymId: profile?.gymId ?? accessControl?.gymId ?? "gymos-main",
    createdAt: new Date(user.createdAt).toISOString(),
    aiMemorySummary: aiProfile?.memorySummary?.trim() || null,
    aiLastUpdatedAt: aiProfile?.updatedAt?.toISOString() ?? null,
    aiRecentMessageCount: recentMessageCount,
  };
}

function buildEmailOnlyAccessPayload(accessControl: AccessControlSummary): AdminMemberPayload {
  return {
    id: `email:${accessControl.email}`,
    name: null,
    firstName: null,
    lastName: null,
    email: accessControl.email,
    role: isUserRole(accessControl.role) ? accessControl.role : "member",
    accessStatus: isUserAccessStatus(accessControl.status) ? accessControl.status : "pending",
    accessUpdatedAt: accessControl.updatedAt.toISOString(),
    gymId: accessControl.gymId,
    createdAt: accessControl.createdAt.toISOString(),
    aiMemorySummary: null,
    aiLastUpdatedAt: null,
    aiRecentMessageCount: 0,
  };
}

export async function listAdminMembers(
  secretKey: string,
  gymId = "gymos-main",
): Promise<AdminMemberPayload[]> {
  const ttlMs = getMemberListCacheTtlMs();
  const now = Date.now();
  const cached = memberListCache.get(gymId);

  if (ttlMs > 0 && cached && cached.expiresAt > now) {
    return cloneAdminMembers(await cached.promise);
  }

  const promise = listAdminMembersUncached(secretKey, gymId);
  const cacheEntry = { expiresAt: now + ttlMs, promise };

  if (ttlMs > 0) {
    memberListCache.set(gymId, cacheEntry);
  }

  try {
    return cloneAdminMembers(await promise);
  } catch (error) {
    if (memberListCache.get(gymId) === cacheEntry) {
      memberListCache.delete(gymId);
    }
    throw error;
  }
}

async function listAdminMembersUncached(
  secretKey: string,
  gymId: string,
): Promise<AdminMemberPayload[]> {
  const users = await listAllClerkUsers(secretKey);
  const [profiles, aiProfiles, accessControls] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.gymId, gymId)),
    db.select().from(memberAiProfiles),
    db.select().from(userAccessControls).where(eq(userAccessControls.gymId, gymId)),
  ]);
  const profileMap = new Map(profiles.map((profile) => [profile.clerkId, profile]));
  const aiProfileMap = new Map(aiProfiles.map((profile) => [profile.memberClerkId, profile]));
  const accessControlMap = new Map(
    accessControls.map((accessControl) => [accessControl.email, accessControl]),
  );
  const listedEmails = new Set<string>();

  return users
    .filter((user) => {
      const email = getPrimaryEmail(user) ?? "";
      return profileMap.has(user.id) || Boolean(email && accessControlMap.has(email));
    })
    .map((user) => {
      const email = getPrimaryEmail(user) ?? "";
      if (email) {
        listedEmails.add(email);
      }

      return buildAdminMemberPayload(
        user,
        profileMap.get(user.id),
        aiProfileMap.get(user.id),
        email ? accessControlMap.get(email) : undefined,
      );
    })
    .concat(
      accessControls
        .filter((accessControl) => !listedEmails.has(accessControl.email))
        .map(buildEmailOnlyAccessPayload),
    )
    .sort((left, right) => {
      const leftName = (left.name || left.email).toLowerCase();
      const rightName = (right.name || right.email).toLowerCase();
      return leftName.localeCompare(rightName);
    });
}

async function findClerkUserByEmail(
  clerkClient: ClerkClient,
  email: string,
): Promise<ClerkUserAccessIdentity | null> {
  const { data } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
  return (data[0] as ClerkUserAccessIdentity | undefined) ?? null;
}

async function upsertEmailAccessControl({
  gymId,
  email,
  role,
  status,
  createdByClerkId,
}: {
  gymId: string;
  email: string;
  role: GrantableUserRole;
  status: "approved" | "revoked";
  createdByClerkId: string | null;
}) {
  const [accessControl] = await db
    .insert(userAccessControls)
    .values({
      gymId,
      email,
      role,
      status,
      createdByClerkId,
    })
    .onConflictDoUpdate({
      target: [userAccessControls.gymId, userAccessControls.email],
      set: {
        role,
        status,
        createdByClerkId,
        updatedAt: new Date(),
      },
    })
    .returning();

  return accessControl as AccessControlSummary;
}

async function syncExistingUserAccess({
  clerkClient,
  user,
  gymId,
  role,
  status,
  existingProfile,
}: {
  clerkClient: ClerkClient;
  user: ClerkUserAccessIdentity;
  gymId: string;
  role: GrantableUserRole;
  status: "approved" | "revoked";
  existingProfile?: { name: string; role: string; gymId?: string | null } | null;
}) {
  const existingUserProfile =
    existingProfile === undefined
      ? (await db.select().from(userProfiles).where(eq(userProfiles.clerkId, user.id)).limit(1))[0]
      : existingProfile;

  if (isOwnerAccount(existingUserProfile ?? undefined, user)) {
    throw new Error("Owner accounts must be managed separately");
  }

  if (existingUserProfile?.gymId && existingUserProfile.gymId !== gymId) {
    throw new Error("This account already belongs to another gym");
  }

  const previousPublicMetadata = { ...user.publicMetadata };
  await clerkClient.users.updateUser(user.id, {
    publicMetadata: {
      ...previousPublicMetadata,
      role: status === "approved" ? role : "member",
    },
  });

  const nextName = existingUserProfile?.name?.trim() || displayNameForClerkUser(user);
  const [profile] = await db
    .insert(userProfiles)
    .values({
      clerkId: user.id,
      gymId,
      name: nextName,
      role: status === "approved" ? role : "member",
    })
    .onConflictDoUpdate({
      target: userProfiles.clerkId,
      set: {
        name: nextName,
        gymId,
        role: status === "approved" ? role : "member",
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile;
}

export async function setAdminMemberAccess({
  gymId,
  email,
  role,
  accessStatus,
  createdByClerkId,
  secretKey,
}: {
  gymId: string;
  email: string;
  role: GrantableUserRole;
  accessStatus: "approved" | "revoked";
  createdByClerkId: string | null;
  secretKey: string;
}): Promise<AdminMemberPayload> {
  const clerkClient = createClerkClient({ secretKey });
  const user = await findClerkUserByEmail(clerkClient, email);
  const [existingProfile] = user
    ? await db.select().from(userProfiles).where(eq(userProfiles.clerkId, user.id)).limit(1)
    : [null];
  let accessControl: AccessControlSummary | null = null;

  try {
    if (user && isOwnerAccount(existingProfile ?? undefined, user)) {
      throw new Error("Owner accounts must be managed separately");
    }

    if (user && existingProfile?.gymId && existingProfile.gymId !== gymId) {
      throw new Error("This account already belongs to another gym");
    }

    accessControl = await upsertEmailAccessControl({
      gymId,
      email,
      role,
      status: accessStatus,
      createdByClerkId,
    });

    if (!user) {
      return buildEmailOnlyAccessPayload(accessControl);
    }

    const updatedProfile = await syncExistingUserAccess({
      clerkClient,
      user,
      gymId,
      role,
      status: accessStatus,
      existingProfile,
    });
    const [aiProfile] = await db
      .select()
      .from(memberAiProfiles)
      .where(eq(memberAiProfiles.memberClerkId, user.id))
      .limit(1);
    const updatedUser: ClerkUserSummary = {
      id: user.id,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      emailAddresses: [{ emailAddress: email }],
      publicMetadata: {
        ...(user.publicMetadata ?? {}),
        role: accessStatus === "approved" ? role : "member",
      },
      createdAt: user.createdAt ?? Date.now(),
    };

    return buildAdminMemberPayload(updatedUser, updatedProfile, aiProfile, accessControl);
  } finally {
    if (accessControl) {
      clearAdminMemberListCache(gymId);
    }
  }
}

export async function updateAdminMemberRole({
  gymId,
  userId,
  role,
  secretKey,
}: {
  gymId: string;
  userId: string;
  role: GrantableUserRole;
  secretKey: string;
}): Promise<AdminMemberPayload> {
  const clerkClient = createClerkClient({ secretKey });
  const user = (await clerkClient.users.getUser(userId)) as ClerkUserAccessIdentity;
  const email = getPrimaryEmail(user);

  if (!email) {
    throw new Error("Member must have a valid primary email");
  }

  const [existingProfile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);
  if (isOwnerAccount(existingProfile ?? undefined, user)) {
    throw new Error("Owner accounts must be managed separately");
  }

  if (existingProfile?.gymId && existingProfile.gymId !== gymId) {
    throw new Error("This account belongs to another gym");
  }

  const nextName = existingProfile?.name?.trim() || displayNameForClerkUser(user);
  const previousPublicMetadata = { ...user.publicMetadata };

  await clerkClient.users.updateUser(userId, {
    publicMetadata: {
      ...previousPublicMetadata,
      role,
    },
  });

  let updatedProfile;
  let accessControl: AccessControlSummary;
  let shouldClearCache = false;
  try {
    shouldClearCache = true;
    [updatedProfile, accessControl] = await Promise.all([
      db
        .insert(userProfiles)
        .values({
          clerkId: userId,
          gymId,
          name: nextName,
          role,
        })
        .onConflictDoUpdate({
          target: userProfiles.clerkId,
          set: {
            name: nextName,
            gymId,
            role,
            updatedAt: new Date(),
          },
        })
        .returning()
        .then(([profile]) => profile),
      upsertEmailAccessControl({
        gymId,
        email,
        role,
        status: "approved",
        createdByClerkId: null,
      }),
    ]);
  } catch (dbError) {
    await clerkClient.users.updateUser(userId, {
      publicMetadata: previousPublicMetadata,
    });
    throw dbError;
  } finally {
    if (shouldClearCache) {
      clearAdminMemberListCache(gymId);
    }
  }

  const [aiProfile] = await db
    .select()
    .from(memberAiProfiles)
    .where(eq(memberAiProfiles.memberClerkId, userId))
    .limit(1);
  const updatedUser: ClerkUserSummary = {
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    emailAddresses: [{ emailAddress: email }],
    createdAt: user.createdAt ?? Date.now(),
    publicMetadata: {
      ...previousPublicMetadata,
      role,
    },
  };

  return buildAdminMemberPayload(updatedUser, updatedProfile, aiProfile, accessControl);
}
