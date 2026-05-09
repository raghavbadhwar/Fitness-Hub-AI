import { defineConfig } from "@playwright/test";

const reuseExistingServer = !process.env.CI;
const includeMemberWebServer = process.env.PLAYWRIGHT_INCLUDE_MEMBER_WEB !== "0";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      name: "api-server",
      command: "pnpm run dev:api",
      url: "http://127.0.0.1:4000/api/healthz",
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    },
    {
      name: "admin-ui",
      command: "pnpm run dev:admin",
      url: "http://127.0.0.1:4173/admin/sign-in",
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    },
    ...(includeMemberWebServer
      ? [
          {
            name: "member-web",
            command: "pnpm run dev:member:web",
            url: "http://127.0.0.1:3100/",
            reuseExistingServer,
            stdout: "pipe" as const,
            stderr: "pipe" as const,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
