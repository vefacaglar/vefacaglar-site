import { describe, it, expect, vi } from "vitest";
import { freezeWatchSubmission } from "./watchSubmission";
describe("freezeWatchSubmission", () => {
  it("captures the normalized first submission with a new identity", () => {
    const createId = vi.fn(() => "first-id");
    expect(freezeWatchSubmission(null, { watchedOn: "2026-11-07", comment: "  A good ending.\nWorth revisiting.  " }, createId)).toEqual({ id: "first-id", watchedOn: "2026-11-07", comment: "A good ending.\nWorth revisiting." });
    expect(createId).toHaveBeenCalledOnce();
  });
  it("freezes UUID and original payload across an uncertain retry even if a draft changes", () => {
    const original = freezeWatchSubmission(null, { watchedOn: "2026-11-07", comment: "First thoughts" }, () => "first-id");
    const createId = vi.fn(() => "duplicate-id");
    const retry = freezeWatchSubmission(original, { watchedOn: "2026-11-06", comment: "Changed thoughts" }, createId);
    expect(retry).toBe(original);
    expect(retry).toEqual({ id: "first-id", watchedOn: "2026-11-07", comment: "First thoughts" });
    expect(Object.isFrozen(retry)).toBe(true);
    expect(createId).not.toHaveBeenCalled();
  });
  it("allows a deliberate subsequent watch to receive a fresh identity", () => {
    const draft = { watchedOn: "2026-11-07", comment: "" };
    const first = freezeWatchSubmission(null, draft, () => "first-id");
    const next = freezeWatchSubmission(null, draft, () => "next-id");
    expect(first.comment).toBeNull();
    expect(next.id).not.toBe(first.id);
  });
});
