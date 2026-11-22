import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));
import { cookies } from "next/headers";
import { httpClient } from "./httpClient";
import { getMyTvPreferences } from "./tvPreferences";
beforeEach(() => vi.resetAllMocks());
describe("private TV preference reads", () => {
  it("avoids a request without a session", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    expect(await getMyTvPreferences(1)).toBeNull();
    expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("reads each owner's data with an authenticated no-store request", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: "token" }) } as never);
    vi.mocked(httpClient.get).mockResolvedValue(Response.json({ rating: 8, note: "Private", ratingVersion: 1, noteVersion: 1 }));
    expect((await getMyTvPreferences(1))?.note).toBe("Private");
    expect(httpClient.get).toHaveBeenCalledWith("/api/tv-series/1/preferences", { headers: { Authorization: "Bearer token" }, cache: "no-store" });
  });
  it("distinguishes a server failure from an expired session", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: "token" }) } as never);
    vi.mocked(httpClient.get).mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(getMyTvPreferences(1)).rejects.toThrow("503");
    vi.mocked(httpClient.get).mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await getMyTvPreferences(1)).toBeNull();
  });
});
