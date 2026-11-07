import "reflect-metadata";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { GetMovieLibraryHandler } from "./library.handler";
import type { IMovieActivityRepository } from "../activity/activity.repository.interface";
import type { IUsersRepository } from "../../auth/users.repository.interface";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../shared/http-errors";
const watch = { id: "private-watch-id", watchedOn: "2026-11-07", comment: "This comment must remain private", createdAt: new Date(), updatedAt: new Date() };
const movie = { slug: "film", title: "Film", releaseDate: null, releaseYear: 2026, runtimeMinutes: 100, posterImageUrl: null, posterAttribution: null };
const request = (viewer?: string) => ({ params: { username: "vefa" }, user: viewer ? { id: viewer } : undefined }) as any;
describe("GetMovieLibraryHandler", () => {
  let users: Record<keyof IUsersRepository, any>, repo: Record<keyof IMovieActivityRepository, any>;
  let user: any;
  beforeEach(() => {
    users = { findById: vi.fn(), findByEmail: vi.fn(), findByUsername: vi.fn(), findByOidcSubject: vi.fn(), linkOidc: vi.fn(), create: vi.fn(), updateLastLogin: vi.fn(), updateProfile: vi.fn(), updateProfileVisibility: vi.fn(), changePasswordAndRevokeOtherSessions: vi.fn() };
    repo = { findPublicMovieId: vi.fn(), getActivity: vi.fn(), createWatch: vi.fn(), updateWatch: vi.fn(), deleteWatch: vi.fn(), setRating: vi.fn(), listLibrary: vi.fn().mockResolvedValue([]), countPublicMovies: vi.fn() };
    user = { id: "owner", username: "vefa", displayName: "Vefa", isActive: true, isProfilePublic: true, email: "private@example.com" };
    users.findByUsername.mockImplementation(async () => user);
  });
  it("counts repeat watches separately from films and averages each film rating once", async () => {
    repo.listLibrary.mockResolvedValue([{ movie, rating: 8, watches: [watch, { ...watch, id: "second" }] }, { movie: { ...movie, slug: "other" }, rating: 10, watches: [] }]);
    const result = await new GetMovieLibraryHandler(users, repo).handle(request());
    expect(result.summary).toEqual({ filmCount: 2, watchedFilmCount: 1, watchCount: 2, ratedFilmCount: 2, averageRating: 9 });
    expect(result.movies[0].watches).toEqual([{ watchedOn: "2026-11-07" }, { watchedOn: "2026-11-07" }]);
    expect(result.user).toEqual({ username: "vefa", displayName: "Vefa", isProfilePublic: true });
    expect(JSON.stringify(result)).not.toContain("This comment must remain private");
    expect(JSON.stringify(result)).not.toContain("private-watch-id"); expect(JSON.stringify(result)).not.toContain("private@example.com");
  });
  it("exposes edit IDs only to the owner even on a private profile", async () => {
    user.isProfilePublic = false; repo.listLibrary.mockResolvedValue([{ movie, rating: null, watches: [watch] }]);
    const result = await new GetMovieLibraryHandler(users, repo).handle(request("owner"));
    expect(JSON.stringify(result)).not.toContain("This comment must remain private");
    expect(result.isOwner).toBe(true); expect(result.movies[0].watches[0].id).toBe(watch.id);
  });
  it.each([[undefined, UnauthorizedError], ["other", ForbiddenError]])("withholds a private profile from %s", async (viewer, error) => {
    user.isProfilePublic = false;
    await expect(new GetMovieLibraryHandler(users, repo).handle(request(viewer as string | undefined))).rejects.toThrow(error as any);
    expect(repo.listLibrary).not.toHaveBeenCalled();
  });
  it.each([null, { isActive: false }])("returns not found for missing or inactive accounts", async (value) => {
    user = value;
    await expect(new GetMovieLibraryHandler(users, repo).handle(request("owner"))).rejects.toThrow(NotFoundError);
    expect(repo.listLibrary).not.toHaveBeenCalled();
  });
  it("returns an empty library without inventing an average", async () => {
    const result = await new GetMovieLibraryHandler(users, repo).handle(request());
    expect(result.summary).toMatchObject({ filmCount: 0, watchCount: 0, averageRating: null });
  });
});
