import { Platform } from "react-native";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeConfiguredBase(value: string) {
  const trimmed = trimTrailingSlash(value.trim());
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getApiBase() {
  const directBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof directBase === "string" && directBase.trim()) {
    return normalizeConfiguredBase(directBase);
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (typeof domain === "string" && domain.trim()) {
    return normalizeConfiguredBase(domain);
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }

  return "";
}
