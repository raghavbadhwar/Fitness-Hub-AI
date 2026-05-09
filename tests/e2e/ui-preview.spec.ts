import { expect, test } from "@playwright/test";

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4173/admin/";
const MEMBER_BASE_URL = process.env.MEMBER_BASE_URL ?? "http://127.0.0.1:3100/";

test("admin access-denied preview can return the user to sign-in", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/access-denied`);

  await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
  await expect(
    page.getByText("Only owner-approved accounts can open the GymOS Admin Panel."),
  ).toBeVisible();

  await page.getByTestId("admin-access-denied-sign-in").click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Admin Operations Hub")).toBeVisible();
});

test("admin loading preview uses accessible branded progress copy", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/loading`);

  await expect(page.getByTestId("admin-loading-state")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Preparing admin workspace");
  await expect(page.getByText("Loading...")).toHaveCount(0);
});

test("admin access-denied preview switch-account action also routes to sign-in", async ({
  page,
}) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/access-denied`);

  await page.getByTestId("admin-access-denied-switch-account").click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Admin Operations Hub")).toBeVisible();
});

test("admin members preview includes the real member timeline panel", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/members`);

  await expect(page.getByText("Member timeline")).toBeVisible();
  await expect(page.getByText("Latest AI context")).toBeVisible();
});

test("admin dashboard preview surfaces owner action queue from live data", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/dashboard`);

  await expect(page.getByTestId("dashboard-action-queue")).toBeVisible();
  await expect(page.getByText("Approve waiting members")).toBeVisible();
  await expect(page.getByText("Open waitlist follow-up")).toBeVisible();
});

test("admin members preview confirms bulk approval before syncing", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/members`);

  await expect(page.getByTestId("member-access-pending-queue")).toContainText("1 waiting member");
  await page.getByTestId("button-bulk-approve-members").click();
  await expect(page.getByText("Allow all waiting members?")).toBeVisible();
  await page.getByTestId("button-confirm-bulk-approve-members").click();

  await expect(page.getByTestId("member-access-queue-clear")).toBeVisible();
  await expect(page.getByTestId("member-access-queue-clear")).toContainText("Access queue clear");
});

test("admin classes preview opens the check-in sheet without auth fetch noise", async ({
  page,
}) => {
  const failedResponses: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`${ADMIN_BASE_URL}__e2e/classes`);
  await expect(page.getByText("Checked in")).toBeVisible();
  await expect(page.getByText("Front-desk attendance")).toBeVisible();
  await expect(page.getByText("Projected check-ins")).toHaveCount(0);
  await expect(page.getByText("Estimated arrivals")).toHaveCount(0);
  await page.getByTestId("enrollments-class-1").click();

  await expect(page.getByText("Class Check-in")).toBeVisible();
  await expect(page.getByTestId("enrollment-member-member-1")).toBeVisible();
  expect(failedResponses.filter((entry) => entry.includes("/api/admin"))).toEqual([]);
});

test("admin classes preview exposes empty and sync-error states", async ({ page }) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/classes?state=empty`);
  await expect(page.getByTestId("classes-empty-state")).toBeVisible();

  await page.goto(`${ADMIN_BASE_URL}__e2e/classes?state=error`);
  await expect(page.getByTestId("classes-error-state")).toBeVisible();
  await expect(page.getByText("Class schedule did not sync")).toBeVisible();
});

test("member schedule preview shows the loading state banner", async ({ page }) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule?state=loading`);

  await expect(page.getByTestId("schedule-loading-state")).toBeVisible();
  await expect(page.getByText("Refreshing classes...")).toBeVisible();
  await expect(page.getByTestId("schedule-enroll-button-preview-open")).toContainText("Enroll Now");
});

test("member schedule preview shows the booking error and full class state", async ({ page }) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule?state=error`);

  await expect(page.getByTestId("schedule-booking-error")).toBeVisible();
  await expect(
    page.getByText("This class is already full. Please pick another slot."),
  ).toBeVisible();
  await expect(page.getByTestId("schedule-enroll-button-preview-full")).toContainText(
    "Join Waitlist",
  );
});

test("member home preview routes first workout CTA into the preview workout screen", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/home`);

  await page.getByText("Log first workout").click();

  await expect(page).toHaveURL(/\/__e2e\/workout/);
  await expect(page.getByText("Training Floor")).toBeVisible();
  await expect(page.getByText("Welcome back")).toHaveCount(0);
});

test("member workout preview scrolls the training header with the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${MEMBER_BASE_URL}__e2e/workout`);

  const title = page.getByText("Training Floor");
  await expect(title).toBeVisible();

  await page.mouse.wheel(0, 900);

  await expect(title).not.toBeInViewport();
});
