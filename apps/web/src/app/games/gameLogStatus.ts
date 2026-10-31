import type { Dictionary } from "../../dictionaries";
import type { GameLogInput } from "./actions";

// Kept outside the "use client" components so server pages can use it too.

export const GAME_LOG_STATUSES: GameLogInput["status"][] = ["playing", "completed", "backlog", "on_hold", "abandoned"];

export function statusLabel(dict: Dictionary, status: GameLogInput["status"]): string {
  return dict[`status_${status}` as const];
}
