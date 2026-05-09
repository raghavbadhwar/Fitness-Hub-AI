import { expect, test } from "@playwright/test";

const MEMBER_BASE_URL = process.env.MEMBER_BASE_URL ?? "http://127.0.0.1:3100/";

test("member visitors are redirected to sign-in before entering the app", async ({ page }) => {
  await page.goto(MEMBER_BASE_URL);

  await expect(page).toHaveURL(/\/sign-in\/?$/);
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Sign in to continue your fitness journey")).toBeVisible();
});

test("member onboarding keeps partial input after a recoverable validation error", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/onboarding`);

  await page.getByTestId("onboarding-get-started").click();
  await expect(page.getByTestId("onboarding-height-input")).toBeVisible();
  await page.getByTestId("onboarding-height-input").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("180");
  await expect(page.getByTestId("onboarding-height-input")).toHaveValue("180");
  await page.getByTestId("onboarding-name-input").fill("");
  await expect(page.getByTestId("onboarding-name-input")).toHaveValue("");
  await page.getByTestId("onboarding-next").click();

  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByTestId("onboarding-height-input")).toHaveValue("180");
});

test("member approval preview explains pending, revoked, and expired-session states", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/approval-required?state=pending`);
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await expect(page.getByText("member@example.com")).toBeVisible();
  await expect(
    page.getByText(/does not reveal member, class, workout, or gym admin data/i),
  ).toBeVisible();

  await page.goto(`${MEMBER_BASE_URL}__e2e/approval-required?state=revoked`);
  await expect(page.getByText("This email is blocked")).toBeVisible();
  await expect(page.getByText("Your gym team has turned off member app access")).toBeVisible();

  await page.goto(`${MEMBER_BASE_URL}__e2e/approval-required?state=auth-expired`);
  await expect(page.getByText("Sign in again").first()).toBeVisible();
  await expect(page.getByText(/secure session expired/i)).toBeVisible();
  await expect(page.getByTestId("approval-required-primary")).toContainText("Sign in again");
});

test("approved member schedule preview opens cleanly and can enroll in a class", async ({
  page,
}) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/schedule`);

  await expect(page.getByText("Schedule")).toBeVisible();
  await expect(page.getByTestId("schedule-enroll-button-preview-open")).toContainText("Enroll Now");

  await page.getByTestId("schedule-enroll-button-preview-open").click();

  await expect(page.getByTestId("schedule-enroll-button-preview-open")).toContainText("Enrolled");
  await expect(page.getByTestId("schedule-enroll-button-preview-full")).toContainText(
    "Join Waitlist",
  );
  await page.getByTestId("schedule-enroll-button-preview-full").click();
  await expect(page.getByTestId("schedule-enroll-button-preview-full")).toContainText("Waitlisted");
  await expect(page.getByTestId("schedule-mini-class-preview-open")).toBeVisible();
});

test("trainer workout preview exposes the trainer workspace", async ({ page }) => {
  await page.goto(`${MEMBER_BASE_URL}__e2e/workout?role=trainer`);

  await expect(page.getByText("Trainer workspace")).toBeVisible();
  await expect(page.getByText("Templates", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Reviews", { exact: true }).first()).toBeVisible();
});
