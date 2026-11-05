import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameRelationItem } from "./types";

const actions = vi.hoisted(() => ({
  linkGameRelationAction: vi.fn(),
  unlinkGameRelationAction: vi.fn(),
}));

vi.mock("./actions", () => actions);

import { toggleRelation } from "./relations";

const rpg: GameRelationItem = { id: "g1", name: "RPG", slug: "rpg" };
const action: GameRelationItem = { id: "g2", name: "Action", slug: "action" };

function setup(selected: GameRelationItem[], gameId: string | null = "game-1") {
  const setSelected = vi.fn();
  const setError = vi.fn();
  return { selected, setSelected, setError, gameId, relationType: "genres" as const };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("toggleRelation", () => {
  it("only updates local state when the game isn't saved yet", async () => {
    const input = setup([rpg], null);

    await toggleRelation({ ...input, relation: action });

    expect(input.setSelected).toHaveBeenCalledWith([rpg, action]);
    expect(actions.linkGameRelationAction).not.toHaveBeenCalled();
    expect(actions.unlinkGameRelationAction).not.toHaveBeenCalled();
  });

  it("adds and links an unselected relation", async () => {
    const input = setup([rpg]);
    actions.linkGameRelationAction.mockResolvedValue({ success: true });

    await toggleRelation({ ...input, relation: action });

    expect(input.setSelected).toHaveBeenCalledTimes(1);
    expect(input.setSelected).toHaveBeenCalledWith([rpg, action]);
    expect(actions.linkGameRelationAction).toHaveBeenCalledWith("game-1", "genres", "g2");
    expect(input.setError).not.toHaveBeenCalled();
  });

  it("removes and unlinks a selected relation (matched by id)", async () => {
    const input = setup([rpg, action]);
    actions.unlinkGameRelationAction.mockResolvedValue({ success: true });

    await toggleRelation({ ...input, relation: { ...rpg, name: "Renamed" } });

    expect(input.setSelected).toHaveBeenCalledWith([action]);
    expect(actions.unlinkGameRelationAction).toHaveBeenCalledWith("game-1", "genres", "g1");
    expect(actions.linkGameRelationAction).not.toHaveBeenCalled();
  });

  it("rolls back and shows the action's error on failure", async () => {
    const input = setup([rpg]);
    actions.linkGameRelationAction.mockResolvedValue({ error: "Genre not found." });

    await toggleRelation({ ...input, relation: action });

    expect(input.setSelected.mock.calls).toEqual([[[rpg, action]], [[rpg]]]);
    expect(input.setSelected.mock.calls[1][0]).toBe(input.selected);
    expect(input.setError).toHaveBeenCalledWith("Genre not found.");
  });

  it("falls back to a generic message naming the singular relation type", async () => {
    const input = { ...setup([rpg]), relationType: "developers" as const };
    actions.unlinkGameRelationAction.mockResolvedValue({ error: "" });

    await toggleRelation({ ...input, relation: rpg });

    expect(input.setSelected.mock.calls).toEqual([[[]], [[rpg]]]);
    expect(input.setError).toHaveBeenCalledWith("Failed to link/unlink developer.");
  });
});
