import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));

import { httpClient } from "./httpClient";
import { gameCompanyHref, gameCompanyPageNumber, getGameCompany } from "./gameCompanies";
import { localizeHref } from "./localizeHref";

beforeEach(() => vi.resetAllMocks());

describe("game company navigation", () => {
  it("keeps roles separate and encodes the slug as one path component", () => {
    expect(gameCompanyHref("developer", "same-studio")).toBe("/explore/games/developers/same-studio");
    expect(gameCompanyHref("publisher", "same-studio")).toBe("/explore/games/publishers/same-studio");
    expect(gameCompanyHref("developer", "a/b?c")).toBe("/explore/games/developers/a%2Fb%3Fc");
    expect(localizeHref(gameCompanyHref("publisher", "studio"), "tr")).toBe("/explore/games/publishers/studio?lang=tr");
  });

  it("accepts positive safe page numbers and defaults invalid URL values", () => {
    expect(gameCompanyPageNumber("2")).toBe(2);
    expect(gameCompanyPageNumber("002")).toBe(2);
    for (const value of [undefined, null, ["2"], "", "0", "-1", "1.5", "Infinity", "9007199254740992"]) {
      expect(gameCompanyPageNumber(value)).toBe(1);
    }
  });
});

describe("game company requests", () => {
  it("keeps API requests outside the Explore browser namespace", async () => {
    const payload = { company: { name: "Studio" }, items: [], total: 0 };
    vi.mocked(httpClient.get).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    expect(await getGameCompany("publisher", "a/b", 3)).toEqual(payload);
    expect(gameCompanyHref("publisher", "a/b")).toBe("/explore/games/publishers/a%2Fb");
    expect(httpClient.get).toHaveBeenCalledWith("/api/games/publishers/a%2Fb?page=3&limit=21");
  });

  it("only treats a real 404 as a missing company", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 404 }));
    expect(await getGameCompany("developer", "missing", 1)).toBeNull();
    vi.mocked(httpClient.get).mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getGameCompany("developer", "studio", 1)).rejects.toThrow("503");
  });
});
