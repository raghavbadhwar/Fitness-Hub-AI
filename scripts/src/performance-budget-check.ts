import { readdir, stat, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface BudgetResult {
  ok: boolean;
  messages: string[];
}

const DEFAULT_BUDGETS = {
  adminTotalBytes: 1_400_000,
  adminLargestJsBytes: 500_000,
  apiEntryBytes: 4_800_000,
};

async function fileSize(filePath: string) {
  return (await stat(filePath)).size;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

export async function evaluatePerformanceBudgets(
  repoRoot: string,
  budgets = DEFAULT_BUDGETS,
): Promise<BudgetResult> {
  const messages: string[] = [];
  const adminDir = path.join(repoRoot, "artifacts/admin/dist/public/assets");
  const apiEntry = path.join(repoRoot, "artifacts/api-server/dist/index.mjs");

  const adminFiles = await listFiles(adminDir);
  const adminSizes = await Promise.all(adminFiles.map(async (file) => [file, await fileSize(file)] as const));
  const adminTotal = adminSizes.reduce((sum, [, size]) => sum + size, 0);
  const adminLargestJs = Math.max(
    0,
    ...adminSizes.filter(([file]) => file.endsWith(".js")).map(([, size]) => size),
  );
  const apiEntrySize = await fileSize(apiEntry);

  messages.push(`admin total assets: ${adminTotal} bytes / ${budgets.adminTotalBytes}`);
  messages.push(`admin largest js: ${adminLargestJs} bytes / ${budgets.adminLargestJsBytes}`);
  messages.push(`api entry bundle: ${apiEntrySize} bytes / ${budgets.apiEntryBytes}`);

  const ok =
    adminTotal <= budgets.adminTotalBytes &&
    adminLargestJs <= budgets.adminLargestJsBytes &&
    apiEntrySize <= budgets.apiEntryBytes;

  return { ok, messages };
}

export async function createBudgetFixture(files: Record<string, string>) {
  const root = path.join(os.tmpdir(), `fitness-budget-${Date.now()}`);
  await mkdir(root, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  return {
    root,
    async cleanup() {
      await rm(root, { force: true, recursive: true });
    },
  };
}

async function main() {
  const repoRoot =
    path.basename(process.cwd()) === "scripts" ? path.resolve("..") : process.cwd();
  const result = await evaluatePerformanceBudgets(repoRoot);
  for (const message of result.messages) {
    console.log(message);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
