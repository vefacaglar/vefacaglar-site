import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { ResolvePersonHandler } from "./resolve.handler";
import type { IPeopleRepository } from "../people.repository.interface";
describe("legacy public person identity", () => {
  it("resolves an existing QID to the shared canonical UUID", async () => {
    const repo = { resolveWikidata: vi.fn().mockResolvedValue({ id: "canonical" }) } as unknown as Record<keyof IPeopleRepository, any>;
    expect(await new ResolvePersonHandler(repo).handle({ params: { wikidataId: "Q123" } } as any)).toEqual({ id: "canonical" });
    expect(repo.resolveWikidata).toHaveBeenCalledWith("Q123");
  });
  it("keeps absent public people as 404", async () => {
    const repo = { resolveWikidata: vi.fn().mockResolvedValue(null) } as unknown as Record<keyof IPeopleRepository, any>;
    await expect(new ResolvePersonHandler(repo).handle({ params: { wikidataId: "Q123" } } as any)).rejects.toMatchObject({ statusCode: 404 });
  });
});
