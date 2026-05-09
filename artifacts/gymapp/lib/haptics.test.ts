import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

type PlatformOs = "android" | "ios" | "web";

interface HapticsTestGlobal {
  __FITNESS_HUB_HAPTICS_PROVIDER__?: {
    impactAsync: (style: string) => Promise<void>;
    notificationAsync: (type: string) => Promise<void>;
    selectionAsync: () => Promise<void>;
  };
}

async function loadHaptics(platformOs: PlatformOs, calls: string[]) {
  mock.module("react-native", {
    namedExports: {
      Platform: { OS: platformOs },
    },
  });

  (globalThis as HapticsTestGlobal).__FITNESS_HUB_HAPTICS_PROVIDER__ = {
    impactAsync: async (style: string) => {
      calls.push(`impact:${style}`);
    },
    notificationAsync: async (type: string) => {
      calls.push(`notify:${type}`);
    },
    selectionAsync: async () => {
      calls.push("selection");
    },
  };

  const moduleUrl = new URL(
    `./haptics.ts?platform=${platformOs}&nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  return (await import(moduleUrl.href)) as typeof import("./haptics.ts");
}

afterEach(() => {
  delete (globalThis as HapticsTestGlobal).__FITNESS_HUB_HAPTICS_PROVIDER__;
  mock.reset();
});

test("does not request haptics on web", async () => {
  const calls: string[] = [];
  const haptics = await loadHaptics("web", calls);

  haptics.impact();
  haptics.selection();
  haptics.notifySuccess();

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, []);
});

test("maps native haptic helpers to Expo feedback APIs", async () => {
  const calls: string[] = [];
  const haptics = await loadHaptics("ios", calls);

  haptics.impact("medium");
  haptics.selection();
  haptics.notifySuccess();
  haptics.notifyWarning();
  haptics.notifyError();

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [
    "impact:medium",
    "selection",
    "notify:success",
    "notify:warning",
    "notify:error",
  ]);
});
