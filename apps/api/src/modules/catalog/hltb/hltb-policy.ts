import { createHash } from "node:crypto";
import { ConflictError } from "../../../shared/http-errors";
import { normalizeTitle, type HltbPopularityGame, type ImportedTimes } from "../import/import.types";
import type { ApplyInput, Candidate, HltbGame, LookupReceipt } from "./hltb.types";

export const HOURS_FIELDS = ["mainHours", "mainExtraHours", "completionistHours"] as const;
export function gameVersion(game: HltbGame): string {
  return createHash("sha256").update(JSON.stringify([game.id, game.title, game.releaseYear, game.hltbId, ...HOURS_FIELDS.map((field) => game.times[field])])).digest("hex");
}
export function candidateDto(game: HltbGame, candidate: HltbPopularityGame): Candidate {
  const warnings: string[] = [];
  if (normalizeTitle(game.title) !== normalizeTitle(candidate.title)) warnings.push("The title differs from this game.");
  if (game.releaseYear && candidate.releaseYear && game.releaseYear !== candidate.releaseYear) warnings.push("The release year differs from this game.");
  if (!candidate.releaseYear) warnings.push("HowLongToBeat does not provide a release year.");
  return { hltbId: candidate.hltbId, title: candidate.title, releaseYear: candidate.releaseYear, times: candidate.times, sourceUrl: `https://howlongtobeat.com/game/${candidate.hltbId}`, warnings };
}
export function assertReceipt(game: HltbGame, receipt: LookupReceipt | null, input: ApplyInput, now = new Date()): asserts receipt is LookupReceipt {
  if (!receipt || receipt.gameId !== game.id || receipt.receiptId !== input.receiptId || receipt.outcome !== "matches" || receipt.expiresAt <= now) throw new ConflictError("err_hltb_receipt_expired");
  if (receipt.expectedVersion !== input.expectedVersion || gameVersion(game) !== input.expectedVersion) throw new ConflictError("err_hltb_game_changed");
  if (!receipt.candidates.some((candidate) => candidate.hltbId === input.hltbId)) throw new ConflictError("err_hltb_candidate_changed");
  if (game.hltbId !== null && game.hltbId !== input.hltbId && !input.replaceMapping) throw new ConflictError("err_hltb_remap_required");
}
export function mergeHours(current: ImportedTimes, source: ImportedTimes, fields: ApplyInput["overwriteFields"] = []): ImportedTimes {
  return Object.fromEntries(HOURS_FIELDS.map((field) => [field, source[field] !== null && (current[field] === null || fields.includes(field)) ? source[field] : current[field]])) as ImportedTimes;
}
export function requiresMismatchAcknowledgement(game: HltbGame, source: HltbPopularityGame): boolean {
  return normalizeTitle(game.title) !== normalizeTitle(source.title) || !!(game.releaseYear && source.releaseYear && game.releaseYear !== source.releaseYear);
}

/** A background popularity refresh may supplement a binding, never rebind it. */
export function acceptBackgroundMapping(gameId: string, candidateId: number, existingId: number | null, ownerGameId: string | null): boolean {
  return (existingId === null || existingId === candidateId) && (ownerGameId === null || ownerGameId === gameId);
}
