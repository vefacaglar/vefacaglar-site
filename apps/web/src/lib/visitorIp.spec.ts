import { describe, expect, it } from "vitest";
import { visitorIp } from "./visitorIp";

describe("visitorIp", () => {
  it("prefers a single valid CF-Connecting-IP over the edge address in X-Forwarded-For", () => {
    expect(visitorIp("104.21.3.4", null, "198.51.100.4")).toBe("198.51.100.4");
    expect(visitorIp("104.21.3.4", null, " 2001:db8::7 ")).toBe("2001:db8::7");
  });

  it("ignores an invalid or multi-value CF-Connecting-IP", () => {
    expect(visitorIp("198.51.100.4", null, "1.2.3.4, 5.6.7.8")).toBe("198.51.100.4");
    expect(visitorIp("198.51.100.4", null, "garbage")).toBe("198.51.100.4");
    expect(visitorIp("198.51.100.4", null, "999.1.1.1")).toBe("198.51.100.4");
    expect(visitorIp("198.51.100.4", null, "")).toBe("198.51.100.4");
  });

  it("uses the X-Forwarded-For entry added by the nearest proxy", () => {
    expect(visitorIp("198.51.100.4", null)).toBe("198.51.100.4");
    expect(visitorIp("1.2.3.4, 198.51.100.4 ", null, null)).toBe("198.51.100.4");
  });

  it("falls back to X-Real-IP, then to nothing", () => {
    expect(visitorIp(null, " 198.51.100.4 ")).toBe("198.51.100.4");
    expect(visitorIp(" ", "198.51.100.4")).toBe("198.51.100.4");
    expect(visitorIp(null, null, null)).toBeNull();
  });
});
