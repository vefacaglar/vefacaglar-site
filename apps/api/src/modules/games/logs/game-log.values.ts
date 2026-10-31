import type { GameWithRelations } from "../../catalog/games.repository.interface";
import { BadRequestError } from "../../../shared/http-errors";
import type { NewGameLog } from "../game-logs.repository.interface";
import type { GameLogBody } from "./game-log.schema";

/** Validates a log body against its game and converts it to column values. */
export function toGameLogValues(body: GameLogBody, game: GameWithRelations): Partial<NewGameLog> {
  const platformId = body.platformId ?? null;
  if (platformId && !game.platforms.some((p) => p.id === platformId)) {
    throw new BadRequestError("This game is not available on the selected platform.");
  }
  const startedAt = body.startedAt ?? null;
  const completedAt = body.completedAt ?? null;
  if (startedAt && completedAt && completedAt < startedAt) {
    throw new BadRequestError("Completion date cannot be before the start date.");
  }

  return {
    status: body.status,
    platformId,
    rating: body.rating ?? null,
    startedAt,
    completedAt,
    playtimeHours: body.playtimeHours == null ? null : String(body.playtimeHours),
    notes: body.notes?.trim() || null,
  };
}
