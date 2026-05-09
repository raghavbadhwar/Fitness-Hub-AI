import { Platform } from "react-native";

type ImpactStyle = "light" | "medium" | "heavy" | "soft" | "rigid";
type NotificationType = "success" | "warning" | "error";

interface HapticsProvider {
  impactAsync: (style: ImpactStyle) => Promise<void>;
  notificationAsync: (type: NotificationType) => Promise<void>;
  selectionAsync: () => Promise<void>;
}

interface HapticsTestGlobal {
  __FITNESS_HUB_HAPTICS_PROVIDER__?: HapticsProvider;
}

function canUseHaptics() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function getHapticsProvider(): Promise<HapticsProvider> {
  const injectedProvider = (globalThis as HapticsTestGlobal).__FITNESS_HUB_HAPTICS_PROVIDER__;
  if (injectedProvider) return injectedProvider;
  return import("expo-haptics") as Promise<HapticsProvider>;
}

export function impact(style: ImpactStyle = "light") {
  if (!canUseHaptics()) return;
  void getHapticsProvider()
    .then((haptics) => haptics.impactAsync(style))
    .catch(() => undefined);
}

export function selection() {
  if (!canUseHaptics()) return;
  void getHapticsProvider()
    .then((haptics) => haptics.selectionAsync())
    .catch(() => undefined);
}

export function notify(type: NotificationType) {
  if (!canUseHaptics()) return;
  void getHapticsProvider()
    .then((haptics) => haptics.notificationAsync(type))
    .catch(() => undefined);
}

export function notifySuccess() {
  notify("success");
}

export function notifyWarning() {
  notify("warning");
}

export function notifyError() {
  notify("error");
}
