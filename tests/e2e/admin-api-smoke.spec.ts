import { expect, test } from "@playwright/test";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4173/admin/";

test("api health endpoint returns ok", async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/api/healthz`);
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("admin sign-in page loads", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}sign-in`);
  await expect(page).toHaveTitle(/GymOS|Vite/i);
  await expect(page.getByText("Admin Operations Hub", { exact: false })).toBeVisible();
});
