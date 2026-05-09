import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4173/admin/";
const MEMBER_BASE_URL = process.env.MEMBER_BASE_URL ?? "http://127.0.0.1:3100/";

type PersonaKey = "owner" | "trainer" | "member" | "pendingMember" | "revokedMember";

type PersonaState = {
  email: string;
  role: "owner" | "trainer" | "member";
  status: "approved" | "pending" | "revoked";
  apiToken: string;
  signInToken: string;
};

type RoleMatrixState = {
  personas: Record<PersonaKey, PersonaState>;
};

let matrix: RoleMatrixState;

test.beforeAll(async () => {
  const statePath = process.env.FITNESS_HUB_CLERK_ROLE_MATRIX_STATE;
  test.skip(!statePath, "FITNESS_HUB_CLERK_ROLE_MATRIX_STATE is required");
  matrix = JSON.parse(await readFile(statePath!, "utf8")) as RoleMatrixState;
});

function authHeaders(persona: PersonaState) {
  return { Authorization: `Bearer ${persona.apiToken}` };
}

test("API enforces owner, trainer, approved, pending, and revoked role boundaries", async ({
  request,
}) => {
  const { owner, trainer, member, pendingMember, revokedMember } = matrix.personas;

  const ownerAdmin = await request.get(`${API_BASE_URL}/api/admin/access`, {
    headers: authHeaders(owner),
  });
  await expect(ownerAdmin).toBeOK();
  await expect(ownerAdmin.json()).resolves.toMatchObject({
    ok: true,
    email: owner.email,
    role: "owner",
  });

  for (const persona of [trainer, member, pendingMember, revokedMember]) {
    const response = await request.get(`${API_BASE_URL}/api/admin/access`, {
      headers: authHeaders(persona),
    });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Forbidden: email is not approved for admin access",
    });
  }

  const approvedMember = await request.get(`${API_BASE_URL}/api/profiles/access-check`, {
    headers: authHeaders(member),
  });
  await expect(approvedMember).toBeOK();
  await expect(approvedMember.json()).resolves.toMatchObject({
    status: "ready",
    email: member.email,
    role: "member",
  });

  const pending = await request.get(`${API_BASE_URL}/api/profiles/access-check`, {
    headers: authHeaders(pendingMember),
  });
  await expect(pending).toBeOK();
  await expect(pending.json()).resolves.toMatchObject({
    status: "pending_approval",
    email: pendingMember.email,
  });

  const revoked = await request.get(`${API_BASE_URL}/api/profiles/access-check`, {
    headers: authHeaders(revokedMember),
  });
  await expect(revoked).toBeOK();
  await expect(revoked.json()).resolves.toMatchObject({
    status: "revoked",
    email: revokedMember.email,
  });

  const memberTemplates = await request.get(`${API_BASE_URL}/api/workouts/templates`, {
    headers: authHeaders(member),
  });
  expect(memberTemplates.status()).toBe(403);

  const trainerTemplates = await request.get(`${API_BASE_URL}/api/workouts/templates`, {
    headers: authHeaders(trainer),
  });
  await expect(trainerTemplates).toBeOK();
});

test("member web accepts a Clerk ticket and reaches the approved member experience", async ({
  page,
}) => {
  const member = matrix.personas.member;

  await page.goto(`${MEMBER_BASE_URL}sign-in?__clerk_ticket=${member.signInToken}`);
  await expect(page.getByText("Signing you in")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(MEMBER_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(page.getByText(/today|schedule|workout|home/i).first()).toBeVisible({
    timeout: 30_000,
  });
});

test("admin web accepts a Clerk ticket only for the owner-approved account", async ({ page }) => {
  const owner = matrix.personas.owner;

  await page.goto(`${ADMIN_BASE_URL}sign-in?__clerk_ticket=${owner.signInToken}`);
  await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 30_000 });
  await expect(page.getByText(/GymOS|dashboard|operations/i).first()).toBeVisible();
});
