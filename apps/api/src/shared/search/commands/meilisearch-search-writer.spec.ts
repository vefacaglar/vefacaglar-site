import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../application-logs/runtime-failures", () => ({ reportRuntimeFailure: vi.fn() }));

import type { IGamesRepository } from "../../../modules/catalog/games.repository.interface";
import { MeilisearchError, type ISearchClient } from "../meilisearch.client";
import { reportRuntimeFailure } from "../../application-logs/runtime-failures";
import { MeilisearchSearchWriter } from "./meilisearch-search-writer";

const ID = "00000000-0000-4000-8000-000000000001";
const game = {
  id: ID, slug: "a", title: "A", originalTitle: null, description: null, coverImageUrl: null, releaseDate: null,
  metacriticScore: null, openCriticScore: null, criticScore: null, criticScoreCount: null, popularityScore: 0.5,
  hltbMainHours: null, hltbMainExtraHours: null, hltbCompletionistHours: null,
  developers: [], publishers: [], genres: [], platforms: [], themes: [],
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: null,
};

let client: Record<keyof ISearchClient, any>;
let gamesRepo: Record<keyof IGamesRepository, any>;
const writer = (enabled = true) => new MeilisearchSearchWriter(
  client, { enabled, url: "http://localhost:7700", apiKey: "key" },
  {} as any, {} as any, {} as any, {} as any, {} as any, gamesRepo as any, {} as any,
);

beforeEach(() => {
  vi.mocked(reportRuntimeFailure).mockClear();
  client = {
    search: vi.fn(),
    addDocuments: vi.fn().mockResolvedValue({ taskUid: 7, status: "enqueued" }),
    deleteDocument: vi.fn().mockResolvedValue({ taskUid: 8, status: "enqueued" }),
    indexExists: vi.fn().mockResolvedValue(true),
    waitForTask: vi.fn().mockResolvedValue({ taskUid: 7, status: "succeeded" }),
    maxTotalHits: vi.fn(),
  };
  gamesRepo = {
    findById: vi.fn().mockResolvedValue(game),
    findByIds: vi.fn().mockResolvedValue([game]),
  } as unknown as Record<keyof IGamesRepository, any>;
});

describe("MeilisearchSearchWriter", () => {
  it("replaces a changed game's document without waiting for the task", async () => {
    await writer().indexGame(ID);
    expect(client.indexExists).toHaveBeenCalledWith("games_en");
    expect(client.addDocuments).toHaveBeenCalledWith("games_en", [expect.objectContaining({ id: ID, title: "A", popularityScore: 0.5 })]);
    expect(client.waitForTask).not.toHaveBeenCalled();
  });

  it("skips writes with a warning while the worker has not created the index", async () => {
    client.indexExists.mockResolvedValue(false);
    await writer().indexGame(ID);
    expect(client.addDocuments).not.toHaveBeenCalled();
    expect(reportRuntimeFailure).toHaveBeenCalledWith("search_index_missing", expect.any(String), undefined, "warning");
  });

  it("removes a game that no longer exists and reports (not throws) write failures", async () => {
    gamesRepo.findById.mockResolvedValue(null);
    await writer().indexGame(ID);
    expect(client.deleteDocument).toHaveBeenCalledWith("games_en", ID);

    client.deleteDocument.mockRejectedValue(new MeilisearchError("Could not reach Meilisearch", { code: "communication_error" }));
    await expect(writer().removeGame(ID)).resolves.toBeUndefined();
    expect(reportRuntimeFailure).toHaveBeenCalledWith("search_delete_failed", expect.any(String), expect.any(MeilisearchError));
  });

  it("does nothing while Meilisearch is not configured", async () => {
    await writer(false).indexGame(ID);
    await writer(false).indexGames([ID]);
    expect(client.indexExists).not.toHaveBeenCalled();
    await expect(writer(false).indexGames([ID], { throwOnError: true })).rejects.toThrow("Meilisearch must be configured");
  });

  it("enqueues bulk imports and only waits for the task when sync is required", async () => {
    await writer().indexGames([ID]);
    expect(client.addDocuments).toHaveBeenCalledWith("games_en", [expect.objectContaining({ id: ID })]);
    expect(client.waitForTask).not.toHaveBeenCalled();

    await writer().indexGames([ID], { throwOnError: true });
    expect(client.waitForTask).toHaveBeenCalledWith(7);
  });

  it("re-indexes a renamed lookup's games in one bulk import", async () => {
    const other = { ...game, id: "00000000-0000-4000-8000-000000000002", slug: "b" };
    const developersRepo = { findById: vi.fn().mockResolvedValue({ id: "d-1", name: "Dev", slug: "dev", countryCode: null,
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: null }) };
    gamesRepo.findGameIdsByRelation = vi.fn().mockResolvedValue([ID, other.id]);
    gamesRepo.findByIds.mockResolvedValue([game, other]);
    const lookupWriter = new MeilisearchSearchWriter(
      client, { enabled: true, url: "http://localhost:7700", apiKey: "key" },
      developersRepo as any, {} as any, {} as any, {} as any, {} as any, gamesRepo as any, {} as any,
    );

    await lookupWriter.indexDeveloper("d-1");

    expect(gamesRepo.findGameIdsByRelation).toHaveBeenCalledWith("developer", "d-1");
    expect(gamesRepo.findByIds).toHaveBeenCalledWith([ID, other.id]);
    expect(gamesRepo.findById).not.toHaveBeenCalled();
    expect(client.addDocuments).toHaveBeenCalledWith("games_en", [expect.objectContaining({ id: ID }), expect.objectContaining({ id: other.id })]);
  });

  it("fails a required sync when the task fails or the index is missing", async () => {
    client.waitForTask.mockResolvedValue({ taskUid: 7, status: "failed",
      error: { message: "Document doesn't have a `id` attribute", code: "missing_document_id", type: "invalid_request" } });
    await expect(writer().indexGames([ID], { throwOnError: true })).rejects.toMatchObject({ code: "missing_document_id" });

    client.indexExists.mockResolvedValue(false);
    await expect(writer().indexGames([ID], { throwOnError: true })).rejects.toThrow("does not exist yet");
    expect(client.addDocuments).toHaveBeenCalledTimes(1);
  });
});
