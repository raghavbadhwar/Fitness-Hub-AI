function isLocalWebHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getCurrentHostname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.hostname;
}

export function getClerkProxyUrl() {
  const configuredProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL?.trim();
  if (configuredProxyUrl) {
    if (
      !import.meta.env.PROD &&
      configuredProxyUrl.startsWith("/") &&
      isLocalWebHost(getCurrentHostname())
    ) {
      return undefined;
    }

    return configuredProxyUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && !isLocalWebHost(window.location.hostname)) {
    return "/api/__clerk";
  }

  return undefined;
}
