import { Platform } from "react-native";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeConfiguredBase(value: string, source: string) {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    return "";
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `${source} must include an explicit protocol (http:// or https://). Received: ${value}`,
    );
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(`${source} must be a valid HTTP(S) URL. Received: ${value}`);
  }

  return trimmed;
}

function isLocalWebHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getApiBase() {
  const directBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof directBase === "string" && directBase.trim()) {
    return normalizeConfiguredBase(directBase, "EXPO_PUBLIC_API_BASE_URL");
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (typeof domain === "string" && domain.trim()) {
    return normalizeConfiguredBase(domain, "EXPO_PUBLIC_DOMAIN");
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname, origin } = window.location;
    if (!isLocalWebHost(hostname)) {
      return origin;
    }

    return `${protocol}//${hostname}:4000`;
  }

  return "";
}
