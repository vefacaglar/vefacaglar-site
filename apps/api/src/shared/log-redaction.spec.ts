import { describe, it, expect } from "vitest";
import { redactUrlSecrets, serializeRequestForLog } from "./log-redaction";

describe("redactUrlSecrets", () => {
  it("redacts the token query value", () => {
    expect(redactUrlSecrets("/api/jobs/dashboard/1/stream?token=abc.def.ghi")).toBe(
      "/api/jobs/dashboard/1/stream?token=[REDACTED]"
    );
  });

  it("keeps other parameters and handles any position", () => {
    expect(redactUrlSecrets("/s?afterLogId=5&token=abc&x=1")).toBe("/s?afterLogId=5&token=[REDACTED]&x=1");
    expect(redactUrlSecrets("/s?TOKEN=abc")).toBe("/s?TOKEN=[REDACTED]");
  });

  it("does not touch similarly named parameters or URLs without a query", () => {
    expect(redactUrlSecrets("/s?mytoken=abc")).toBe("/s?mytoken=abc");
    expect(redactUrlSecrets("/api/token")).toBe("/api/token");
    expect(redactUrlSecrets(undefined)).toBeUndefined();
  });
});

describe("serializeRequestForLog", () => {
  it("mirrors Fastify's default fields with a redacted url", () => {
    expect(
      serializeRequestForLog({
        method: "GET",
        url: "/stream?token=secret",
        host: "api.example",
        ip: "127.0.0.1",
        headers: {},
        socket: { remotePort: 1234 },
      })
    ).toEqual({
      method: "GET",
      url: "/stream?token=[REDACTED]",
      version: undefined,
      host: "api.example",
      remoteAddress: "127.0.0.1",
      remotePort: 1234,
    });
  });
});
