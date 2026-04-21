import { expect, test } from "@playwright/test";

const MEMBER_BASE_URL = process.env.MEMBER_BASE_URL ?? "http://127.0.0.1:3100/";

test("member visitors are redirected to sign-in before entering the app", async ({ page }) => {
  await page.goto(MEMBER_BASE_URL);

  await expect(page).toHaveURL(/\/sign-in\/?$/);
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Sign in to continue your fitness journey")).toBeVisible();
});

test("approved member schedule preview opens cleanly and can enroll in a class", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule`);

  await expect(page.getByText("Schedule")).toBeVisible();
  await expect(page.getByTestId("schedule-enroll-button-preview-open")).toContainText("Enroll Now");

  await page.getByTestId("schedule-enroll-button-preview-open").click();

  await expect(page.getByTestId("schedule-enroll-button-preview-open")).toContainText("Enrolled");
  await expect(page.getByTestId("schedule-mini-class-preview-open")).toBeVisible();
});
