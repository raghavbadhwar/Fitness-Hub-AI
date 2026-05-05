export interface NodeVersionCheck {
  ok: boolean;
  actualMajor: number | null;
  requiredMajor: number;
  message: string;
}

export function parseNodeMajor(version: string): number | null {
  const normalized = version.trim().replace(/^v/, "");
  const [major] = normalized.split(".");
  const parsed = Number.parseInt(major ?? "", 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function evaluateNodeVersion(
  version = process.versions.node,
  requiredMajor = 22,
): NodeVersionCheck {
  const actualMajor = parseNodeMajor(version);

  if (actualMajor === requiredMajor) {
    return {
      ok: true,
      actualMajor,
      requiredMajor,
      message: `PASS Node ${version} satisfies required runtime ${requiredMajor}.x.`,
    };
  }

  return {
    ok: false,
    actualMajor,
    requiredMajor,
    message:
      `FAIL Fitness Hub AI requires Node ${requiredMajor}.x for release gates. ` +
      `Current runtime is ${version}. Run with mise, nvm, or your shell manager set to Node ${requiredMajor}.`,
  };
}

function main() {
  const result = evaluateNodeVersion();
  console.log(result.message);

  if (!result.ok) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
