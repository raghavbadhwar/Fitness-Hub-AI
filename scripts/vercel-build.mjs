import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const staticOutput = path.join(root, "dist", "vercel-static");
const memberOutput = path.join(root, "dist", "member-web");
const clerkPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY || "";
const isProductionDeploy = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

function assertProductionClerkKeys() {
  if (!isProductionDeploy) {
    return;
  }

  const missingKeys = [];
  if (!clerkPublishableKey) missingKeys.push("CLERK_PUBLISHABLE_KEY");
  if (!clerkSecretKey) missingKeys.push("CLERK_SECRET_KEY");

  if (missingKeys.length > 0) {
    throw new Error(
      `Vercel production deploy is missing required Clerk env vars: ${missingKeys.join(", ")}.`,
    );
  }

  if (!clerkPublishableKey.startsWith("pk_live_") || !clerkSecretKey.startsWith("sk_live_")) {
    throw new Error(
      "Vercel production deploy requires Clerk live keys. Use pk_live_ and sk_live_ from the same Clerk production instance.",
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...options.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDirectory(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

rmSync(staticOutput, { recursive: true, force: true });
rmSync(memberOutput, { recursive: true, force: true });
mkdirSync(staticOutput, { recursive: true });

assertProductionClerkKeys();

run("pnpm", ["--dir", "lib/api-spec", "codegen"]);
run("pnpm", ["--dir", "artifacts/api-server", "build"]);

run("pnpm", ["--dir", "artifacts/admin", "build"], {
  env: {
    PORT: process.env.PORT || "4173",
    BASE_PATH: "/admin/",
    VITE_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
    VITE_CLERK_PROXY_URL: process.env.VITE_CLERK_PROXY_URL || "/api/__clerk",
  },
});

run(
  "pnpm",
  [
    "--dir",
    "artifacts/gymapp",
    "exec",
    "expo",
    "export",
    "--platform",
    "web",
    "--output-dir",
    memberOutput,
    "--clear",
  ],
  {
    env: {
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
      EXPO_PUBLIC_CLERK_PROXY_URL: process.env.EXPO_PUBLIC_CLERK_PROXY_URL || "/api/__clerk",
    },
  },
);

copyDirectory(memberOutput, staticOutput);
copyDirectory(
  path.join(root, "artifacts", "admin", "dist", "public"),
  path.join(staticOutput, "admin"),
);

const appShell = path.join(staticOutput, "index.html");
if (existsSync(appShell)) {
  copyFileSync(appShell, path.join(staticOutput, "404.html"));
}

console.log(`Vercel static output prepared at ${path.relative(root, staticOutput)}`);
