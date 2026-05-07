import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

type PlatformOs = "android" | "ios" | "web";

const ORIGINAL_API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const ORIGINAL_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

function restoreProcessEnv(
  key: "EXPO_PUBLIC_API_BASE_URL" | "EXPO_PUBLIC_DOMAIN",
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function clearConfiguredEnv() {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  delete process.env.EXPO_PUBLIC_DOMAIN;
}

function setWindowLocation(protocol: string, hostname: string, port = "") {
  const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  (
    globalThis as { window?: { location: { protocol: string; hostname: string; origin: string } } }
  ).window = {
    location: { protocol, hostname, origin },
  };
}

async function loadGetApiBase(platformOs: PlatformOs) {
  mock.module("react-native", {
    namedExports: {
      Platform: { OS: platformOs },
    },
  });

  const moduleUrl = new URL(
    `./api-base.ts?platform=${platformOs}&nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  const imported = (await import(moduleUrl.href)) as { getApiBase: () => string };
  return imported.getApiBase;
}

afterEach(() => {
  restoreProcessEnv("EXPO_PUBLIC_API_BASE_URL", ORIGINAL_API_BASE);
  restoreProcessEnv("EXPO_PUBLIC_DOMAIN", ORIGINAL_DOMAIN);

  if (ORIGINAL_WINDOW === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = ORIGINAL_WINDOW;
  }

  mock.reset();
});

test("uses EXPO_PUBLIC_API_BASE_URL when it already has https", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.com///";
  process.env.EXPO_PUBLIC_DOMAIN = "domain.example.com";

  const getApiBase = await loadGetApiBase("ios");
  assert.equal(getApiBase(), "https://api.example.com");
});

test("uses EXPO_PUBLIC_API_BASE_URL when it already has http", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:4000/";
  process.env.EXPO_PUBLIC_DOMAIN = "domain.example.com";

  const getApiBase = await loadGetApiBase("android");
  assert.equal(getApiBase(), "http://localhost:4000");
});

test("throws for scheme-less EXPO_PUBLIC_API_BASE_URL", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "localhost:4000";

  const getApiBase = await loadGetApiBase("ios");
  assert.throws(
    () => getApiBase(),
    /EXPO_PUBLIC_API_BASE_URL must include an explicit protocol \(http:\/\/ or https:\/\/\)/,
  );
});

test("trims whitespace around EXPO_PUBLIC_API_BASE_URL", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "   https://api.example.com/v1/   ";

  const getApiBase = await loadGetApiBase("ios");
  assert.equal(getApiBase(), "https://api.example.com/v1");
});

test("ignores blank EXPO_PUBLIC_API_BASE_URL and falls back to EXPO_PUBLIC_DOMAIN", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "   ";
  process.env.EXPO_PUBLIC_DOMAIN = "https://domain.example.com/";

  const getApiBase = await loadGetApiBase("android");
  assert.equal(getApiBase(), "https://domain.example.com");
});

test("uses EXPO_PUBLIC_DOMAIN with existing https scheme", async () => {
  process.env.EXPO_PUBLIC_DOMAIN = "https://domain.example.com///";

  const getApiBase = await loadGetApiBase("ios");
  assert.equal(getApiBase(), "https://domain.example.com");
});

test("throws for scheme-less EXPO_PUBLIC_DOMAIN", async () => {
  process.env.EXPO_PUBLIC_DOMAIN = "domain.example.com";

  const getApiBase = await loadGetApiBase("android");
  assert.throws(
    () => getApiBase(),
    /EXPO_PUBLIC_DOMAIN must include an explicit protocol \(http:\/\/ or https:\/\/\)/,
  );
});

test("EXPO_PUBLIC_API_BASE_URL takes precedence over EXPO_PUBLIC_DOMAIN", async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = "https://primary.example.com";
  process.env.EXPO_PUBLIC_DOMAIN = "https://fallback.example.com";

  const getApiBase = await loadGetApiBase("ios");
  assert.equal(getApiBase(), "https://primary.example.com");
});

test("uses same-origin web fallback on deployed hosts", async () => {
  clearConfiguredEnv();
  setWindowLocation("https:", "fit.example.com");

  const getApiBase = await loadGetApiBase("web");
  assert.equal(getApiBase(), "https://fit.example.com");
});

test("web fallback uses hostname and fixed :4000 port", async () => {
  clearConfiguredEnv();
  setWindowLocation("http:", "localhost");

  const getApiBase = await loadGetApiBase("web");
  assert.equal(getApiBase(), "http://localhost:4000");
});

test("local web fallback preserves the browser protocol", async () => {
  clearConfiguredEnv();
  setWindowLocation("https:", "127.0.0.1");

  const getApiBase = await loadGetApiBase("web");
  assert.equal(getApiBase(), "https://127.0.0.1:4000");
});

test("returns empty string when running on web without window", async () => {
  clearConfiguredEnv();
  delete (globalThis as { window?: unknown }).window;

  const getApiBase = await loadGetApiBase("web");
  assert.equal(getApiBase(), "");
});

test("returns empty string on native when env variables are missing", async () => {
  clearConfiguredEnv();

  const getApiBase = await loadGetApiBase("android");
  assert.equal(getApiBase(), "");
});

test("ignores blank EXPO_PUBLIC_DOMAIN on native and returns empty string", async () => {
  clearConfiguredEnv();
  process.env.EXPO_PUBLIC_DOMAIN = "   ";

  const getApiBase = await loadGetApiBase("ios");
  assert.equal(getApiBase(), "");
});
