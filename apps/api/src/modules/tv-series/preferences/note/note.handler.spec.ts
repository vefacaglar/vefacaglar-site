import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { SetTvNoteHandler } from "./note.handler";
import type { ITvPreferencesRepository } from "../preferences.repository.interface";
const request = (note: unknown) => ({ params: { id: 1 }, user: { id: "owner" }, body: { note, expectedVersion: 2 } }) as any;
describe("private TV personal note", () => {
  it.each([["  My note  ", "My note"], ["  ", null], [null, null]])("normalizes and saves %s", async (note, saved) => {
    const preferences = { rating: 8, note: saved, ratingVersion: 1, noteVersion: 3 };
    const repo = { setNote: vi.fn().mockResolvedValue({ kind: "saved", preferences }) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    expect(await new SetTvNoteHandler(repo).handle(request(note))).toEqual(preferences);
    expect(repo.setNote).toHaveBeenCalledWith("owner", 1, saved, 2);
  });
  it.each([undefined, 123, "x".repeat(2001)])("rejects an invalid note", async (note) => {
    const repo = { setNote: vi.fn() } as unknown as Record<keyof ITvPreferencesRepository, any>;
    await expect(new SetTvNoteHandler(repo).handle(request(note))).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.setNote).not.toHaveBeenCalled();
  });
  it.each([["missing", 404], ["conflict", 409]])("maps %s to HTTP %s", async (kind, statusCode) => {
    const repo = { setNote: vi.fn().mockResolvedValue({ kind }) } as unknown as Record<keyof ITvPreferencesRepository, any>;
    await expect(new SetTvNoteHandler(repo).handle(request("note"))).rejects.toMatchObject({ statusCode });
  });
});
