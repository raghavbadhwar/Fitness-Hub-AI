import { Platform } from "react-native";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

function getNativeProxyOrigin() {
  return (
    normalizeOrigin(process.env.EXPO_PUBLIC_API_BASE_URL) ||
    normalizeOrigin(process.env.EXPO_PUBLIC_DOMAIN)
  );
}

export function getClerkProxyUrl() {
  const configuredProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL?.trim();
  if (!configuredProxyUrl) {
    return undefined;
  }

  if (!configuredProxyUrl.startsWith("/")) {
    return trimTrailingSlash(configuredProxyUrl);
  }

  if (Platform.OS === "web") {
    return configuredProxyUrl;
  }

  const origin = getNativeProxyOrigin();
  return origin ? `${origin}${configuredProxyUrl}` : undefined;
}
