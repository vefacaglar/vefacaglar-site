import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IGamesRepository } from "../../../catalog/games.repository.interface";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { SuggestGamesHandler } from "./suggest.handler";

const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";

describe("SuggestGamesHandler", () => {
  let reader: Record<keyof ISearchReader, any>;
  let repo: Record<keyof IGamesRepository, any>;
  let handler: SuggestGamesHandler;

  beforeEach(() => {
    reader = { searchPublicGames: vi.fn().mockResolvedValue({ items: [], total: 0 }) } as unknown as Record<keyof ISearchReader, any>;
    repo = {
      searchPublicCompanies: vi.fn().mockResolvedValue([]),
      findPublicSuggestionsByIds: vi.fn().mockResolvedValue([]),
    } as unknown as Record<keyof IGamesRepository, any>;
    handler = new SuggestGamesHandler(reader, repo);
  });

  it.each([undefined, "", "   ", "-- !?", "…"])("returns empty groups without querying for %j", async (q) => {
    const result = await handler.handle({ query: { q } } as any);
    expect(result).toEqual({ developers: [], publishers: [], games: [] });
    expect(reader.searchPublicGames).not.toHaveBeenCalled();
    expect(repo.searchPublicCompanies).not.toHaveBeenCalled();
  });

  it("searches developers, publishers and games separately with the normalized term", async () => {
    await handler.handle({ query: { q: "  naughty   dog " } } as any);
    expect(repo.searchPublicCompanies).toHaveBeenCalledWith("developer", "naughty dog", 5);
    expect(repo.searchPublicCompanies).toHaveBeenCalledWith("publisher", "naughty dog", 5);
    expect(reader.searchPublicGames).toHaveBeenCalledWith({ q: "naughty dog", page: 1, limit: 5 });
    expect(repo.findPublicSuggestionsByIds).not.toHaveBeenCalled();
  });

  it("keeps search order, drops stale hits and exposes only dropdown fields", async () => {
    reader.searchPublicGames.mockResolvedValue({
      items: [{ id: ID_B }, { id: "missing" }, { id: ID_A }],
      total: 3,
    });
    repo.findPublicSuggestionsByIds.mockResolvedValue([
      { id: ID_A, slug: "a", title: "A", releaseDate: null, developerName: null },
      { id: ID_B, slug: "b", title: "B", releaseDate: "2020-03-01", developerName: "Studio" },
    ]);
    repo.searchPublicCompanies.mockImplementation(async (role: string) => [
      { id: `${role}-id`, name: `${role} name`, slug: `${role}-slug`, gameCount: 2 },
    ]);

    const result = await handler.handle({ query: { q: "ab" } } as any);

    expect(repo.findPublicSuggestionsByIds).toHaveBeenCalledWith([ID_B, "missing", ID_A]);
    expect(result).toEqual({
      developers: [{ name: "developer name", slug: "developer-slug", gameCount: 2 }],
      publishers: [{ name: "publisher name", slug: "publisher-slug", gameCount: 2 }],
      games: [
        { slug: "b", title: "B", releaseYear: 2020, developer: "Studio" },
        { slug: "a", title: "A", releaseYear: null, developer: null },
      ],
    });
  });
});
