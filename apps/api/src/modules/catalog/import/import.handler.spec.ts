import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportGameHandler } from "./import.handler";
import { GameCatalogService } from "../catalog.service";
import type { CatalogIndex, IGamesRepository } from "../games.repository.interface";
import { BadRequestError, NotFoundError } from "../../../shared/http-errors";
import type { IHltbClient, IIgdbClient, ImportedGame } from "./import.types";

const igdbGame: ImportedGame = {
  title: "Hollow Knight",
  slug: "hollow-knight",
  description: "Metroidvania",
  coverImageUrl: "https://images.igdb.com/cover.jpg",
  releaseDate: "2017-02-24",
  criticScore: 87,
  criticScoreCount: 12,
  developers: [{ name: "Team Cherry", slug: "team-cherry" }],
  publishers: [{ name: "Team Cherry", slug: "team-cherry" }],
  genres: [{ name: "Platform", slug: "platform" }],
  platforms: [{ name: "PC", slug: "win" }],
  themes: [],
};

const existingGame = {
  id: "g-1",
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
  genres: [{ id: "gen-platform", slug: "platform" }],
  platforms: [],
  themes: [],
});

describe("ImportGameHandler", () => {
  let catalog: Record<keyof GameCatalogService, any>;
  let gamesRepo: Record<keyof IGamesRepository, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let hltb: Record<keyof IHltbClient, any>;
  let handler: ImportGameHandler;

  beforeEach(() => {
    catalog = {
      getGameById: vi.fn().mockResolvedValue(existingGame),
      createGame: vi.fn().mockResolvedValue({ id: "g-new", slug: "hollow-knight", title: "Hollow Knight" }),
      updateGame: vi.fn().mockResolvedValue({}),
      getDeveloperBySlug: vi.fn(),
      getPublisherBySlug: vi.fn(),
      getGenreBySlug: vi.fn(),
      getPlatformBySlug: vi.fn(),
      getThemeBySlug: vi.fn(),
      createDeveloper: vi.fn().mockResolvedValue({ id: "dev-new" }),
      createPublisher: vi.fn().mockResolvedValue({ id: "pub-new" }),
      createGenre: vi.fn(),
      createPlatform: vi.fn().mockResolvedValue({ id: "plat-new" }),
      createTheme: vi.fn(),
      linkGameDeveloper: vi.fn(),
      linkGamePublisher: vi.fn(),
      linkGameGenre: vi.fn(),
      linkGamePlatform: vi.fn(),
      linkGameTheme: vi.fn(),
    } as unknown as Record<keyof GameCatalogService, any>;
    gamesRepo = { loadCatalogIndex: vi.fn().mockResolvedValue(emptyIndex()) } as unknown as Record<
      keyof IGamesRepository,
      any
    >;
    igdb = { findGame: vi.fn().mockResolvedValue(igdbGame), listGames: vi.fn() };
    hltb = {
      findTimes: vi.fn().mockResolvedValue({ mainHours: 27, mainExtraHours: 41.6, completionistHours: 65.6 }),
    };
    handler = new ImportGameHandler(catalog as unknown as GameCatalogService, gamesRepo, igdb, hltb);
  });

  const withIndexedGame = (game: Partial<CatalogIndex["games"][number]> = {}) =>
    gamesRepo.loadCatalogIndex.mockResolvedValue({
      ...emptyIndex(),
      games: [{ id: "g-1", slug: "hollow-knight", title: "Hollow Knight", originalTitle: null, releaseDate: "2017-02-24", ...game }],
    });

  it("returns not_found when IGDB has no match", async () => {
    igdb.findGame.mockResolvedValue(null);

    const result = await handler.handle("Nonexistent");

    expect(result.status).toBe("not_found");
    expect(catalog.createGame).not.toHaveBeenCalled();
  });

  it("creates a new game, reusing indexed lookups and creating missing ones", async () => {
    const result = await handler.handle("hollow knight");

    expect(result.status).toBe("created");
    expect(catalog.getGameById).not.toHaveBeenCalled();
    expect(catalog.createGenre).not.toHaveBeenCalled();
    expect(catalog.createPlatform).toHaveBeenCalledWith({ name: "PC", slug: "win" });
    expect(catalog.createGame).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hollow Knight", slug: "hollow-knight", hltbMainHours: 27, criticScore: 87, criticScoreCount: 12 }),
      {
        developerIds: ["dev-new"],
        publisherIds: ["pub-new"],
        genreIds: ["gen-platform"],
        platformIds: ["plat-new"],
        themeIds: [],
      }
    );
  });

  it("loads the catalog index once and remembers games it created", async () => {
    await handler.importSource(igdbGame, { skipHltb: true });
    const second = await handler.importSource(igdbGame, { skipHltb: true });

    expect(gamesRepo.loadCatalogIndex).toHaveBeenCalledTimes(1);
    expect(catalog.createGame).toHaveBeenCalledTimes(1);
    expect(catalog.createDeveloper).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("updated");
    expect(catalog.getGameById).toHaveBeenCalledWith("g-new");
  });

  it("fills only missing fields and empty relation kinds on an existing game", async () => {
    withIndexedGame();

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(catalog.getGameById).toHaveBeenCalledWith("g-1");
    expect(catalog.updateGame).toHaveBeenCalledWith("g-1", {
      coverImageUrl: "https://images.igdb.com/cover.jpg",
      criticScore: 87,
      criticScoreCount: 12,
      hltbMainHours: 27,
      hltbMainExtraHours: 41.6,
    });
    expect(catalog.linkGameDeveloper).toHaveBeenCalledWith("g-1", "dev-new");
    expect(catalog.linkGamePlatform).toHaveBeenCalledWith("g-1", "plat-new");
    expect(catalog.linkGameGenre).not.toHaveBeenCalled();
  });

  it("matches an existing game by title and year when the slug differs", async () => {
    withIndexedGame({ slug: "hk" });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(catalog.createGame).not.toHaveBeenCalled();
  });

  it("does not match a same-titled game from a different year", async () => {
    withIndexedGame({ slug: "hollow-knight-2009", releaseDate: "2009-01-01" });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
    expect(catalog.getGameById).not.toHaveBeenCalled();
  });

  it("skips a game that has nothing missing", async () => {
    withIndexedGame();
    catalog.getGameById.mockResolvedValue({
      ...existingGame,
      coverImageUrl: "x",
      criticScore: 80,
      hltbMainHours: "27.0",
      hltbMainExtraHours: "41.6",
      developers: [{ id: "d" }],
      publishers: [{ id: "p" }],
      platforms: [{ id: "pl" }],
    });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("skipped");
    expect(catalog.updateGame).not.toHaveBeenCalled();
  });

  it("creates the game when the indexed record was deleted meanwhile", async () => {
    withIndexedGame();
    catalog.getGameById.mockRejectedValue(new NotFoundError());

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
  });

  it("fetches a lookup that was created after the index was loaded", async () => {
    catalog.createPlatform.mockRejectedValue(new BadRequestError("Platform with this slug already exists."));
    catalog.getPlatformBySlug.mockResolvedValue({ id: "plat-existing" });

    await handler.handle("Hollow Knight");

    expect(catalog.getPlatformBySlug).toHaveBeenCalledWith("win");
    expect(catalog.createGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ platformIds: ["plat-existing"] })
    );
  });

  it("writes nothing in dry-run mode", async () => {
    const result = await handler.handle("Hollow Knight", { dryRun: true });

    expect(result.status).toBe("created");
    expect(catalog.createGame).not.toHaveBeenCalled();
    expect(catalog.createPlatform).not.toHaveBeenCalled();
  });

  it("still imports when HLTB fails", async () => {
    hltb.findTimes.mockRejectedValue(new Error("HLTB search failed: 500"));

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("created");
    expect(result.notes).toContain("HLTB error: HLTB search failed: 500");
    expect(catalog.createGame).toHaveBeenCalledWith(
      expect.objectContaining({ hltbMainHours: undefined }),
      expect.anything()
    );
  });

  it("imports a pre-fetched IGDB record without searching again", async () => {
    const result = await handler.importSource(igdbGame, { skipHltb: true });

    expect(result.status).toBe("created");
    expect(igdb.findGame).not.toHaveBeenCalled();
    expect(hltb.findTimes).not.toHaveBeenCalled();
  });

  it("reports failed when IGDB throws", async () => {
    igdb.findGame.mockRejectedValue(new Error("IGDB search failed: 401"));

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("failed");
    expect(result.notes).toEqual(["IGDB search failed: 401"]);
  });
});
