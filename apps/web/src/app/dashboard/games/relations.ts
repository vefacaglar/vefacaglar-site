import { GameRelationItem, RelationKind } from "./types";
import { linkGameRelationAction, unlinkGameRelationAction } from "./actions";
import ds from "../../../lib/dashboard-strings";

export interface ToggleRelationInput {
  relation: GameRelationItem;
  selected: GameRelationItem[];
  setSelected: (next: GameRelationItem[]) => void;
  relationType: RelationKind;
  gameId: string | null;
  setError: (msg: string) => void;
}

/**
 * Optimistic relation toggle.
 * - If `gameId` is null (creating a new game), only the local state is updated.
 * - Otherwise the toggle is persisted via the link/unlink server actions and
 *   rolled back on failure.
 */
export async function toggleRelation({
  relation,
  selected,
  setSelected,
  relationType,
  gameId,
  setError,
}: ToggleRelationInput): Promise<void> {
  const isSelected = selected.some((s) => s.id === relation.id);
  const next = isSelected
    ? selected.filter((s) => s.id !== relation.id)
    : [...selected, relation];

  setSelected(next);

  if (!gameId) return;

  const res = isSelected
    ? await unlinkGameRelationAction(gameId, relationType, relation.id)
    : await linkGameRelationAction(gameId, relationType, relation.id);

  if ("error" in res) {
    setSelected(selected);
    setError(res.error || ds.games.errors.linkFailed.replace("{relationType}", relationType.slice(0, -1)));
  }
}
