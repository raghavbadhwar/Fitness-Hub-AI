import { Request } from "express";

function buildProxyUrl(req: Request) {
  const protocol = req.protocol === "http" ? "http" : "https";
  let host = req.get("host") || "";
  try {
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0].trim();
    if (forwardedHost) {
      const parsed = new URL(`${protocol}://${forwardedHost}`);
      if (parsed.hostname === req.hostname) {
        host = parsed.host;
      }
    }
  } catch {
    // Ignore URL parsing errors and fallback to host
  }
  return `${protocol}://${host}/api/__clerk`;
}

console.log(
  buildProxyUrl({
    protocol: "https",
    hostname: "example.com",
    get: (h: string) => (h === "host" ? "internal:8080" : "example.com:8443"),
  } as Request),
);
