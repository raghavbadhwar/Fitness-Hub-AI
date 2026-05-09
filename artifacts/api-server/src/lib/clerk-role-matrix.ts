import { randomBytes } from "node:crypto";

export const ROLE_MATRIX_STATE_VERSION = 1;
export const DEFAULT_ROLE_MATRIX_GYM_ID = "gymos-main";
export const DEFAULT_ROLE_MATRIX_EMAIL_DOMAIN = "example.com";
export const DEFAULT_ROLE_MATRIX_STATE_PATH = ".local/clerk-role-matrix.json";
export const DEFAULT_ROLE_MATRIX_ENV_PATH = ".local/clerk-role-matrix.playwright.env";

export type RoleMatrixPersonaKey =
  | "owner"
  | "trainer"
  | "member"
  | "pendingMember"
  | "revokedMember";

export type RoleMatrixPersona = {
  key: RoleMatrixPersonaKey;
  label: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "owner" | "trainer" | "member";
  status: "approved" | "pending" | "revoked";
  gymId: string;
  password: string;
};

export type RoleMatrixPersonaState = Omit<RoleMatrixPersona, "password"> & {
  userId: string;
  sessionId: string;
  apiToken: string;
  signInToken: string;
  signInUrl: string;
};

export type RoleMatrixState = {
  stateVersion: typeof ROLE_MATRIX_STATE_VERSION;
  generatedAt: string;
  gymId: string;
  runId: string;
  emailDomain: string;
  statePath: string;
  adminEnv: {
    ADMIN_ALLOWED_EMAILS: string;
    ADMIN_GYM_OWNER_EMAILS: string;
  };
  personas: Record<RoleMatrixPersonaKey, RoleMatrixPersonaState>;
};

export function isTestClerkSecret(secretKey: string | undefined): boolean {
  return typeof secretKey === "string" && secretKey.startsWith("sk_test_");
}

export function assertSafeClerkMutationEnv({
  allowLiveMutation,
  secretKey,
}: {
  allowLiveMutation: boolean;
  secretKey: string | undefined;
}) {
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required for the Clerk role-matrix harness.");
  }

  if (!isTestClerkSecret(secretKey) && !allowLiveMutation) {
    throw new Error(
      "Refusing to mutate a non-test Clerk instance. Set FITNESS_HUB_ALLOW_LIVE_CLERK_MUTATION=1 only for an explicitly approved disposable live-auth run.",
    );
  }
}

export function normalizeRoleMatrixRunId(value: string | undefined): string {
  const normalized = (value ?? "local")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (normalized || "local").slice(0, 32).replace(/-+$/g, "") || "local";
}

export function normalizeRoleMatrixEmailDomain(value: string | undefined): string {
  const normalized = (value ?? DEFAULT_ROLE_MATRIX_EMAIL_DOMAIN).trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    throw new Error("FITNESS_HUB_CLERK_QA_EMAIL_DOMAIN must be a valid email domain.");
  }
  return normalized;
}

export function generateRoleMatrixPassword(): string {
  return `FhQa-${randomBytes(12).toString("base64url")}-9a!`;
}

export function buildRoleMatrixPersonas({
  emailDomain,
  gymId,
  password,
  runId,
}: {
  emailDomain: string;
  gymId: string;
  password: string;
  runId: string;
}): RoleMatrixPersona[] {
  const safeRunId = normalizeRoleMatrixRunId(runId);
  const safeDomain = normalizeRoleMatrixEmailDomain(emailDomain);

  const definitions: Array<
    Pick<RoleMatrixPersona, "key" | "label" | "firstName" | "lastName" | "role" | "status"> & {
      slug: string;
    }
  > = [
    {
      key: "owner",
      label: "Owner Admin",
      slug: "owner",
      firstName: "Codex",
      lastName: "Owner",
      role: "owner",
      status: "approved",
    },
    {
      key: "trainer",
      label: "Approved Trainer",
      slug: "trainer",
      firstName: "Codex",
      lastName: "Trainer",
      role: "trainer",
      status: "approved",
    },
    {
      key: "member",
      label: "Approved Member",
      slug: "member",
      firstName: "Codex",
      lastName: "Member",
      role: "member",
      status: "approved",
    },
    {
      key: "pendingMember",
      label: "Pending Member",
      slug: "pending-member",
      firstName: "Codex",
      lastName: "Pending",
      role: "member",
      status: "pending",
    },
    {
      key: "revokedMember",
      label: "Revoked Member",
      slug: "revoked-member",
      firstName: "Codex",
      lastName: "Revoked",
      role: "member",
      status: "revoked",
    },
  ];

  return definitions.map((definition) => ({
    ...definition,
    email: `codex-fh-${definition.slug}-${safeRunId}@${safeDomain}`,
    gymId,
    password,
  }));
}

export function summarizePersona(persona: RoleMatrixPersona | RoleMatrixPersonaState) {
  return {
    key: persona.key,
    label: persona.label,
    email: persona.email,
    role: persona.role,
    status: persona.status,
    gymId: persona.gymId,
    userId: "userId" in persona ? persona.userId : undefined,
  };
}

export function mergeAdminAllowedEmails(existing: string | undefined, ownerEmail: string): string {
  const emails = new Set(
    (existing ?? "")
      .split(/[,\n;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  emails.add(ownerEmail.trim().toLowerCase());
  return [...emails].join(",");
}

export function mergeAdminGymOwnerEmails({
  existing,
  gymId,
  ownerEmail,
}: {
  existing: string | undefined;
  gymId: string;
  ownerEmail: string;
}): string {
  const entries = new Map<string, string>();

  for (const entry of (existing ?? "").split(/[,\n;]+/)) {
    const [rawEmail, rawGymId] = entry.split(":");
    const email = rawEmail?.trim().toLowerCase();
    const mappedGymId = rawGymId?.trim().toLowerCase();
    if (email && mappedGymId) {
      entries.set(email, mappedGymId);
    }
  }

  entries.set(ownerEmail.trim().toLowerCase(), gymId);
  return [...entries.entries()].map(([email, mappedGymId]) => `${email}:${mappedGymId}`).join(",");
}
