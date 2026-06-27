import { URL } from "url";
const req = {
  hostname: 'trusted.com',
  protocol: 'https',
  headers: {
    'host': 'trusted.com:80',
    'x-forwarded-host': 'evil.com:8080'
  },
  get: function(header: string) {
    return this.headers[header.toLowerCase()];
  }
};

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
console.log(host);
