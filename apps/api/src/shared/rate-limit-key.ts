import { BlockList, isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";

/**
 * Header the web server's SSR uses to tell the API which visitor a request is
 * made for. Caddy overwrites X-Forwarded-For on the API route, so the visitor
 * address travels in its own header instead.
 */
export const VISITOR_IP_HEADER = "x-visitor-ip";

/**
 * Addresses only reachable from inside the VPS (loopback, Docker networks).
 * Also the proxy hops Fastify's `trustProxy` trusts.
 */
export const INTERNAL_RANGES = "loopback, linklocal, uniquelocal";

const internal = new BlockList();
internal.addSubnet("127.0.0.0", 8, "ipv4");
internal.addSubnet("10.0.0.0", 8, "ipv4");
internal.addSubnet("172.16.0.0", 12, "ipv4");
internal.addSubnet("192.168.0.0", 16, "ipv4");
internal.addSubnet("169.254.0.0", 16, "ipv4");
internal.addAddress("::1", "ipv6");
internal.addSubnet("fc00::", 7, "ipv6");
internal.addSubnet("fe80::", 10, "ipv6");

function normalize(ip: string): string {
  // IPv4-mapped IPv6 (`::ffff:10.0.0.5`) as reported by dual-stack sockets.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

export function isInternalAddress(ip: string): boolean {
  const address = normalize(ip);
  const family = isIP(address);
  if (family === 4) return internal.check(address, "ipv4");
  if (family === 6) return internal.check(address, "ipv6");
  return false;
}

/**
 * Rate-limit key: the visitor's address. A request from an internal address
 * (the web server's SSR, after Caddy resolved the hop) may name the visitor it
 * acts for in `x-visitor-ip`; anyone on the internet cannot appear internal, so
 * they cannot pick their own key.
 */
export function rateLimitKey(request: { ip: string; headers: IncomingHttpHeaders }): string {
  const claimed = request.headers[VISITOR_IP_HEADER];
  if (typeof claimed === "string" && isInternalAddress(request.ip)) {
    const visitor = normalize(claimed.trim());
    if (isIP(visitor)) return visitor;
  }
  return request.ip;
}
