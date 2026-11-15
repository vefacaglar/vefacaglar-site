import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { isInternalAddress, rateLimitKey } from "./rate-limit-key";

describe("isInternalAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.18.0.1", "192.168.1.5", "::1", "::ffff:172.20.0.4", "fd00::1"])(
    "treats %s as internal",
    (ip) => expect(isInternalAddress(ip)).toBe(true)
  );

  it.each(["203.0.113.7", "172.32.0.1", "2001:db8::1", "::ffff:8.8.8.8", "", "not-an-ip"])(
    "treats %s as external",
    (ip) => expect(isInternalAddress(ip)).toBe(false)
  );
});

describe("rateLimitKey", () => {
  it("keys an internal caller by the visitor it names", () => {
    expect(rateLimitKey({ ip: "172.18.0.1", headers: { "x-visitor-ip": " 198.51.100.4 " } })).toBe("198.51.100.4");
    expect(rateLimitKey({ ip: "::ffff:127.0.0.1", headers: { "x-visitor-ip": "::ffff:198.51.100.4" } })).toBe(
      "198.51.100.4"
    );
  });

  it("ignores the visitor header from external callers", () => {
    expect(rateLimitKey({ ip: "203.0.113.7", headers: { "x-visitor-ip": "198.51.100.4" } })).toBe("203.0.113.7");
  });

  it("falls back to the caller address without a valid single visitor address", () => {
    expect(rateLimitKey({ ip: "172.18.0.1", headers: {} })).toBe("172.18.0.1");
    expect(rateLimitKey({ ip: "172.18.0.1", headers: { "x-visitor-ip": "1.2.3.4, 5.6.7.8" } })).toBe("172.18.0.1");
    expect(rateLimitKey({ ip: "172.18.0.1", headers: { "x-visitor-ip": "garbage" } })).toBe("172.18.0.1");
  });
});
