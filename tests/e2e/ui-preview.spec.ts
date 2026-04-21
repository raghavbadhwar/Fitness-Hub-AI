import { expect, test } from "@playwright/test";

const ADMIN_BASE_URL =
  process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:4173/admin/";
const MEMBER_BASE_URL = process.env.MEMBER_BASE_URL ?? "http://127.0.0.1:3100/";

test("admin access-denied preview can return the user to sign-in", async ({
  page,
}) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/access-denied`);

  await expect(
    page.getByRole("heading", { name: "Access Denied" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Only owner-approved accounts can open the GymOS Admin Panel.",
    ),
  ).toBeVisible();

  await page.getByTestId("admin-access-denied-sign-in").click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Admin Operations Hub")).toBeVisible();
});

test("admin access-denied preview switch-account action also routes to sign-in", async ({
  page,
}) => {
  await page.goto(`${ADMIN_BASE_URL}__e2e/access-denied`);

  await page.getByTestId("admin-access-denied-switch-account").click();

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText("Admin Operations Hub")).toBeVisible();
});

test("member schedule preview shows the loading state banner", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule?state=loading`);

  await expect(page.getByTestId("schedule-loading-state")).toBeVisible();
  await expect(page.getByText("Refreshing classes...")).toBeVisible();
  await expect(
    page.getByTestId("schedule-enroll-button-preview-open"),
  ).toContainText("Enroll Now");
});

test("member schedule preview shows the booking error and full class state", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule?state=error`);

  await expect(page.getByTestId("schedule-booking-error")).toBeVisible();
  await expect(
    page.getByText("This class is already full. Please pick another slot."),
  ).toBeVisible();
  await expect(
    page.getByTestId("schedule-enroll-button-preview-full"),
  ).toContainText("Class Full");
});
