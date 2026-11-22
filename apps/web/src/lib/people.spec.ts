import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));
import { httpClient } from "./httpClient";
import { getPerson, personId, personHref, personCreditHref, personCreditRoles, resolvePerson } from "./people";
const id = "4f8a8e29-a192-467c-88b0-cab1510f1812";
beforeEach(() => vi.resetAllMocks());
describe("shared person routes", () => {
  it("validates UUIDs and safely forms profile URLs", () => {
    expect(personId(id.toUpperCase())).toBe(id);
    expect(personId("Q1")).toBeNull();
    expect(personId("../" + id)).toBeNull();
    expect(personHref(id)).toBe(`/explore/people/${id}`);
  });
  it("loads a bounded mixed filmography page", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(Response.json({ items: [] }));
    await getPerson(id, 2);
    expect(httpClient.get).toHaveBeenCalledWith(`/api/people/${id}?page=2&limit=24`);
  });
  it("keeps legacy QID resolution distinct from source failure", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(Response.json({ id }));
    expect(await resolvePerson("Q123")).toEqual({ id });
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await resolvePerson("Q999")).toBeNull();
    vi.mocked(httpClient.get).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(resolvePerson("Q123")).rejects.toThrow("503");
  });
  it("avoids network calls for malformed identities", async () => {
    expect(await getPerson("Q1")).toBeNull();
    expect(await resolvePerson("Q1/other")).toBeNull();
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
describe("film and TV credit display", () => {
  const film = { kind: "film" as const, id, slug: "film-with-a-slash/", title: "Film", releaseYear: 2020,
    roles: ["cast" as const, "director" as const], characters: ["Character"], voice: false, self: false };
  it("links each media kind to its public detail", () => {
    expect(personCreditHref(film)).toBe("/explore/movies/film-with-a-slash%2F");
    expect(personCreditHref({ ...film, kind: "tv_series", id: 1 })).toBe("/explore/tv-series/1");
  });
  it("keeps the character, additional work roles and voice/self flags", () => {
    expect(personCreditRoles(film)).toBe("Director · Character");
    expect(personCreditRoles({ ...film, roles: ["cast"], characters: [], voice: true, self: true })).toBe("Cast · Voice · Self");
  });
});
