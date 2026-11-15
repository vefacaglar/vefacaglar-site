/** Header the API reads to rate-limit SSR requests per visitor instead of per web server. */
export const VISITOR_IP_HEADER = "x-visitor-ip";

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6 = /^(?=.*:)[0-9a-f:.]{2,45}$/i;

/** Cheap shape check (no `node:net`: this module also loads in the browser bundle). The API validates strictly. */
function singleIp(value: string | null): string | null {
  const ip = value?.trim();
  return ip && (IPV4.test(ip) || IPV6.test(ip)) ? ip : null;
}

/**
 * The visitor's address for API rate limiting.
 *
 * vefacaglar.com is proxied by Cloudflare, so Caddy sees Cloudflare edge addresses
 * and the last X-Forwarded-For entry is an edge, not the visitor. Cloudflare puts
 * the visitor in CF-Connecting-IP, which is preferred when it holds one valid IP.
 * Otherwise the last X-Forwarded-For entry (the one the nearest proxy added, not
 * one the client sent) is used, then X-Real-IP.
 *
 * Residual risk: a client reaching the web origin directly (bypassing Cloudflare)
 * can set CF-Connecting-IP itself. At worst it picks its own rate-limit key and
 * evades its own limit; it cannot exhaust anyone else's. Accepted for this site.
 */
export function visitorIp(
  forwardedFor: string | null,
  realIp: string | null,
  cfConnectingIp: string | null = null
): string | null {
  const cloudflare = singleIp(cfConnectingIp);
  if (cloudflare) return cloudflare;
  const last = forwardedFor?.split(",").pop()?.trim();
  return last || realIp?.trim() || null;
}
