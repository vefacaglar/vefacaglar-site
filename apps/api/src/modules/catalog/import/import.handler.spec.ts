import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImportGameHandler } from "./import.handler";
import { GameCatalogService } from "../catalog.service";
import { NotFoundError } from "../../../shared/http-errors";
import type { IHltbClient, IIgdbClient, ImportedGame } from "./import.types";

const igdbGame: ImportedGame = {
  title: "Hollow Knight",
  slug: "hollow-knight",
  description: "Metroidvania",
  coverImageUrl: "https://images.igdb.com/cover.jpg",
  releaseDate: "2017-02-24",
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
  developers: [],
  publishers: [],
  genres: [{ id: "gen-1", name: "Action", slug: "action" }],
  platforms: [],
  themes: [],
};

describe("ImportGameHandler", () => {
  let catalog: Record<keyof GameCatalogService, any>;
  let igdb: Record<keyof IIgdbClient, any>;
  let hltb: Record<keyof IHltbClient, any>;
  let handler: ImportGameHandler;

  beforeEach(() => {
    const notFound = () => Promise.reject(new NotFoundError());
    catalog = {
      getGameBySlug: vi.fn(notFound),
      listGames: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      createGame: vi.fn().mockResolvedValue({ id: "g-new" }),
      updateGame: vi.fn().mockResolvedValue({}),
      getDeveloperBySlug: vi.fn(notFound),
      getPublisherBySlug: vi.fn(notFound),
      getGenreBySlug: vi.fn().mockResolvedValue({ id: "gen-platform" }),
      getPlatformBySlug: vi.fn(notFound),
      getThemeBySlug: vi.fn(notFound),
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
    igdb = { findGame: vi.fn().mockResolvedValue(igdbGame) };
    hltb = {
      findTimes: vi.fn().mockResolvedValue({ mainHours: 27, mainExtraHours: 41.6, completionistHours: 65.6 }),
    };
    handler = new ImportGameHandler(catalog as unknown as GameCatalogService, igdb, hltb);
  });

  it("returns not_found when IGDB has no match", async () => {
    igdb.findGame.mockResolvedValue(null);

    const result = await handler.handle("Nonexistent");

    expect(result.status).toBe("not_found");
    expect(catalog.createGame).not.toHaveBeenCalled();
  });

  it("creates a new game, reusing existing lookups and creating missing ones", async () => {
    const result = await handler.handle("hollow knight");

    expect(result.status).toBe("created");
    expect(catalog.createGenre).not.toHaveBeenCalled();
    expect(catalog.createPlatform).toHaveBeenCalledWith({ name: "PC", slug: "win" });
    expect(catalog.createGame).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Hollow Knight", slug: "hollow-knight", hltbMainHours: 27 }),
      {
        developerIds: ["dev-new"],
        publisherIds: ["pub-new"],
        genreIds: ["gen-platform"],
        platformIds: ["plat-new"],
        themeIds: [],
      }
    );
  });

  it("fills only missing fields and empty relation kinds on an existing game", async () => {
    catalog.getGameBySlug.mockResolvedValue(existingGame);

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(catalog.updateGame).toHaveBeenCalledWith("g-1", {
      coverImageUrl: "https://images.igdb.com/cover.jpg",
      hltbMainHours: 27,
      hltbMainExtraHours: 41.6,
    });
    expect(catalog.linkGameDeveloper).toHaveBeenCalledWith("g-1", "dev-new");
    expect(catalog.linkGamePlatform).toHaveBeenCalledWith("g-1", "plat-new");
    expect(catalog.linkGameGenre).not.toHaveBeenCalled();
  });

  it("matches an existing game by title when the slug differs", async () => {
    catalog.listGames.mockResolvedValue({ items: [{ ...existingGame, slug: "hk" }], total: 1 });

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("updated");
    expect(result.slug).toBe("hk");
    expect(catalog.createGame).not.toHaveBeenCalled();
  });

  it("skips a game that has nothing missing", async () => {
    catalog.getGameBySlug.mockResolvedValue({
      ...existingGame,
      coverImageUrl: "x",
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

  it("reports failed when IGDB throws", async () => {
    igdb.findGame.mockRejectedValue(new Error("IGDB search failed: 401"));

    const result = await handler.handle("Hollow Knight");

    expect(result.status).toBe("failed");
    expect(result.notes).toEqual(["IGDB search failed: 401"]);
  });
});
