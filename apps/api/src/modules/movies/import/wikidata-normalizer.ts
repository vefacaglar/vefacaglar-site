import type { EntityLabels, NormalizedMovie, SourceCredit, StatementRank } from "./movie-source.types";
import { commonsFileName } from "../artwork/commons-poster";
import { wikipediaArticleTitle } from "../artwork/wikipedia-poster";
import { commonsCategoryName } from "../artwork/commons-category-poster";

export const isQid = (value: unknown): value is string => typeof value === "string" && /^Q[1-9]\d{0,20}$/.test(value);
export const isImdbId = (value: unknown): value is string => typeof value === "string" && /^tt\d{7,10}$/.test(value);
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === "string" && value.trim() && value.length <= 2000 ? value.trim() : null;
const value = (statement: any): any => statement?.mainsnak?.snaktype === "value" ? statement.mainsnak.datavalue?.value : undefined;
const active = (rows: any[]) => rows.filter((row) => row.rank !== "deprecated");
const best = (rows: any[]) => { const preferred = rows.filter((row) => row.rank === "preferred"); return preferred.length ? preferred : active(rows); };
const qids = (rows: any[]) => [...new Set(active(rows).map((row) => value(row)?.id).filter(isQid))];

export function movieSlug(title: string, qid: string): string {
  const stem = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 210).replace(/-$/, "") || "film";
  return `${stem}-${qid.toLowerCase()}`;
}

export function sourceLabel(entity: unknown): string | null {
  if (!object(entity) || !object(entity.labels)) return null;
  return text(entity.labels.en?.value) ?? Object.values(entity.labels).map((label: any) => text(label?.value)).find(Boolean) ?? null;
}

/** Full sitelink URLs distinguish Wikipedia editions from sibling projects. */
export function wikipediaLanguageCount(sitelinks: unknown): number {
  if (!object(sitelinks)) throw new Error("incomplete_entity_sitelinks");
  const editions = new Set<string>();
  for (const [site, link] of Object.entries(sitelinks)) {
    if (!object(link) || link.site !== site || !text(link.title) || typeof link.url !== "string") throw new Error("invalid_entity_sitelink");
    let url: URL;
    try { url = new URL(link.url); } catch { throw new Error("invalid_entity_sitelink"); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("invalid_entity_sitelink");
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".wikipedia.org")) editions.add(host.replace(/\.m\.wikipedia\.org$/, ".wikipedia.org"));
  }
  if (editions.size >= 1_000_000) throw new Error("invalid_entity_sitelinks_count");
  return editions.size;
}

function statements(claims: Record<string, unknown>, property: string, qid: string): any[] {
  const rows = claims[property];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new Error("invalid_claims");
  const ids = new Set<string>();
  for (const row of rows) {
    if (!object(row) || !object(row.mainsnak) || row.mainsnak.property !== property ||
      !["value", "somevalue", "novalue"].includes(row.mainsnak.snaktype) ||
      !["normal", "preferred", "deprecated"].includes(row.rank) || typeof row.id !== "string" ||
      !new RegExp(`^${qid}\\$[a-z0-9-]+$`, "i").test(row.id) || ids.has(row.id.toLowerCase())) throw new Error("invalid_claims");
    if (row.mainsnak.snaktype === "value" && !object(row.mainsnak.datavalue)) throw new Error("invalid_claims");
    if (row.qualifiers !== undefined && !object(row.qualifiers)) throw new Error("invalid_claims");
    ids.add(row.id.toLowerCase());
  }
  return rows;
}

/** Only complete item/claims responses can replace a relationship snapshot. */
export function normalizeMovie(raw: unknown, expectedQid: string): NormalizedMovie {
  if (!isQid(expectedQid) || !object(raw) || raw.id !== expectedQid || raw.type !== "item" || "missing" in raw || !object(raw.claims)) throw new Error("partial_or_missing_entity");
  // Both info and claims were requested. Without revision metadata this is not
  // a complete snapshot that may replace facts or remove a classification.
  if (!Number.isSafeInteger(raw.lastrevid) || raw.lastrevid <= 0 ||
      typeof raw.modified !== "string" || !Number.isFinite(Date.parse(raw.modified))) throw new Error("incomplete_entity_info");
  if (!object(raw.sitelinks)) throw new Error("incomplete_entity_sitelinks");
  const languageCount = wikipediaLanguageCount(raw.sitelinks);
  const enwikiArticle = raw.sitelinks.enwiki === undefined ? null : wikipediaArticleTitle(raw.sitelinks.enwiki?.title);
  if (raw.sitelinks.enwiki !== undefined && (raw.sitelinks.enwiki?.site !== "enwiki" || !enwikiArticle)) throw new Error("invalid_entity_sitelink");
  const claims = raw.claims;
  const checked = new Map(["P31", "P1476", "P345", "P577", "P2047", "P161", "P57", "P162", "P272", "P136", "P3383", "P373"].map((property) => [property, statements(claims, property, expectedQid)]));
  const all = [...checked.values()].flat();
  if (all.length > 10_000 || new Set(all.map((row) => row.id.toLowerCase())).size !== all.length) throw new Error("invalid_claims");
  for (const property of ["P31", "P272", "P136"]) {
    if (checked.get(property)!.some((row) => row.mainsnak.snaktype === "value" && !isQid(value(row)?.id))) throw new Error("invalid_entity_reference");
  }
  const originalTitle = best(checked.get("P1476")!).map((row) => text(value(row)?.text)).find(Boolean) ?? null;
  const title = sourceLabel(raw) ?? originalTitle;
  if (!title) throw new Error("title_missing");
  const imdbIds = [...new Set(best(checked.get("P345")!).map(value).filter(isImdbId))];
  const posters = [...new Set(best(checked.get("P3383")!).map((row) => commonsFileName(value(row))).filter((file): file is string => file !== null))];
  const commonsCategories = [...new Set(best(checked.get("P373")!).map((row) => commonsCategoryName(value(row))).filter((name): name is string => name !== null))];
  const dates = best(checked.get("P577")!).flatMap((row) => {
    const time = value(row);
    if (!object(time) || typeof time.time !== "string" || !Number.isInteger(time.precision) || time.precision < 9 ||
      time.calendarmodel !== "http://www.wikidata.org/entity/Q1985727") return [];
    const match = /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(time.time);
    if (!match || Number(match[1]) === 0) return [];
    const year = Number(match[1]);
    const exact = `${match[1]}-${match[2]}-${match[3]}`;
    const date = time.precision >= 11 && Number(match[2]) > 0 && Number(match[3]) > 0 &&
      Number.isFinite(Date.parse(exact)) && new Date(exact).toISOString().slice(0, 10) === exact ? exact : null;
    if (time.precision >= 11 && !date) return [];
    return [{ year, date, precision: time.precision, order: `${match[1]}-${time.precision >= 10 ? match[2] : "00"}-${time.precision >= 11 ? match[3] : "00"}` }];
  }).sort((a, b) => a.order.localeCompare(b.order));
  const runtimes = [...new Set(best(checked.get("P2047")!).flatMap((row) => {
    const quantity = value(row);
    const amount = Number(quantity?.amount);
    return quantity?.unit === "http://www.wikidata.org/entity/Q7727" && Number.isFinite(amount) && amount > 0 && amount <= 100_000 ? [amount] : [];
  }))];
  const credits: SourceCredit[] = [];
  for (const roleProperty of ["P161", "P57", "P162"] as const) {
    for (const row of checked.get(roleProperty)!) {
      const personQid = value(row)?.id;
      if (row.mainsnak.snaktype === "value" && !isQid(personQid)) throw new Error("invalid_credit_reference");
      if (!isQid(personQid)) continue;
      const qualifiers = row.qualifiers ?? {};
      const qualifierValue = (snak: any) => snak?.snaktype === "value" ? snak.datavalue?.value : undefined;
      credits.push({ statementId: row.id.toLowerCase(), personQid, roleProperty, rank: row.rank as StatementRank, qualifiers,
        characterNames: (Array.isArray(qualifiers.P4633) ? qualifiers.P4633 : []).map(qualifierValue).map(text).filter((name: string | null): name is string => !!name),
        characterQids: characterQidsFromQualifiers(qualifiers),
      });
    }
  }
  const modified = typeof raw.modified === "string" && Number.isFinite(Date.parse(raw.modified)) ? new Date(raw.modified) : null;
  return { wikidataId: expectedQid, title, originalTitle, description: text(raw.descriptions?.en?.value),
    imdbId: imdbIds.length === 1 ? imdbIds[0] : null, imdbConflict: imdbIds.length > 1,
    posterFileName: posters.sort()[0] ?? null,
    commonsCategory: commonsCategories.sort()[0] ?? null,
    enwikiArticle, wikipediaLanguageCount: languageCount,
    releaseDate: dates[0]?.date ?? null, releaseYear: dates[0]?.year ?? null, releasePrecision: dates[0]?.precision ?? null,
    runtimeMinutes: runtimes.length === 1 ? runtimes[0] : null,
    isFilm: qids(best(checked.get("P31")!)).includes("Q11424"),
    sourceRevision: Number.isSafeInteger(raw.lastrevid) && raw.lastrevid > 0 ? raw.lastrevid : null,
    sourceModifiedAt: modified, credits, companyQids: qids(checked.get("P272")!), genreQids: qids(checked.get("P136")!) };
}

export function supportingQids(movie: NormalizedMovie): string[] {
  return [...new Set([...movie.companyQids, ...movie.genreQids, ...movie.credits.flatMap((credit) => [credit.personQid, ...credit.characterQids])])];
}
export function addCharacterLabels(movie: NormalizedMovie, labels: EntityLabels): NormalizedMovie {
  return { ...movie, credits: movie.credits.map((credit) => ({ ...credit,
    characterNames: [...new Set([...credit.characterNames, ...credit.characterQids.map((qid) => labels[qid]).filter((name): name is string => !!name)])],
  })) };
}

/** Explicit character references remain resolvable after an initially missing label arrives. */
export function characterQidsFromQualifiers(qualifiers: unknown): string[] {
  if (!object(qualifiers) || !Array.isArray(qualifiers.P453)) return [];
  return [...new Set(qualifiers.P453.filter((snak: any) => snak?.snaktype === "value")
    .map((snak: any) => snak.datavalue?.value?.id).filter(isQid))];
}

/** Equal revisions normally avoid rewrites, but an IMDb ownership conflict may clear later. */
export function movieSnapshotDisposition(incoming: number | null, stored: number | null, hydrated: boolean, imdbConflict: boolean): "replace" | "unchanged" {
  if (incoming === null || !Number.isSafeInteger(incoming) || incoming <= 0) throw new Error("incomplete_entity_info");
  if (stored !== null && incoming < stored) throw new Error("stale_source_revision");
  return hydrated && incoming === stored && !imdbConflict ? "unchanged" : "replace";
}
