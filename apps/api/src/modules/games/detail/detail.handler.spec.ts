import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetGameHandler } from "./detail.handler";
import type { IGamesRepository } from "../../catalog/games.repository.interface";

describe("GetGameHandler", () => {
  let repo: Record<keyof IGamesRepository, any>;
  let handler: GetGameHandler;

  beforeEach(() => {
    repo = { findBySlug: vi.fn() } as unknown as Record<keyof IGamesRepository, any>;
    handler = new GetGameHandler(repo);
  });

  it("throws NotFound for an unknown slug", async () => {
    repo.findBySlug.mockResolvedValue(null);
    await expect(handler.handle({ params: { slug: "nope" } } as any)).rejects.toThrow("Game not found.");
  });

  it("maps hours to numbers and strips lookup ids except platforms", async () => {
    repo.findBySlug.mockResolvedValue({
      id: "g-1",
      slug: "doom",
      title: "Doom",
      description: null,
      coverImageUrl: null,
      releaseDate: "1993-12-10",
      hltbMainHours: "7.5",
      hltbMainExtraHours: null,
      hltbCompletionistHours: "15.0",
      developers: [{ id: "d-1", name: "id Software", slug: "id-software" }],
      publishers: [],
      genres: [],
      themes: [],
      platforms: [{ id: "p-1", name: "PC", slug: "win" }],
    });

    const result = await handler.handle({ params: { slug: "doom" } } as any);

    expect(result.hltbMainHours).toBe(7.5);
    expect(result.hltbMainExtraHours).toBeNull();
    expect(result.developers).toEqual([{ name: "id Software", slug: "id-software" }]);
    expect(result.platforms).toEqual([{ id: "p-1", name: "PC", slug: "win" }]);
  });

  it.each(["2099-01-01", null])("opens a catalog game with upcoming or unknown release date %j", async (releaseDate) => {
    repo.findBySlug.mockResolvedValue({
      slug: "announced", title: "Announced", description: null, coverImageUrl: null, releaseDate,
      hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null,
      developers: [], publishers: [], genres: [], themes: [], platforms: [],
    });
    await expect(handler.handle({ params: { slug: "announced" } } as any)).resolves.toMatchObject({ slug: "announced", releaseDate });
  });
});
