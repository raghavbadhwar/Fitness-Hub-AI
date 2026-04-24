import type { Request } from "express";
import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";

export type ClerkUserAccessIdentity = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  publicMetadata?: Record<string, unknown>;
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  createdAt?: number;
};

export type ClerkUserSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
  createdAt: number;
};

export function createServerClerkClient(secretKey = process.env.CLERK_SECRET_KEY) {
  return createClerkClient({ secretKey });
}

export function getRequestUserId(req: Request) {
  return getAuth(req)?.userId ?? null;
}

export async function getClerkUserById(userId: string) {
  const clerkClient = createServerClerkClient();
  return (await clerkClient.users.getUser(userId)) as ClerkUserAccessIdentity;
}

export async function listAllClerkUsers(
  secretKey: string,
  pageSize = 200,
): Promise<ClerkUserSummary[]> {
  const clerkClient = createServerClerkClient(secretKey);
  const users: ClerkUserSummary[] = [];
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

export async function getAuthenticatedClerkUser(req: Request) {
  const userId = getRequestUserId(req);
  if (!userId) {
    return null;
  }

  return {
    userId,
    user: await getClerkUserById(userId),
  };
}
