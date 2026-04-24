import type { AccessState, UserProfile, UserRole } from "@/contexts/AppContext";

type AccessCheckPayload = {
  status?: "ready" | "missing_profile" | "pending_approval" | "revoked";
  email?: string | null;
  message?: string | null;
  name?: string;
  role?: UserRole;
};

type SyncBlockedPayload = {
  status?: "pending_approval" | "revoked";
  email?: string | null;
  role?: UserRole | null;
  error?: string;
};

type ServerProfilePayload = {
  name: string;
  role: UserRole;
};

export type ProfileAccessRefreshResult = {
  accessState: AccessState;
  profileUpdates?: Pick<UserProfile, "name" | "role">;
};

function hasNonEmptyValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function blockedAccessState(
  payload: Pick<AccessCheckPayload, "status" | "email" | "role" | "message">,
  currentRole: UserRole,
): AccessState | null {
  if (payload.status !== "pending_approval" && payload.status !== "revoked") {
    return null;
  }

  return {
    status: payload.status,
    email: payload.email,
    role: payload.role ?? currentRole,
    message:
      payload.message ||
      (payload.status === "revoked"
        ? "Your gym team has turned off member app access for this email."
        : "Your gym team needs to allow this email before you can enter the member app."),
  };
}

export async function refreshServerProfileAccess({
  apiBase,
  token,
  currentProfile,
  fallbackName,
}: {
  apiBase: string;
  token: string;
  currentProfile: UserProfile;
  fallbackName: string;
}): Promise<ProfileAccessRefreshResult> {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const accessCheckResponse = await fetch(`${apiBase}/api/profiles/access-check`, {
    headers: authHeaders,
  });
  if (accessCheckResponse.ok) {
    const accessPayload = (await accessCheckResponse.json()) as AccessCheckPayload;
    const blockedState = blockedAccessState(accessPayload, currentProfile.role);

    if (blockedState) {
      return { accessState: blockedState };
    }

    if (accessPayload.status === "ready") {
      const name = hasNonEmptyValue(accessPayload.name) ? accessPayload.name.trim() : fallbackName;
      const role = accessPayload.role ?? currentProfile.role;

      return {
        accessState: { status: "approved", email: accessPayload.email, role },
        profileUpdates: { name, role },
      };
    }
  }

  const response = await fetch(`${apiBase}/api/profiles/sync`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: fallbackName }),
  });

  if (!response.ok) {
    if (response.status === 403) {
      const payload = (await response.json().catch(() => null)) as SyncBlockedPayload | null;
      const blockedState = blockedAccessState(
        {
          status: payload?.status,
          email: payload?.email,
          role: payload?.role ?? undefined,
          message: payload?.error,
        },
        currentProfile.role,
      );

      if (blockedState) {
        return { accessState: blockedState };
      }
    }

    throw new Error(`Failed to sync profile (${response.status})`);
  }

  const serverProfile = (await response.json()) as ServerProfilePayload;
  const name = serverProfile.name || fallbackName;

  return {
    accessState: { status: "approved", role: serverProfile.role },
    profileUpdates: { name, role: serverProfile.role },
  };
}
