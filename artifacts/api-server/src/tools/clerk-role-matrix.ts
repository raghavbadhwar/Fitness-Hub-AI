import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import {
  DEFAULT_ROLE_MATRIX_EMAIL_DOMAIN,
  DEFAULT_ROLE_MATRIX_ENV_PATH,
  DEFAULT_ROLE_MATRIX_GYM_ID,
  DEFAULT_ROLE_MATRIX_STATE_PATH,
  ROLE_MATRIX_STATE_VERSION,
  assertSafeClerkMutationEnv,
  buildRoleMatrixPersonas,
  generateRoleMatrixPassword,
  mergeAdminAllowedEmails,
  mergeAdminGymOwnerEmails,
  normalizeRoleMatrixEmailDomain,
  normalizeRoleMatrixRunId,
  summarizePersona,
  type RoleMatrixPersona,
  type RoleMatrixPersonaKey,
  type RoleMatrixPersonaState,
} from "../lib/clerk-role-matrix.ts";

type DbModule = typeof import("@workspace/db");
let loadedDbModule: DbModule | null = null;

function cleanEnvValue(value: string) {
  const trimmed = value.trim();
  return /^(['"]).*\1$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

function getRepoRoot() {
  return process.env.INIT_CWD ?? process.cwd();
}

function resolveFromRepoRoot(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(getRepoRoot(), value);
}

async function loadEnvLocal() {
  try {
    const raw = await readFile(path.resolve(getRepoRoot(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const entry = line.trim().replace(/^export\s+/, "");
      if (!entry || entry.startsWith("#") || !entry.includes("=")) continue;
      const [key, ...rest] = entry.split("=");
      if (key && process.env[key] === undefined) process.env[key] = cleanEnvValue(rest.join("="));
    }
  } catch {
    return;
  }
}

function shellEscape(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function clerkMetadata(persona: RoleMatrixPersona) {
  return {
    role: persona.role,
    gymId: persona.gymId,
    fitnessHubQa: true,
    fitnessHubQaPersona: persona.key,
    fitnessHubQaStatus: persona.status,
  };
}

async function upsertClerkUser(
  clerk: ReturnType<typeof createClerkClient>,
  persona: RoleMatrixPersona,
) {
  const existing = await clerk.users.getUserList({ emailAddress: [persona.email], limit: 1 });
  const payload = {
    firstName: persona.firstName,
    lastName: persona.lastName,
    password: persona.password,
    publicMetadata: clerkMetadata(persona),
    privateMetadata: { fitnessHubQa: true, fitnessHubQaPersona: persona.key },
    skipPasswordChecks: true,
    skipLegalChecks: true,
  };

  return existing.data[0]
    ? clerk.users.updateUser(existing.data[0].id, payload)
    : clerk.users.createUser({ ...payload, emailAddress: [persona.email] });
}

async function upsertDbAccess(dbModule: DbModule, persona: RoleMatrixPersona, clerkId: string) {
  const { db, userAccessControls, userProfiles } = dbModule;
  const role = persona.role === "owner" ? "member" : persona.role;
  const note = `Codex disposable Clerk role-matrix persona: ${persona.label}`;

  await db
    .insert(userAccessControls)
    .values({
      email: persona.email,
      gymId: persona.gymId,
      role,
      status: persona.status,
      note,
      createdByClerkId: clerkId,
    })
    .onConflictDoUpdate({
      target: [userAccessControls.gymId, userAccessControls.email],
      set: { role, status: persona.status, note, createdByClerkId: clerkId, updatedAt: new Date() },
    });

  await db
    .insert(userProfiles)
    .values({ clerkId, gymId: persona.gymId, name: persona.label, role: persona.role })
    .onConflictDoUpdate({
      target: userProfiles.clerkId,
      set: {
        gymId: persona.gymId,
        name: persona.label,
        role: persona.role,
        updatedAt: new Date(),
      },
    });
}

async function createStateForPersona(
  dbModule: DbModule,
  clerk: ReturnType<typeof createClerkClient>,
  persona: RoleMatrixPersona,
): Promise<RoleMatrixPersonaState> {
  const user = await upsertClerkUser(clerk, persona);
  await upsertDbAccess(dbModule, persona, user.id);

  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const signInToken = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 30 * 60,
  });

  return {
    ...summarizePersona(persona),
    firstName: persona.firstName,
    lastName: persona.lastName,
    userId: user.id,
    sessionId: session.id,
    apiToken: token.jwt,
    signInToken: signInToken.token,
    signInUrl: signInToken.url,
  };
}

async function main() {
  await loadEnvLocal();
  assertSafeClerkMutationEnv({
    allowLiveMutation: process.env.FITNESS_HUB_ALLOW_LIVE_CLERK_MUTATION === "1",
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  const statePath = resolveFromRepoRoot(
    process.env.FITNESS_HUB_CLERK_ROLE_MATRIX_STATE ?? DEFAULT_ROLE_MATRIX_STATE_PATH,
  );
  const envPath = resolveFromRepoRoot(
    process.env.FITNESS_HUB_CLERK_ROLE_MATRIX_ENV ?? DEFAULT_ROLE_MATRIX_ENV_PATH,
  );
  const gymId = process.env.FITNESS_HUB_CLERK_QA_GYM_ID ?? DEFAULT_ROLE_MATRIX_GYM_ID;
  const runId = normalizeRoleMatrixRunId(process.env.FITNESS_HUB_CLERK_ROLE_MATRIX_RUN_ID);
  const emailDomain = normalizeRoleMatrixEmailDomain(
    process.env.FITNESS_HUB_CLERK_QA_EMAIL_DOMAIN ?? DEFAULT_ROLE_MATRIX_EMAIL_DOMAIN,
  );
  const password = process.env.FITNESS_HUB_CLERK_QA_PASSWORD ?? generateRoleMatrixPassword();
  const personas = buildRoleMatrixPersonas({ emailDomain, gymId, password, runId });
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const dbModule = await import("@workspace/db");
  loadedDbModule = dbModule;
  const personaStates = {} as Record<RoleMatrixPersonaKey, RoleMatrixPersonaState>;

  for (const persona of personas) {
    personaStates[persona.key] = await createStateForPersona(dbModule, clerk, persona);
  }

  const ownerEmail = personaStates.owner.email;
  const adminEnv = {
    ADMIN_ALLOWED_EMAILS: mergeAdminAllowedEmails(process.env.ADMIN_ALLOWED_EMAILS, ownerEmail),
    ADMIN_GYM_OWNER_EMAILS: mergeAdminGymOwnerEmails({
      existing: process.env.ADMIN_GYM_OWNER_EMAILS,
      gymId,
      ownerEmail,
    }),
  };
  const state = {
    stateVersion: ROLE_MATRIX_STATE_VERSION,
    generatedAt: new Date().toISOString(),
    gymId,
    runId,
    emailDomain,
    statePath,
    password,
    adminEnv,
    personas: personaStates,
  };

  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(envPath), { recursive: true });
  await writeFile(
    envPath,
    [
      `FITNESS_HUB_CLERK_ROLE_MATRIX_STATE=${shellEscape(statePath)}`,
      `ADMIN_ALLOWED_EMAILS=${shellEscape(adminEnv.ADMIN_ALLOWED_EMAILS)}`,
      `ADMIN_GYM_OWNER_EMAILS=${shellEscape(adminEnv.ADMIN_GYM_OWNER_EMAILS)}`,
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(`Clerk role-matrix harness prepared: ${statePath}`);
  console.log(personas.map((persona) => `${persona.key}:${persona.status}`).join(", "));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await loadedDbModule?.pool.end().catch(() => undefined);
  });
