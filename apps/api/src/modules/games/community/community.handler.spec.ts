import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { GetGameCommunityHandler } from "./community.handler";
import type { IGameCommunityRepository } from "./community.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

const entry = {
  id: "shared-entry", author: { username: "reader", displayName: "Reader" },
  sharedAt: new Date("2026-11-08T10:00:00Z"), text: "A thoughtful review.\nA second line.", rating: 99,
  status: "completed", startedAt: "2026-01-01", completedAt: "2026-02-01",
};
const makeRepo = (): Record<keyof IGameCommunityRepository, any> => ({
  findPublicGameId: vi.fn().mockResolvedValue("content"),
  getCommunity: vi.fn().mockResolvedValue({ rating: { average: 99.5, count: 2 }, entries: [entry], total: 1 }),
});
const request = (query = {}) => ({ params: { slug: "example" }, query }) as any;

describe("GetGameCommunityHandler", () => {
  it("returns the site scale, ISO publication date and default pagination", async () => {
    const repo = makeRepo();
    const result = await new GetGameCommunityHandler(repo).handle(request());
    expect(repo.findPublicGameId).toHaveBeenCalledWith("example");
    expect(repo.getCommunity).toHaveBeenCalledWith("content", 1, 10);
    expect(result).toMatchObject({ rating: { average: 99.5, count: 2, scale: 100 }, page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(result.entries[0]).toEqual({ ...entry, sharedAt: "2026-11-08T10:00:00.000Z" });
  });
  it("uses an explicit public projection even if the dependency contains private fields", async () => {
    const repo = makeRepo();
    repo.getCommunity.mockResolvedValue({ rating: { average: null, count: 0, secret: true }, entries: [{ ...entry,
      userId: "private-id", notes: "Private notes", email: "hidden@example.com", purchasePrice: "99", author: { ...entry.author, email: "hidden@example.com" },
    }], total: 1 });
    const result = await new GetGameCommunityHandler(repo).handle(request());
    expect(result.rating).toEqual({ average: null, count: 0, scale: 100 });
    expect(result.entries[0]).toEqual({ ...entry, sharedAt: "2026-11-08T10:00:00.000Z" });
    expect(JSON.stringify(result)).not.toContain("hidden@example.com");
    expect(JSON.stringify(result)).not.toContain("Private notes");
  });
  it("retains actual totals on an out-of-range page", async () => {
    const repo = makeRepo();
    repo.getCommunity.mockResolvedValue({ rating: { average: null, count: 0 }, entries: [], total: 13 });
    const result = await new GetGameCommunityHandler(repo).handle(request({ page: 9, limit: 5 }));
    expect(repo.getCommunity).toHaveBeenCalledWith("content", 9, 5);
    expect(result).toMatchObject({ entries: [], total: 13, totalPages: 3, page: 9, limit: 5 });
  });
  it("returns a real empty and unrated state", async () => {
    const repo = makeRepo();
    repo.getCommunity.mockResolvedValue({ rating: { average: null, count: 0 }, entries: [], total: 0 });
    expect(await new GetGameCommunityHandler(repo).handle(request())).toMatchObject({ rating: { average: null, count: 0, scale: 100 }, entries: [], totalPages: 0 });
  });
  it("resolves public catalog eligibility before reading community data", async () => {
    const repo = makeRepo(); repo.findPublicGameId.mockResolvedValue(null);
    await expect(new GetGameCommunityHandler(repo).handle(request())).rejects.toThrow(NotFoundError);
    expect(repo.getCommunity).not.toHaveBeenCalled();
  });
});
