import type { TvCastRole, TvPersonIdentity, TvCastPerson } from "./tv-cast.types";
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2147483647;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const date = (value: unknown): string | null => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
function url(value: unknown, type: string, expectedId: number) {
  if (typeof value !== "string") throw new Error("tvmaze_cast_source_url_missing");
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol) || !["www.tvmaze.com", "tvmaze.com"].includes(parsed.hostname) || parsed.username || parsed.password || parsed.port || !new RegExp(`^/${type}/${expectedId}(?:/|$)`).test(parsed.pathname)) throw new Error("tvmaze_cast_identity_mismatch");
  parsed.protocol = "https:"; parsed.hostname = "www.tvmaze.com"; return parsed.href;
}
export function parseTvCast(raw: unknown): TvCastRole[] {
  if (!Array.isArray(raw) || raw.length > 2000) throw new Error("tvmaze_cast_incomplete_snapshot");
  const pairs = new Set<string>(), people = new Map<number, string>();
  return raw.map((row, index) => {
    if (!row || !id(row.person?.id) || !id(row.character?.id) || (row.self != null && typeof row.self !== "boolean") || (row.voice != null && typeof row.voice !== "boolean")) throw new Error("tvmaze_cast_invalid_role");
    const pair = `${row.person.id}:${row.character.id}`;
    if (pairs.has(pair)) throw new Error("tvmaze_cast_duplicate_role");
    pairs.add(pair);
    const person: TvCastPerson = { externalId: row.person.id, name: text(row.person.name), sourceUrl: url(row.person.url, "people", row.person.id),
      birthDate: date(row.person.birthday), deathDate: date(row.person.deathday), gender: text(row.person.gender), country: text(row.person.country?.name),
      sourceUpdatedAt: Number.isSafeInteger(row.person.updated) && row.person.updated > 0 && row.person.updated <= 8640000000000 ? new Date(row.person.updated * 1000) : null };
    const fingerprint = JSON.stringify(person);
    if (people.has(person.externalId) && people.get(person.externalId) !== fingerprint) throw new Error("tvmaze_cast_conflicting_person");
    people.set(person.externalId, fingerprint);
    return { person, characterId: row.character.id, characterName: text(row.character.name), characterSourceUrl: url(row.character.url, "characters", row.character.id), castOrder: index, self: row.self ?? null, voice: row.voice ?? null };
  });
}
export function parseTvPersonIdentities(raw: unknown): TvPersonIdentity[] {
  if (!Array.isArray(raw) || raw.length < 1000 || raw.length > 200000 || raw.some((row) => !row || !id(row.externalId) || !/^Q[1-9]\d{0,20}$/.test(row.qid))) throw new Error("tv_person_identities_incomplete");
  const byId = new Map<number, Set<string>>(), byQid = new Map<string, Set<number>>();
  for (const row of raw as TvPersonIdentity[]) {
    byId.set(row.externalId, (byId.get(row.externalId) ?? new Set()).add(row.qid));
    byQid.set(row.qid, (byQid.get(row.qid) ?? new Set()).add(row.externalId));
  }
  const unique = new Map<number, TvPersonIdentity>();
  for (const row of raw as TvPersonIdentity[]) if (byId.get(row.externalId)!.size === 1 && byQid.get(row.qid)!.size === 1) unique.set(row.externalId, row);
  if (unique.size < 1000) throw new Error("tv_person_identities_incomplete");
  return [...unique.values()];
}
export const exactPersonName = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
export type CastBirthdateCandidate = { seriesId: number; showQid: string; qid: string; name: string; birthDate: string };
export function matchCastBirthdates(shows: { seriesId: number; rows: TvCastRole[] }[], candidates: CastBirthdateCandidate[], filmQids: Set<string>, direct: TvPersonIdentity[]) {
  const showOwners = new Map<number, Set<string>>(), birthdays = new Map<string, Set<string>>();
  const directOwners = new Map(direct.map((row) => [row.qid, row.externalId]));
  for (const row of candidates) {
    showOwners.set(row.seriesId, (showOwners.get(row.seriesId) ?? new Set()).add(row.showQid));
    birthdays.set(row.qid, (birthdays.get(row.qid) ?? new Set()).add(row.birthDate));
  }
  const found = new Map<number, Set<string>>();
  for (const show of shows) for (const { person } of show.rows) {
    if (!person.name || !person.birthDate || showOwners.get(show.seriesId)?.size !== 1) continue;
    for (const candidate of candidates) {
      if (candidate.seriesId !== show.seriesId || candidate.birthDate !== person.birthDate || birthdays.get(candidate.qid)?.size !== 1 || !filmQids.has(candidate.qid) || exactPersonName(candidate.name) !== exactPersonName(person.name)) continue;
      if (directOwners.has(candidate.qid) && directOwners.get(candidate.qid) !== person.externalId) continue;
      found.set(person.externalId, (found.get(person.externalId) ?? new Set()).add(candidate.qid));
    }
  }
  const reverse = new Map<string, Set<number>>();
  for (const [externalId, qids] of found) if (qids.size === 1) { const qid = [...qids][0]; reverse.set(qid, (reverse.get(qid) ?? new Set()).add(externalId)); }
  return new Map([...found].flatMap(([externalId, qids]) => qids.size === 1 && reverse.get([...qids][0])?.size === 1 ? [[externalId, { qid: [...qids][0], method: "show_cast_birthdate" as const }]] : []));
}
