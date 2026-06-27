import { Request } from "express";
function getProxyUrl(req: Request) {
  // Respecting trust proxy, let's use req.protocol and req.hostname, and req.get("host") for port

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

// simulate Express Req
const req = {
  protocol: 'https',
  hostname: 'trusted.com',
  headers: {
    'host': 'trusted.com:80',
    'x-forwarded-host': 'evil.com:8080'
  },
  get: function(header: string) {
    return this.headers[header.toLowerCase()];
  }
} as unknown as Request;

console.log(getProxyUrl(req));

const req2 = {
  protocol: 'https',
  hostname: 'trusted.com',
  headers: {
    'host': 'trusted.com:80',
    'x-forwarded-host': 'trusted.com:8080'
  },
  get: function(header: string) {
    return this.headers[header.toLowerCase()];
  }
} as unknown as Request;

console.log(getProxyUrl(req2));

const req3 = {
  protocol: 'https',
  hostname: 'trusted.com',
  headers: {
    'host': 'trusted.com:80'
  },
  get: function(header: string) {
    return this.headers[header.toLowerCase()];
  }
} as unknown as Request;

console.log(getProxyUrl(req3));
