import { URL } from "url";
const xForwardedHost = "evil.com:8080";
try {
  const parsed = new URL(`http://${xForwardedHost}`);
  console.log(parsed.hostname);
  console.log(parsed.host);
} catch (e) {
  console.log(e);
}
