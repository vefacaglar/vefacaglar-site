import { describe, expect, it } from "vitest";
import { movieActionConnectionError, movieActionError } from "./movieActionErrors";

describe("movie action errors", () => {
  it("provides Turkish messages for common failures and unknown server responses", () => {
    expect(movieActionError(400, "Choose a valid calendar date.", "tr")).toBe("Bilgiler geçersiz. Lütfen kontrol edip tekrar dene.");
    expect(movieActionError(401, "Unauthorized", "tr")).toBe("Lütfen tekrar giriş yap.");
    expect(movieActionError(409, "Conflict", "tr")).toContain("çakışıyor");
    expect(movieActionError(500, "Internal server error.", "tr")).toBe("İşlem tamamlanamadı. Lütfen tekrar dene.");
    expect(movieActionConnectionError("tr")).toBe("Sunucuya bağlanılamadı.");
  });
  it("preserves the existing English API message and fallback", () => {
    expect(movieActionError(409, "Specific error", "en")).toBe("Specific error");
    expect(movieActionError(500, null, "en")).toBe("Request failed.");
    expect(movieActionConnectionError("en")).toBe("Server connection error.");
  });
});
