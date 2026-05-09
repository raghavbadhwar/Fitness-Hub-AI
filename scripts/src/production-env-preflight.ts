export interface EnvCheck {
  key: string;
  ok: boolean;
  details: string;
}

export interface ProductionEnvPreflightResult {
  ok: boolean;
  production: boolean;
  checks: EnvCheck[];
}

const REQUIRED_PRODUCTION_KEYS = [
  "CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "ADMIN_ALLOWED_EMAILS",
  "DATABASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
] as const;

type RequiredProductionKey = (typeof REQUIRED_PRODUCTION_KEYS)[number];

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isPlaceholder(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return (
    trimmed.includes("xxxxxxxx") ||
    trimmed.includes("change_me") ||
    trimmed.includes("<project-ref>") ||
    trimmed.endsWith("@example.com") ||
    trimmed.includes("owner@example.com")
  );
}

function checkRequiredValue(env: NodeJS.ProcessEnv, key: RequiredProductionKey): EnvCheck {
  const value = env[key];
  if (isBlank(value)) {
    return { key, ok: false, details: `${key} is missing.` };
  }

  if (isPlaceholder(value)) {
    return { key, ok: false, details: `${key} still looks like a placeholder.` };
  }

  return { key, ok: true, details: `${key} is set.` };
}

function checkClerkLiveKeys(env: NodeJS.ProcessEnv): EnvCheck[] {
  const publishable = env.CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const secret = env.CLERK_SECRET_KEY?.trim() ?? "";

  return [
    {
      key: "CLERK_PUBLISHABLE_KEY",
      ok: publishable.startsWith("pk_live_"),
      details: publishable.startsWith("pk_live_")
        ? "CLERK_PUBLISHABLE_KEY uses a Clerk live key."
        : "CLERK_PUBLISHABLE_KEY must start with pk_live_ for production.",
    },
    {
      key: "CLERK_SECRET_KEY",
      ok: secret.startsWith("sk_live_"),
      details: secret.startsWith("sk_live_")
        ? "CLERK_SECRET_KEY uses a Clerk live secret."
        : "CLERK_SECRET_KEY must start with sk_live_ for production.",
    },
  ];
}

export function isProductionDeployEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1" && env.VERCEL_ENV === "production";
}

export function evaluateProductionEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: { strict?: boolean } = {},
): ProductionEnvPreflightResult {
  const production = options.strict === true || isProductionDeployEnv(env);
  if (!production) {
    return {
      ok: true,
      production: false,
      checks: [
        {
          key: "VERCEL_ENV",
          ok: true,
          details: "Production env preflight skipped outside Vercel production.",
        },
      ],
    };
  }

  const checks = [
    ...REQUIRED_PRODUCTION_KEYS.map((key) => checkRequiredValue(env, key)),
    ...checkClerkLiveKeys(env),
  ];

  return {
    ok: checks.every((check) => check.ok),
    production: true,
    checks,
  };
}

function main() {
  const strict = process.argv.includes("--strict");
  const result = evaluateProductionEnv(process.env, { strict });

  for (const check of result.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.details}`);
  }

  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
