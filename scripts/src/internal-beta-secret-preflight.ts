import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROTATION_SECRETS = [
  {
    key: "CLERK_SECRET_KEY",
    provider: "Clerk",
    reason: "Server-side authentication secret used by API and admin access checks.",
  },
  {
    key: "DATABASE_URL",
    provider: "Supabase Postgres",
    reason: "Application database connection string includes a live password.",
  },
  {
    key: "DATABASE_ADMIN_URL",
    provider: "Supabase Postgres",
    reason: "Admin database connection string includes a privileged password.",
  },
  {
    key: "DATABASE_APP_PASSWORD",
    provider: "Supabase Postgres",
    reason: "Dedicated runtime database password is explicitly stored in env.",
  },
  {
    key: "AI_INTEGRATIONS_GEMINI_API_KEY",
    provider: "Google Gemini",
    reason: "LLM integration key previously lived in the tracked local env file.",
  },
] as const;

const KNOWN_INCIDENT = "tracked-env-local" as const;

const TEMPLATE_KEYS = [
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "ADMIN_ALLOWED_EMAILS",
  "DATABASE_URL",
  "DATABASE_ADMIN_URL",
  "DATABASE_APP_PASSWORD",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
] as const;

export type RotationSecretKey = (typeof ROTATION_SECRETS)[number]["key"];
export type IncidentResolution = "rotate" | "accepted-risk";

export interface RotationStatus {
  incident: typeof KNOWN_INCIDENT;
  resolution: IncidentResolution;
  rotatedAt: string;
  acceptedAt: string;
  acceptedBy: string;
  secrets: Record<RotationSecretKey, boolean>;
  notes: string;
}

export interface PreflightCheck {
  name: string;
  ok: boolean;
  details: string;
}

export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
}

export interface PreflightSnapshot {
  exampleValues: Record<string, string>;
  envLocalTracked: boolean;
  knownIncidentActive: boolean;
  rotationStatus: RotationStatus | null;
}

export const rotationStatusPath = fileURLToPath(
  new URL("../../.local/state/secret-rotation-status.json", import.meta.url),
);

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const envExamplePath = path.join(repoRoot, ".env.example");

export function parseEnvFile(text: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

export function buildRotationTemplate(): RotationStatus {
  const secrets = Object.fromEntries(
    ROTATION_SECRETS.map(({ key }) => [key, false]),
  ) as Record<RotationSecretKey, boolean>;

  return {
    incident: KNOWN_INCIDENT,
    resolution: "rotate",
    rotatedAt: "",
    acceptedAt: "",
    acceptedBy: "",
    secrets,
    notes:
      "Set each secret to true after rotating it in the provider dashboard, updating local envs, and invalidating the old value. If you are explicitly accepting the residual risk for internal beta, record that with the accepted-risk command instead of marking secrets as rotated.",
  };
}

function isIsoTimestamp(value: string): boolean {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isPlaceholderValue(key: string, value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return true;
  }

  if (trimmed.includes("${")) {
    return true;
  }

  if (
    trimmed.includes("xxxxxxxx") ||
    trimmed.includes("change_me") ||
    trimmed.includes("<project-ref>")
  ) {
    return true;
  }

  if (/^pk_test_x+$/i.test(trimmed) || /^sk_test_x+$/i.test(trimmed)) {
    return true;
  }

  if (key === "ADMIN_ALLOWED_EMAILS") {
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .every((email) => email.endsWith("@example.com"));
  }

  if (key.endsWith("_URL")) {
    return /localhost|example|change_me|<project-ref>/.test(trimmed);
  }

  return false;
}

function isValidResolution(value: string | undefined): value is IncidentResolution {
  return value === "rotate" || value === "accepted-risk";
}

function buildAcceptedRiskStatus(
  currentStatus: RotationStatus | null,
  acceptedBy: string,
  acceptedAt: string,
): RotationStatus {
  const baseStatus = currentStatus ?? buildRotationTemplate();
  const defaultNotes =
    "Operator accepted the residual risk of the previously tracked .env.local secrets for internal beta use on this machine.";
  const existingNotes = baseStatus.notes.trim();

  return {
    ...baseStatus,
    incident: KNOWN_INCIDENT,
    resolution: "accepted-risk",
    rotatedAt: "",
    acceptedAt,
    acceptedBy,
    notes:
      !existingNotes ||
      existingNotes.startsWith("Set each secret to true after rotating it")
        ? defaultNotes
        : existingNotes,
  };
}

export function evaluatePreflight(snapshot: PreflightSnapshot): PreflightResult {
  const checks: PreflightCheck[] = [];

  checks.push({
    name: ".env.local is not tracked",
    ok: !snapshot.envLocalTracked,
    details: snapshot.envLocalTracked
      ? "git still reports .env.local as a tracked path."
      : "git no longer lists .env.local as a tracked file.",
  });

  const missingTemplateKeys = TEMPLATE_KEYS.filter(
    (key) => !(key in snapshot.exampleValues),
  );
  const unsanitizedTemplateKeys = TEMPLATE_KEYS.filter((key) => {
    const value = snapshot.exampleValues[key];
    return value !== undefined && !isPlaceholderValue(key, value);
  });

  checks.push({
    name: ".env.example stays sanitized",
    ok: missingTemplateKeys.length === 0 && unsanitizedTemplateKeys.length === 0,
    details:
      missingTemplateKeys.length === 0 && unsanitizedTemplateKeys.length === 0
        ? "Committed env template contains the expected placeholder values."
        : [
            missingTemplateKeys.length > 0
              ? `missing keys: ${missingTemplateKeys.join(", ")}`
              : "",
            unsanitizedTemplateKeys.length > 0
              ? `non-placeholder values: ${unsanitizedTemplateKeys.join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("; "),
  });

  const status = snapshot.rotationStatus;
  const missingStatus = !status;
  const invalidResolution = status
    ? status.resolution !== undefined && !isValidResolution(status.resolution)
    : false;
  const resolution = status?.resolution ?? "rotate";
  const incompleteSecrets = status
    ? ROTATION_SECRETS.filter(({ key }) => !status.secrets[key]).map(({ key }) => key)
    : ROTATION_SECRETS.map(({ key }) => key);
  const invalidTimestamp = status ? !isIsoTimestamp(status.rotatedAt) : true;
  const invalidAcceptedTimestamp = status ? !isIsoTimestamp(status.acceptedAt) : true;
  const acceptedBy = status?.acceptedBy.trim() ?? "";
  const missingAcceptedBy = acceptedBy.length === 0;
  const missingAcceptedNotes = status ? status.notes.trim().length === 0 : true;
  const incidentMatches = status ? status.incident === KNOWN_INCIDENT : false;
  const acceptedRiskComplete =
    !missingStatus &&
    !invalidResolution &&
    resolution === "accepted-risk" &&
    !invalidAcceptedTimestamp &&
    !missingAcceptedBy &&
    !missingAcceptedNotes;
  const rotationComplete =
    !missingStatus &&
    !invalidResolution &&
    resolution === "rotate" &&
    !invalidTimestamp &&
    incompleteSecrets.length === 0;

  checks.push({
    name: "Secret rotation incident is attested locally",
    ok:
      !snapshot.knownIncidentActive ||
      (!missingStatus && incidentMatches && (rotationComplete || acceptedRiskComplete)),
    details: !snapshot.knownIncidentActive
      ? "No repo-level secret incident is currently active."
      : missingStatus
        ? `missing ${path.relative(repoRoot, rotationStatusPath)}`
        : !incidentMatches
          ? `incident must be ${KNOWN_INCIDENT}`
          : invalidResolution
            ? "resolution must be either rotate or accepted-risk"
            : resolution === "accepted-risk"
              ? [
                  invalidAcceptedTimestamp ? "acceptedAt must be an ISO timestamp" : "",
                  missingAcceptedBy ? "acceptedBy must identify the local operator" : "",
                  missingAcceptedNotes ? "notes must explain the accepted-risk decision" : "",
                ]
                  .filter(Boolean)
                  .join("; ") ||
                `Accepted-risk resolution recorded locally by ${acceptedBy} at ${status.acceptedAt}.`
              : [
                  invalidTimestamp ? "rotatedAt must be an ISO timestamp" : "",
                  incompleteSecrets.length > 0
                    ? `pending secret rotations: ${incompleteSecrets.join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("; ") || "All rotated secrets are attested with a timestamp.",
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function loadRotationStatus(filePath: string): Promise<RotationStatus | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as RotationStatus;
}

async function writeRotationStatus(filePath: string, status: RotationStatus): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(`${filePath}`, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

async function writeRotationTemplate(filePath: string): Promise<void> {
  await writeRotationStatus(filePath, buildRotationTemplate());
}

function gitOutput(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

async function loadSnapshot(): Promise<PreflightSnapshot> {
  const envExample = parseEnvFile(await readFile(envExamplePath, "utf8"));
  const trackedPaths = gitOutput(["ls-files", ".env.local"]);

  return {
    exampleValues: envExample,
    envLocalTracked: trackedPaths.length > 0,
    knownIncidentActive: true,
    rotationStatus: await loadRotationStatus(rotationStatusPath),
  };
}

function printResult(result: PreflightResult): void {
  console.log("Internal beta secret preflight");
  console.log(`Repository: ${repoRoot}`);
  console.log(`Attestation file: ${path.relative(repoRoot, rotationStatusPath)}`);
  console.log("");

  for (const check of result.checks) {
    const marker = check.ok ? "PASS" : "FAIL";
    console.log(`${marker} ${check.name}`);
    console.log(`  ${check.details}`);
  }

  if (!result.ok) {
    console.log("");
    console.log("Next actions:");
    console.log(`- Run pnpm run preflight:beta-secrets:init if the attestation file does not exist yet.`);
    console.log("- Rotate every listed provider secret, update your local env, then mark the attestation file.");
    console.log("- Or record an explicit local accepted-risk decision with pnpm run preflight:beta-secrets:accept-risk.");
    console.log("- Re-run pnpm run preflight:beta-secrets before internal beta verification.");
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has("--init")) {
    await writeRotationTemplate(rotationStatusPath);
    console.log(`Wrote ${path.relative(repoRoot, rotationStatusPath)}`);
    console.log("Fill in rotatedAt and flip each secret to true after provider-side rotation is complete.");
    console.log("If you are deliberately carrying the residual risk for internal beta, run the accepted-risk command instead.");
    return;
  }

  if (args.has("--accept-risk")) {
    const currentStatus = await loadRotationStatus(rotationStatusPath);
    const acceptedRiskStatus = buildAcceptedRiskStatus(
      currentStatus,
      process.env.USER?.trim() || "local-operator",
      new Date().toISOString(),
    );

    await writeRotationStatus(rotationStatusPath, acceptedRiskStatus);
    console.log(`Recorded accepted-risk resolution in ${path.relative(repoRoot, rotationStatusPath)}`);
    console.log("This is a local-only acknowledgment. It does not rotate provider secrets.");
    return;
  }

  const result = evaluatePreflight(await loadSnapshot());
  printResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

const currentEntry = process.argv[1] ? path.resolve(process.argv[1]) : "";
const thisFile = fileURLToPath(import.meta.url);

if (currentEntry === thisFile) {
  await main();
}
