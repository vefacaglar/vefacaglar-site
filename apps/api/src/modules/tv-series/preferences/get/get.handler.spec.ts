import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetTvPreferencesHandler } from "./get.handler";
import type { ITvPreferencesRepository } from "../preferences.repository.interface";
describe("private TV preferences", () => {
  it("reads only the authenticated owner's values and preserves an empty preference", async () => {
    const value = { rating: null, note: null, ratingVersion: 0, noteVersion: 0 };
    const repo = { find: vi.fn().mockResolvedValue(value) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    expect(await new GetTvPreferencesHandler(repo).handle({ params: { id: 1 }, user: { id: "owner" } } as any)).toEqual(value);
    expect(repo.find).toHaveBeenCalledWith("owner", 1);
  });
  it("rejects an unavailable catalog series", async () => {
    const repo = { find: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    await expect(new GetTvPreferencesHandler(repo).handle({ params: { id: 1 }, user: { id: "owner" } } as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});
