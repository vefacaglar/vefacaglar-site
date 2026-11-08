import type { GameWithRelations } from "../../catalog/games.repository.interface";
import { BadRequestError } from "../../../shared/http-errors";
import type { GameLogRow, NewGameLog } from "../game-logs.repository.interface";
import type { GameLogBody } from "./game-log.schema";
import { isFutureLogDate, validateLogDate } from "../../../shared/log-dates";

/** Validates a log body against its game and converts it to column values. */
export function toGameLogValues(body: GameLogBody, game: GameWithRelations, previous?: Pick<GameLogRow, "startedAt" | "completedAt">): Partial<NewGameLog> {
  if (body.reviewText != null && Array.from(body.reviewText).length > 2000) {
    throw new BadRequestError("err_game_review_length");
  }
  const platformId = body.platformId ?? null;
  if (platformId && !game.platforms.some((p) => p.id === platformId)) {
    throw new BadRequestError("This game is not available on the selected platform.");
  }
  const now = new Date();
  const startedAt = validateLogDate(body.startedAt, previous?.startedAt, now);
  const completedAt = validateLogDate(body.completedAt, previous?.completedAt, now);
  if (startedAt && completedAt && completedAt < startedAt) {
    throw new BadRequestError("Completion date cannot be before the start date.");
  }

  return {
    status: body.status,
    platformId,
    rating: body.rating ?? null,
    ...(startedAt != null && startedAt === previous?.startedAt && isFutureLogDate(startedAt, now) ? {} : { startedAt }),
    ...(completedAt != null && completedAt === previous?.completedAt && isFutureLogDate(completedAt, now) ? {} : { completedAt }),
    playtimeHours: body.playtimeHours == null ? null : String(body.playtimeHours),
    notes: body.notes?.trim() || null,
    ...(body.reviewText === undefined ? {} : { reviewText: body.reviewText?.trim() || null }),
  };
}
