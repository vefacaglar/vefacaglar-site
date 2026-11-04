import { describe, it, expect } from "vitest";
import { DEFAULT_STREAM_ORIGINS, readStreamCorsOrigins } from "./stream.cors";

describe("readStreamCorsOrigins", () => {
  it("uses the production defaults in production when WEB_ORIGINS is unset", () => {
    expect(readStreamCorsOrigins({ NODE_ENV: "production" })).toEqual([...DEFAULT_STREAM_ORIGINS]);
  });

  it("adds localhost:3000 outside production", () => {
    expect(readStreamCorsOrigins({ NODE_ENV: "development" })).toEqual([
      "https://vefacaglar.com",
      "https://www.vefacaglar.com",
      "http://localhost:3000",
    ]);
    expect(readStreamCorsOrigins({})).toContain("http://localhost:3000");
  });

  it("parses WEB_ORIGINS (trimmed, no trailing slash, empty entries dropped)", () => {
    expect(
      readStreamCorsOrigins({ NODE_ENV: "production", WEB_ORIGINS: " https://a.example , https://b.example/ ,," })
    ).toEqual(["https://a.example", "https://b.example"]);
  });

  it("assumes https for entries without a scheme", () => {
    expect(
      readStreamCorsOrigins({ NODE_ENV: "production", WEB_ORIGINS: "vefacaglar.com, http://x.example" })
    ).toEqual(["https://vefacaglar.com", "http://x.example"]);
  });

  it("does not duplicate localhost when it is configured", () => {
    expect(readStreamCorsOrigins({ WEB_ORIGINS: "http://localhost:3000" })).toEqual(["http://localhost:3000"]);
  });
});
