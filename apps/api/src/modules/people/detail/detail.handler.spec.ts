import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { GetPersonHandler } from "./detail.handler";
import type { IPeopleRepository } from "../people.repository.interface";
describe("mixed person credits", () => {
  it("returns canonical identity and bounded pagination without changing media kinds", async () => {
    const data = { person: { id: "canonical", name: "Actor", wikidataId: null }, total: 25,
      items: [{ kind: "film", id: "film", title: "Film" }, { kind: "tv_series", id: 1, title: "Series" }] };
    const repo = { findPublic: vi.fn().mockResolvedValue(data) } as unknown as Record<keyof IPeopleRepository, any>;
    const result = await new GetPersonHandler(repo).handle({ params: { id: "alias" }, query: {} } as any);
    expect(repo.findPublic).toHaveBeenCalledWith("alias", 1, 24);
    expect(result).toEqual({ ...data, page: 1, limit: 24, totalPages: 2 });
  });
  it("keeps an out-of-range page while preserving the credit total", async () => {
    const repo = { findPublic: vi.fn().mockResolvedValue({ person: { id: "id" }, items: [], total: 25 }) } as unknown as Record<keyof IPeopleRepository, any>;
    expect(await new GetPersonHandler(repo).handle({ params: { id: "id" }, query: { page: 9, limit: 12 } } as any)).toMatchObject({ page: 9, totalPages: 3, total: 25, items: [] });
  });
  it("returns not found for an unknown or uncredited public identity", async () => {
    const repo = { findPublic: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof IPeopleRepository, any>;
    await expect(new GetPersonHandler(repo).handle({ params: { id: "id" }, query: {} } as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});
