function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getConfiguredPort() {
  const configuredPort = import.meta.env.VITE_API_PORT;
  if (typeof configuredPort === "string" && configuredPort.trim()) {
    return configuredPort.trim();
  }

  return "4000";
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof configuredBaseUrl === "string" && configuredBaseUrl.trim()) {
    return trimTrailingSlash(configuredBaseUrl.trim());
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${getConfiguredPort()}`;
  }

  return "";
}

export function buildApiUrl(path: string) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
