import "reflect-metadata";
import type { FastifyRequest } from "fastify";
import { describe, it, expect, vi } from "vitest";
import { ListDashboardMoviesHandler } from "./list.handler";
import type { IMovieDashboardRepository } from "../movies-dashboard.repository.interface";
import type { ListDashboardMoviesQuery } from "./list.schema";

const request = (query: ListDashboardMoviesQuery) => ({ query }) as FastifyRequest<{ Querystring: ListDashboardMoviesQuery }>;
const row = {
  id: "5f0c2c0e-0000-4000-8000-000000000001",
  slug: "alien-1979",
  title: "Alien",
  releaseYear: 1979,
  posterImageUrl: "https://upload.wikimedia.org/alien.jpg",
  isPublic: true,
  posterBlockedAt: new Date("2026-11-01T10:00:00Z"),
};

describe("ListDashboardMoviesHandler", () => {
  it("applies defaults, trims the search, suppresses stored poster URLs, and exposes block state", async () => {
    const repo: Record<keyof IMovieDashboardRepository, any> = {
      stats: vi.fn(),
      setPosterBlocked: vi.fn(),
      list: vi.fn().mockResolvedValue({ items: [row, { ...row, id: "5f0c2c0e-0000-4000-8000-000000000002", posterBlockedAt: null }], total: 30 }),
    };
    const result = await new ListDashboardMoviesHandler(repo).handle(request({ q: "  alien " }));
    expect(repo.list).toHaveBeenCalledWith({ page: 1, limit: 24, q: "alien", blockedOnly: false });
    expect(result).toMatchObject({ total: 30, page: 1, limit: 24, totalPages: 2 });
    expect(result.items[0]).toEqual({
      id: row.id,
      slug: "alien-1979",
      title: "Alien",
      releaseYear: 1979,
      posterImageUrl: null,
      isPublic: true,
      posterBlocked: true,
      posterBlockedAt: "2026-11-01T10:00:00.000Z",
    });
    expect(result.items[1]).toMatchObject({ posterImageUrl: null, posterBlocked: false, posterBlockedAt: null });
    expect(JSON.stringify(result.items)).not.toContain("wikimedia.org");
  });

  it("passes the blocked-only filter and treats a blank search as no search", async () => {
    const repo: Record<keyof IMovieDashboardRepository, any> = { stats: vi.fn(), setPosterBlocked: vi.fn(), list: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
    expect(await new ListDashboardMoviesHandler(repo).handle(request({ page: 3, limit: 12, q: "   ", blocked: true })))
      .toEqual({ items: [], total: 0, page: 3, limit: 12, totalPages: 0 });
    expect(repo.list).toHaveBeenCalledWith({ page: 3, limit: 12, q: undefined, blockedOnly: true });
  });
});
