import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const staticOutput = path.join(root, "dist", "vercel-static");
const memberOutput = path.join(root, "dist", "member-web");

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

run("pnpm", ["--dir", "lib/api-spec", "codegen"]);
run("pnpm", ["--dir", "artifacts/api-server", "build"]);

run("pnpm", ["--dir", "artifacts/admin", "build"], {
  env: {
    PORT: process.env.PORT || "4173",
    BASE_PATH: "/admin/",
    VITE_CLERK_PUBLISHABLE_KEY:
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "",
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
      EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "",
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
