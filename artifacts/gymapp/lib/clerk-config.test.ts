import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

type PlatformOs = "android" | "ios" | "web";

const ORIGINAL_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const ORIGINAL_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const ORIGINAL_PROXY_URL = process.env.EXPO_PUBLIC_CLERK_PROXY_URL;

function restoreProcessEnv(
  key: "EXPO_PUBLIC_API_BASE_URL" | "EXPO_PUBLIC_DOMAIN" | "EXPO_PUBLIC_CLERK_PROXY_URL",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

async function loadGetClerkProxyUrl(platformOs: PlatformOs) {
  mock.module("react-native", {
    namedExports: {
      Platform: { OS: platformOs },
    },
  });

  const moduleUrl = new URL(
    `./clerk-config.ts?platform=${platformOs}&nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  const imported = (await import(moduleUrl.href)) as { getClerkProxyUrl: () => string | undefined };
  return imported.getClerkProxyUrl;
}

afterEach(() => {
  restoreProcessEnv("EXPO_PUBLIC_API_BASE_URL", ORIGINAL_API_BASE);
  restoreProcessEnv("EXPO_PUBLIC_DOMAIN", ORIGINAL_DOMAIN);
  restoreProcessEnv("EXPO_PUBLIC_CLERK_PROXY_URL", ORIGINAL_PROXY_URL);
  mock.reset();
});

test("returns undefined when no Clerk proxy URL is configured", async () => {
  delete process.env.EXPO_PUBLIC_CLERK_PROXY_URL;

  const getClerkProxyUrl = await loadGetClerkProxyUrl("web");
  assert.equal(getClerkProxyUrl(), undefined);
});

test("keeps relative proxy paths on web", async () => {
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL = "/api/__clerk";

  const getClerkProxyUrl = await loadGetClerkProxyUrl("web");
  assert.equal(getClerkProxyUrl(), "/api/__clerk");
});

test("resolves relative proxy paths against the native API base URL", async () => {
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL = "/api/__clerk";
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://fitness.example.com/api";
  process.env.EXPO_PUBLIC_DOMAIN = "fallback.example.com";

  const getClerkProxyUrl = await loadGetClerkProxyUrl("ios");
  assert.equal(getClerkProxyUrl(), "https://fitness.example.com/api/__clerk");
});

test("falls back to EXPO_PUBLIC_DOMAIN for native relative proxy paths", async () => {
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL = "/api/__clerk";
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  process.env.EXPO_PUBLIC_DOMAIN = "fitness.example.com";

  const getClerkProxyUrl = await loadGetClerkProxyUrl("android");
  assert.equal(getClerkProxyUrl(), "https://fitness.example.com/api/__clerk");
});

test("keeps absolute proxy URLs on native", async () => {
  process.env.EXPO_PUBLIC_CLERK_PROXY_URL = "https://fitness.example.com/api/__clerk///";

  const getClerkProxyUrl = await loadGetClerkProxyUrl("android");
  assert.equal(getClerkProxyUrl(), "https://fitness.example.com/api/__clerk");
});
