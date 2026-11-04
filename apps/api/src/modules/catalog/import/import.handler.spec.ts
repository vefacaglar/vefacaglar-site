import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportGameHandler } from "./import.handler";
import type { CatalogImportWrite, CatalogIndex, IGamesRepository } from "../games.repository.interface";
import type { IEventBus } from "../../../shared/events/event-bus";
import type { IHltbClient, IIgdbClient, ImportedGame } from "./import.types";

const igdbGame: ImportedGame = {
  igdbId: 14593,
  title: "Hollow Knight",
  slug: "hollow-knight",
  description: "Metroidvania",
  coverImageUrl: "https://images.igdb.com/cover.jpg",
  releaseDate: "2017-02-24",
  criticScore: 87,
  criticScoreCount: 12,
  ratingCount: 4200,
  developers: [{ name: "Team Cherry", slug: "team-cherry" }],
  publishers: [{ name: "Team Cherry", slug: "team-cherry" }],
  genres: [{ name: "Platform", slug: "platform" }],
  platforms: [{ name: "PC", slug: "win" }],
  themes: [],
};

const existingGame = {
  id: "g-1",
  igdbId: null,
  slug: "hollow-knight",
  title: "Hollow Knight",
  originalTitle: null,
  description: "My own text",
  coverImageUrl: null,
  releaseDate: "2017-02-24",
  hltbMainHours: null,
  hltbMainExtraHours: null,
  hltbCompletionistHours: "60.0",
  criticScore: null,
  criticScoreCount: null,
  igdbRatingCount: null,
  developers: [],
  publishers: [],
  genres: [{ id: "gen-1", name: "Action", slug: "action" }],
  platforms: [],
  themes: [],
};

const emptyIndex = (): CatalogIndex => ({
  games: [],
  developers: [],
  publishers: [],
  genres: [],
  platforms: [],
  themes: [],
});

const noLookups = () => ({ developer: [], publisher: [], genre: [], platform: [], theme: [] });

describe("ImportGameHandler", () => {
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let hltb: Record<keyof IHltbClient, any>;
  let eventBus: Record<keyof IEventBus, any>;
  let handler: ImportGameHandler;

  // The write the handler sent to the repository on its last page.
  const lastWrite = (): CatalogImportWrite => gamesRepo.writeImportPage.mock.lastCall[0];

  beforeEach(() => {
    gamesRepo = {
      loadCatalogIndex: vi.fn().mockResolvedValue(emptyIndex()),
      findByIds: vi.fn().mockResolvedValue([]),
      // Echo every new game as inserted and report one created platform.
      writeImportPage: vi.fn().mockImplementation(async (write: CatalogImportWrite) => ({
        insertedGameIds: write.newGames.map((g) => g.id),
        lookups: { ...noLookups(), platform: [{ id: "plat-new", slug: "win", created: true }] },
      })),
    } as unknown as Record<keyof IGamesRepository, any>;
    igdb = { findGame: vi.fn().mockResolvedValue(igdbGame), listGames: vi.fn(), listPopularity: vi.fn() };
    hltb = {
      findTimes: vi.fn().mockResolvedValue({ mainHours: 27, mainExtraHours: 41.6, completionistHours: 65.6 }),
    };
    eventBus = { publish: vi.fn(), subscribe: vi.fn() };
    handler = new ImportGameHandler(gamesRepo, igdb, hltb, eventBus);
  });

  const withIndexedGame = (game: Partial<CatalogIndex["games"][number]> = {}, record: object = {}) => {
    const indexed = { id: "g-1", slug: "hollow-knight", igdbId: null, title: "Hollow Knight", originalTitle: null, releaseDate: "2017-02-24", ...game };
    gamesRepo.loadCatalogIndex.mockResolvedValue({ ...emptyIndex(), games: [indexed] });
    gamesRepo.findByIds.mockResolvedValue([{ ...existingGame, ...indexed, ...record }]);
  };

  it("returns not_found when IGDB has no match", async () => {
    igdb.findGame.mockResolvedValue(null);

    const result = await handler.handle("Nonexistent");

    expect(result.status).toBe("not_found");
    expect(gamesRepo.writeImportPage).not.toHaveBeenCalled();
  });

  it("creates a new game with its lookups and links in one write", async () => {
    const result = await handler.handle("hollow knight");

    expect(result).toMatchObject({ query: "hollow knight", status: "created", slug: "hollow-knight" });
    expect(gamesRepo.writeImportPage).toHaveBeenCalledTimes(1);
    const write = lastWrite();
    expect(write.newGames).toEqual([
      expect.objectContaining({ igdbId: 14593, slug: "hollow-knight", criticScore: 87, igdbRatingCount: 4200, hltbMainHours: "27", hltbMainExtraHours: "41.6" }),
    ]);
    const gameId = write.newGames[0].id;
    expect(write.lookups.platform).toEqual([{ name: "PC", slug: "win" }]);
    expect(write.links.developer).toEqual([{ gameId, slug: "team-cherry" }]);
    expect(write.gameUpdates).toEqual([]);
  });

  it("publishes the touched games and newly created lookups for search", async () => {
    await handler.handle("Hollow Knight");

    const gameId = lastWrite().newGames[0].id;
    expect(eventBus.publish).toHaveBeenCalledWith({
      type: "games.imported",
      gameIds: [gameId],
      createdLookups: { ...noLookups(), platform: ["plat-new"] },
    });
  });

  it("writes a whole page at once and loads the catalog index only once per run", async () => {
    const other = { ...igdbGame, igdbId: 1, title: "Celeste", slug: "celeste" };

    const results = await handler.importPage([igdbGame, other], { skipHltb: true });
    await handler.importPage([{ ...other, igdbId: 2, slug: "celeste-2", title: "Celeste 2" }], { skipHltb: true });

    expect(results.map((r) => r.status)).toEqual(["created", "created"]);
    expect(gamesRepo.writeImportPage).toHaveBeenCalledTimes(2);
    expect(gamesRepo.writeImportPage.mock.calls[0][0].newGames).toHaveLength(2);
    expect(gamesRepo.loadCatalogIndex).toHaveBeenCalledTimes(1);
  });

  it("skips a second record in the same page that matches a game the page created", async () => {
    const results = await handler.importPage([igdbGame, { ...igdbGame, igdbId: 99 }], { skipHltb: true });

    expect(results.map((r) => r.status)).toEqual(["created", "skipped"]);
    expect(lastWrite().newGames).toHaveLength(1);
  });

  it("matches an existing game by IGDB id even when slug and title changed", async () => {
    withIndexedGame({ igdbId: 14593, slug: "hk", title: "HK" }, { igdbId: 14593 });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(gamesRepo.findByIds).toHaveBeenCalledWith(["g-1"]);
    expect(lastWrite().newGames).toEqual([]);
  });

  it("fills only missing fields and empty relation kinds, and links the IGDB id", async () => {
    withIndexedGame();

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    const write = lastWrite();
    expect(write.gameUpdates).toEqual([
      {
        id: "g-1",
        patch: {
          igdbId: 14593,
          coverImageUrl: "https://images.igdb.com/cover.jpg",
          criticScore: 87,
          criticScoreCount: 12,
          hltbMainHours: "27",
          hltbMainExtraHours: "41.6",
          igdbRatingCount: 4200,
          updatedAt: expect.any(Date),
        },
      },
    ]);
    expect(write.links.developer).toEqual([{ gameId: "g-1", slug: "team-cherry" }]);
    expect(write.links.platform).toEqual([{ gameId: "g-1", slug: "win" }]);
    expect(write.links.genre).toEqual([]);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: ["g-1"] }));
  });

  it("matches an existing game by title and year when the slug differs", async () => {
    withIndexedGame({ slug: "hk" });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(lastWrite().newGames).toEqual([]);
  });

  it("does not match a same-titled game from a different year", async () => {
    withIndexedGame({ slug: "hollow-knight-2009", releaseDate: "2009-01-01" });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
    expect(gamesRepo.findByIds).toHaveBeenCalledWith([]);
  });

  it("skips a game that has nothing missing but still links its IGDB id", async () => {
    withIndexedGame({}, {
      coverImageUrl: "x",
      criticScore: 80,
      igdbRatingCount: 4200,
      hltbMainHours: "27.0",
      hltbMainExtraHours: "41.6",
      developers: [{ id: "d" }],
      publishers: [{ id: "p" }],
      platforms: [{ id: "pl" }],
    });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("skipped");
    expect(lastWrite().gameUpdates).toEqual([{ id: "g-1", patch: { igdbId: 14593, updatedAt: expect.any(Date) } }]);
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: [] }));
  });

  it("always refreshes the IGDB rating count without marking the game updated", async () => {
    withIndexedGame({ igdbId: 14593 }, {
      igdbId: 14593,
      coverImageUrl: "x",
      criticScore: 80,
      igdbRatingCount: 3000,
      hltbMainHours: "27.0",
      hltbMainExtraHours: "41.6",
      developers: [{ id: "d" }],
      publishers: [{ id: "p" }],
      platforms: [{ id: "pl" }],
    });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("skipped");
    expect(lastWrite().gameUpdates).toEqual([{ id: "g-1", patch: { igdbRatingCount: 4200, updatedAt: expect.any(Date) } }]);
  });

  it("creates the game when the indexed record was deleted meanwhile", async () => {
    withIndexedGame();
    gamesRepo.findByIds.mockResolvedValue([]);

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
  });

  it("reports a new game as skipped when the database rejected it as a duplicate", async () => {
    gamesRepo.writeImportPage.mockResolvedValue({ insertedGameIds: [], lookups: noLookups() });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("skipped");
    expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ gameIds: [] }));
  });

  it("writes and publishes nothing in dry-run mode", async () => {
    const result = await handler.handle("Hollow Knight", { dryRun: true });

    expect(result.status).toBe("created");
    expect(gamesRepo.writeImportPage).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("still imports when HLTB fails", async () => {
    hltb.findTimes.mockRejectedValue(new Error("HLTB search failed: 500"));

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
    expect(result.notes).toContain("HLTB error: HLTB search failed: 500");
    expect(lastWrite().newGames[0]).toMatchObject({ hltbMainHours: null });
  });

  it("does not call HLTB when it is skipped", async () => {
    await handler.importPage([igdbGame], { skipHltb: true });

    expect(hltb.findTimes).not.toHaveBeenCalled();
    expect(igdb.findGame).not.toHaveBeenCalled();
  });

  it("throws from importPage when the bulk write fails, so the crawl can retry the page", async () => {
    gamesRepo.writeImportPage.mockRejectedValue(new Error("connection reset"));

    await expect(handler.importPage([igdbGame], { skipHltb: true })).rejects.toThrow("connection reset");
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("reports failed when IGDB throws", async () => {
    igdb.findGame.mockRejectedValue(new Error("IGDB search failed: 401"));

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("failed");
    expect(result.notes).toEqual(["IGDB search failed: 401"]);
  });
});
