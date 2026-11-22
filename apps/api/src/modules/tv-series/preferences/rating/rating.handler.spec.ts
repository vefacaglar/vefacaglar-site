import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { SetTvRatingHandler } from "./rating.handler";
import type { ITvPreferencesRepository } from "../preferences.repository.interface";
const request = (rating: unknown, expectedVersion = 0) => ({ params: { id: 1 }, user: { id: "owner" }, body: { rating, expectedVersion, userId: "another-user" } }) as any;
describe("personal TV rating", () => {
  it.each([0, 11, 1.5, undefined, "8"])("rejects invalid rating %s", async (rating) => {
    const repo = { setRating: vi.fn() } as unknown as Record<keyof ITvPreferencesRepository, any>;
    await expect(new SetTvRatingHandler(repo).handle(request(rating))).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.setRating).not.toHaveBeenCalled();
  });
  it.each([1, 10, null])("saves or clears %s with owner and field version", async (rating) => {
    const preferences = { rating, note: "Keep my note", ratingVersion: 4, noteVersion: 2 };
    const repo = { setRating: vi.fn().mockResolvedValue({ kind: "saved", preferences }) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    expect(await new SetTvRatingHandler(repo).handle(request(rating, 3))).toEqual(preferences);
    expect(repo.setRating).toHaveBeenCalledWith("owner", 1, rating, 3);
  });
  it.each([["missing", 404], ["conflict", 409]])("maps %s to HTTP %s", async (kind, statusCode) => {
    const repo = { setRating: vi.fn().mockResolvedValue({ kind }) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    await expect(new SetTvRatingHandler(repo).handle(request(8))).rejects.toMatchObject({ statusCode });
  });
});
