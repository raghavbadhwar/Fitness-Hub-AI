import { Request } from "express";
function getProxyUrl(req: Request) {
  const protocol = req.protocol === "http" ? "http" : "https";

  let host = req.hostname;
  const rawHostHeader = req.get("host") || "";
  const rawForwardedHost = req.get("x-forwarded-host");

  if (rawForwardedHost) {
    try {
      const parsed = new URL(`http://${rawForwardedHost}`);
      if (parsed.hostname === req.hostname) {
        host = rawForwardedHost;
      } else {
        host = rawHostHeader;
      }
    } catch (e) {
      host = rawHostHeader;
    }
  } else {
    host = rawHostHeader;
  }

  return `${protocol}://${host}/api/__clerk`;
}
