import type { TvShowSource, TvSeasonSource, TvEpisodeSource, TvHierarchy } from "./tvmaze.types";

const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2147483647;
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const minutes = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100000 ? value : null;
const ordinal = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
export function tvRating(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
export function tvPlainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return text(value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? " ";
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }).replace(/\s+/g, " "));
}
function sourceUrl(value: unknown, kind: string, id: number): string {
  if (typeof value !== "string") throw new Error("tvmaze_missing_source_url");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("tvmaze_invalid_source_url"); }
  if (!["www.tvmaze.com", "tvmaze.com"].includes(url.hostname) || !["https:", "http:"].includes(url.protocol) ||
    !new RegExp(`^/${kind}/${id}(?:/|$)`).test(url.pathname)) throw new Error("tvmaze_identity_mismatch");
  url.protocol = "https:";
  url.hostname = "www.tvmaze.com";
  return url.href;
}
export function parseTvShow(raw: any): TvShowSource {
  if (!raw || !positiveId(raw.id) || !text(raw.name) || !Array.isArray(raw.genres) ||
    raw.genres.some((genre: unknown) => !text(genre) || String(genre).length > 120)) throw new Error("tvmaze_invalid_show");
  const sourceUpdatedAt = Number.isSafeInteger(raw.updated) && raw.updated > 0 && raw.updated <= 8640000000000 ? new Date(raw.updated * 1000) : null;
  const previous = raw._links?.previousepisode?.href?.match(/^https:\/\/api\.tvmaze\.com\/episodes\/([1-9][0-9]*)$/);
  let officialSite = text(raw.officialSite);
  if (officialSite && !/^https?:\/\//.test(officialSite)) officialSite = null;
  return { id: raw.id, name: raw.name.trim(), summary: tvPlainText(raw.summary), premiered: date(raw.premiered), ended: date(raw.ended),
    status: text(raw.status), type: text(raw.type), language: text(raw.language), runtime: minutes(raw.runtime), averageRuntime: minutes(raw.averageRuntime),
    network: text(raw.network?.name), webChannel: text(raw.webChannel?.name), rating: tvRating(raw.rating?.average),
    sourceUrl: sourceUrl(raw.url, "shows", raw.id), officialSite, sourceUpdatedAt,
    genres: [...new Set<string>(raw.genres.map((genre: string) => genre.trim()))], previousEpisodeId: previous ? Number(previous[1]) : null };
}
export function parseTvPage(raw: unknown, page: number): TvShowSource[] {
  if (!Number.isSafeInteger(page) || page < 0 || !Array.isArray(raw) || raw.length > 250) throw new Error("tvmaze_invalid_index_page");
  const rows = raw.map(parseTvShow);
  const ids = rows.map((show) => show.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => Math.floor(id / 250) !== page)) throw new Error("tvmaze_invalid_index_identity");
  return rows;
}
export function parseTvHierarchy(show: TvShowSource, seasonsRaw: unknown, episodesRaw: unknown): TvHierarchy {
  if (!Array.isArray(seasonsRaw) || !Array.isArray(episodesRaw) || seasonsRaw.length > 2000 || episodesRaw.length > 100000) throw new Error("tvmaze_incomplete_hierarchy");
  const seasons: TvSeasonSource[] = seasonsRaw.map((raw) => {
    if (!raw || !positiveId(raw.id)) throw new Error("tvmaze_invalid_season");
    return { id: raw.id, seriesId: show.id, number: ordinal(raw.number), name: text(raw.name), summary: tvPlainText(raw.summary),
      premiered: date(raw.premiereDate), ended: date(raw.endDate), episodeOrder: ordinal(raw.episodeOrder),
      network: text(raw.network?.name) ?? text(raw.webChannel?.name), sourceUrl: sourceUrl(raw.url, "seasons", raw.id) };
  });
  if (new Set(seasons.map((season) => season.id)).size !== seasons.length) throw new Error("tvmaze_duplicate_season");
  const byNumber = new Map<number, number>();
  for (const season of seasons) {
    if (season.number === null) continue;
    if (byNumber.has(season.number)) throw new Error("tvmaze_ambiguous_season");
    byNumber.set(season.number, season.id);
  }
  const episodes: TvEpisodeSource[] = episodesRaw.map((raw) => {
    if (!raw || !positiveId(raw.id) || !["regular", "significant_special", "insignificant_special"].includes(raw.type)) throw new Error("tvmaze_invalid_episode");
    const showLink = raw._links?.show?.href;
    if (showLink && showLink !== `https://api.tvmaze.com/shows/${show.id}`) throw new Error("tvmaze_episode_series_mismatch");
    const isSpecial = raw.type !== "regular";
    const seasonNumber = ordinal(raw.season);
    const seasonId = seasonNumber === null ? null : byNumber.get(seasonNumber) ?? null;
    if (!isSpecial && seasonId === null) throw new Error("tvmaze_orphan_regular_episode");
    const stamp = typeof raw.airstamp === "string" ? new Date(raw.airstamp) : null;
    return { id: raw.id, seriesId: show.id, seasonId, seasonNumber, number: ordinal(raw.number), name: text(raw.name), summary: tvPlainText(raw.summary),
      type: raw.type, isSpecial, airdate: date(raw.airdate), airstamp: stamp && Number.isFinite(stamp.getTime()) ? stamp : null,
      runtime: minutes(raw.runtime), rating: tvRating(raw.rating?.average), sourceUrl: sourceUrl(raw.url, "episodes", raw.id) };
  });
  if (new Set(episodes.map((episode) => episode.id)).size !== episodes.length ||
    (show.previousEpisodeId && !episodes.some((episode) => episode.id === show.previousEpisodeId))) throw new Error("tvmaze_incomplete_episode_snapshot");
  return { show, seasons, episodes };
}
