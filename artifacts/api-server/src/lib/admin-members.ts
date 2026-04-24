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
import type { ClerkUserAccessIdentity } from "./clerk-request.ts";

type ClerkClient = ReturnType<typeof createClerkClient>;

type ClerkUserSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
  createdAt: number;
};

type AccessControlSummary = {
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
  createdAt: string;
  aiMemorySummary: string | null;
  aiLastUpdatedAt: string | null;
  aiRecentMessageCount: number;
};

async function listAllClerkUsers(secretKey: string): Promise<ClerkUserSummary[]> {
  const clerkClient = createClerkClient({ secretKey });
  const users: ClerkUserSummary[] = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const { data } = await clerkClient.users.getUserList({
      limit: pageSize,
      offset,
    });

    users.push(...(data as ClerkUserSummary[]));

    if (data.length < pageSize) {
      return users;
    }

    offset += data.length;
  }
}

function buildAdminMemberPayload(
  user: ClerkUserSummary,
  profile?: { name: string; role: string },
  aiProfile?: MemberAiProfileSummary,
  accessControl?: AccessControlSummary,
): AdminMemberPayload {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const resolvedName = profile?.name?.trim() || fullName || null;
  const metadataRole = user.publicMetadata?.role;
  const role =
    (isUserRole(profile?.role) && profile.role) ||
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
    createdAt: accessControl.createdAt.toISOString(),
    aiMemorySummary: null,
    aiLastUpdatedAt: null,
    aiRecentMessageCount: 0,
  };
}

export async function listAdminMembers(secretKey: string): Promise<AdminMemberPayload[]> {
  const users = await listAllClerkUsers(secretKey);
  const [profiles, aiProfiles, accessControls] = await Promise.all([
    db.select().from(userProfiles),
    db.select().from(memberAiProfiles),
    db.select().from(userAccessControls),
  ]);
  const profileMap = new Map(profiles.map((profile) => [profile.clerkId, profile]));
  const aiProfileMap = new Map(aiProfiles.map((profile) => [profile.memberClerkId, profile]));
  const accessControlMap = new Map(
    accessControls.map((accessControl) => [accessControl.email, accessControl]),
  );
  const listedEmails = new Set<string>();

  return users
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
  email,
  role,
  status,
  createdByClerkId,
}: {
  email: string;
  role: GrantableUserRole;
  status: "approved" | "revoked";
  createdByClerkId: string | null;
}) {
  const [accessControl] = await db
    .insert(userAccessControls)
    .values({
      email,
      role,
      status,
      createdByClerkId,
    })
    .onConflictDoUpdate({
      target: userAccessControls.email,
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
  role,
  status,
}: {
  clerkClient: ClerkClient;
  user: ClerkUserAccessIdentity;
  role: GrantableUserRole;
  status: "approved" | "revoked";
}) {
  const [existingProfile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, user.id))
    .limit(1);

  const currentRole =
    (isUserRole(existingProfile?.role) && existingProfile.role) ||
    (isUserRole(user.publicMetadata?.role) && user.publicMetadata.role) ||
    "member";

  if (currentRole === "owner") {
    throw new Error("Owner accounts must be managed separately");
  }

  const previousPublicMetadata = { ...user.publicMetadata };
  await clerkClient.users.updateUser(user.id, {
    publicMetadata: {
      ...previousPublicMetadata,
      role: status === "approved" ? role : "member",
    },
  });

  const nextName = existingProfile?.name?.trim() || displayNameForClerkUser(user);
  const [profile] = await db
    .insert(userProfiles)
    .values({
      clerkId: user.id,
      name: nextName,
      role: status === "approved" ? role : "member",
    })
    .onConflictDoUpdate({
      target: userProfiles.clerkId,
      set: {
        name: nextName,
        role: status === "approved" ? role : "member",
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile;
}

export async function setAdminMemberAccess({
  email,
  role,
  accessStatus,
  createdByClerkId,
  secretKey,
}: {
  email: string;
  role: GrantableUserRole;
  accessStatus: "approved" | "revoked";
  createdByClerkId: string | null;
  secretKey: string;
}): Promise<AdminMemberPayload> {
  const clerkClient = createClerkClient({ secretKey });
  const user = await findClerkUserByEmail(clerkClient, email);
  const accessControl = await upsertEmailAccessControl({
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
    role,
    status: accessStatus,
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
}

export async function updateAdminMemberRole({
  userId,
  role,
  secretKey,
}: {
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
  const currentRole =
    (isUserRole(existingProfile?.role) && existingProfile.role) ||
    (isUserRole(user.publicMetadata?.role) && user.publicMetadata.role) ||
    "member";

  if (currentRole === "owner") {
    throw new Error("Owner accounts must be managed separately");
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
  try {
    [updatedProfile, accessControl] = await Promise.all([
      db
        .insert(userProfiles)
        .values({
          clerkId: userId,
          name: nextName,
          role,
        })
        .onConflictDoUpdate({
          target: userProfiles.clerkId,
          set: {
            name: nextName,
            role,
            updatedAt: new Date(),
          },
        })
        .returning()
        .then(([profile]) => profile),
      upsertEmailAccessControl({
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
