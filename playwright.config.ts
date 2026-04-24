import { defineConfig } from "@playwright/test";

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    headless: true,
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
    {
      name: "member-web",
      command: "pnpm run dev:member:web",
      url: "http://127.0.0.1:3100/",
      reuseExistingServer,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180_000,
    },
  ],
});
