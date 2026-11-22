import { MAX_COMPLETION_SECONDS } from "./completion-times-quality";
import type { CompletionIdentity, CompletionReport } from "./completion-sources.types";

export function completionSeconds(value: unknown, factor = 1): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const seconds = Math.round(value * factor);
  return seconds > 0 && seconds <= MAX_COMPLETION_SECONDS ? seconds : null;
}

/** Exact external identifier links, with ambiguous editions and collisions excluded. */
export function parseCompletionMappings(raw: unknown): { slug: string; wikidataId: string; ifdbId?: string; vndbId?: string }[] {
  const rows = (raw as any)?.results?.bindings;
  if (!Array.isArray(rows) || rows.length > 20_000) throw new Error("completion_identity_map_invalid");
  const candidates: { slug: string; wikidataId: string; ifdbId?: string; vndbId?: string }[] = [];
  const owners = new Map<string, Set<string>>();
  const values = new Map<string, Set<string>>();
  const qids = new Map<string, Set<string>>();
  for (const row of rows) {
    const slug = row?.igdb?.value;
    const wikidataId = row?.item?.value?.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9][0-9]*)$/)?.[1];
    if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug) || !wikidataId) continue;
    const ifdbId = /^[a-z0-9]{16}$/.test(row.ifdb?.value ?? "") ? row.ifdb.value : undefined;
    const vndbId = /^v[1-9][0-9]*$/.test(row.vndb?.value ?? "") ? row.vndb.value : undefined;
    candidates.push({ slug, wikidataId, ifdbId, vndbId });
    qids.set(slug, new Set([...(qids.get(slug) ?? []), wikidataId]));
    for (const [provider, externalId] of [["ifdb", ifdbId], ["vndb", vndbId]]) {
      if (!externalId) continue;
      const ownerKey = `${provider}:${externalId}`;
      const valueKey = `${provider}:${slug}`;
      owners.set(ownerKey, new Set([...(owners.get(ownerKey) ?? []), slug]));
      values.set(valueKey, new Set([...(values.get(valueKey) ?? []), externalId]));
    }
  }
  return [...new Map(candidates.map((candidate) => {
    const safe = { ...candidate };
    for (const provider of ["ifdb", "vndb"] as const) {
      const key = provider === "ifdb" ? "ifdbId" : "vndbId";
      const id = safe[key];
      if (id && (owners.get(`${provider}:${id}`)!.size !== 1 || values.get(`${provider}:${safe.slug}`)!.size !== 1)) delete safe[key];
    }
    return [`${safe.wikidataId}:${safe.slug}`, safe] as const;
  })).values()].filter((row) => qids.get(row.slug)?.size === 1 && (row.ifdbId || row.vndbId));
}

export function backloggdAllowed(robots: string, slug: string): boolean {
  if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug)) return false;
  let agents: string[] = [];
  let readingRules = false;
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.split("#")[0].trim();
    const pair = /^([a-z-]+)\s*:\s*(.*)$/i.exec(clean);
    if (!pair) continue;
    if (pair[1].toLowerCase() === "user-agent") {
      if (readingRules || !groups.length) { agents = []; groups.push({ agents, rules: [] }); readingRules = false; }
      agents.push(pair[2].toLowerCase());
    } else if (["allow", "disallow"].includes(pair[1].toLowerCase()) && groups.length) {
      readingRules = true;
      if (pair[2]) groups[groups.length - 1].rules.push({ allow: pair[1].toLowerCase() === "allow", path: pair[2] });
    }
  }
  const specific = groups.filter((group) => group.agents.some((agent) => agent !== "*" && "vefalibrary".includes(agent)));
  const applicable = specific.length ? specific : groups.filter((group) => group.agents.includes("*"));
  const path = `/games/${slug}/`;
  const rules = applicable.flatMap((group) => group.rules).filter((rule) => {
    const anchored = rule.path.endsWith("$");
    const pattern = anchored ? rule.path.slice(0, -1) : rule.path;
    const regex = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

export function parseBackloggd(html: string, identity: CompletionIdentity, at: Date): CompletionReport | null {
  if (/cf-chl-|Just a moment\.\.\./i.test(html)) throw new Error("backloggd_challenge");
  const links = [...html.matchAll(/href=["']https:\/\/(?:www\.)?igdb\.com\/games\/([^"'?#/]+)\/?["']/g)].map((match) => match[1]);
  if (!links.length) throw new Error("backloggd_identity_unverified");
  if (links.some((slug) => slug !== identity.slug)) throw new Error("backloggd_identity_mismatch");
  const values = new Map<string, number>();
  const pattern = /<p\b[^>]*class=["'][^"']*\bstat-value\b[^"']*\belement-revealed\b[^"']*["'][^>]*>((?:(?!<\/p>)[\s\S]){0,160})<\/p>\s*(?:<p\b[^>]*>\s*Hidden\s*<\/p>\s*)?<p\b[^>]*class=["'][^"']*\blabel\b[^"']*["'][^>]*>\s*(to finish|to master)\s*<\/p>/gi;
  for (const match of html.matchAll(pattern)) {
    let seconds = 0;
    const units = [...match[1].matchAll(/([0-9]+(?:\.[0-9]+)?)\s*<small>\s*(h|m)\s*<\/small>/g)];
    for (const unit of units) seconds += Number(unit[1]) * (unit[2] === "h" ? 3600 : 60);
    const valid = completionSeconds(seconds);
    if (valid === null) continue;
    const previous = values.get(match[2].toLowerCase());
    if (previous !== undefined && previous !== valid) throw new Error("backloggd_conflicting_public_values");
    values.set(match[2].toLowerCase(), valid);
  }
  const finishSeconds = values.get("to finish") ?? null;
  const masterSeconds = values.get("to master") ?? null;
  if (finishSeconds === null && masterSeconds === null) return null;
  if (finishSeconds !== null && masterSeconds !== null && finishSeconds > masterSeconds) return null;
  return { provider: "backloggd", sourceUrl: `https://backloggd.com/games/${identity.slug}/`, scope: "All editions reported on Backloggd",
    statistic: "reported", finishSeconds, masterSeconds, playtimeSeconds: null, sampleCount: null, sourceUpdatedAt: null, fetchedAt: at.toISOString() };
}

export function parseIfdb(raw: unknown, identity: CompletionIdentity, at: Date): CompletionReport | null {
  const games = (raw as any)?.games;
  if (!Array.isArray(games) || games.length > 1 || games.some((game) => game?.tuid !== identity.ifdbId)) throw new Error("ifdb_identity_mismatch");
  const finishSeconds = completionSeconds(games[0]?.playTimeInMinutes, 60);
  if (finishSeconds === null) return null;
  return { provider: "ifdb", sourceUrl: `https://ifdb.org/viewgame?id=${identity.ifdbId}`, scope: "One final ending, without hints or a walkthrough",
    statistic: "median_finish", finishSeconds, masterSeconds: null, playtimeSeconds: null, sampleCount: null, sourceUpdatedAt: null, fetchedAt: at.toISOString() };
}

export function parseVndb(raw: unknown, identities: CompletionIdentity[], at: Date): Map<number, CompletionReport | null> {
  const rows = (raw as any)?.results;
  if (!Array.isArray(rows) || (raw as any).more !== false || rows.length > identities.length) throw new Error("vndb_incomplete_batch");
  const expected = new Map(identities.map((identity) => [identity.vndbId, identity]));
  const result = new Map<number, CompletionReport | null>();
  const seen = new Set<string>();
  for (const row of rows) {
    const identity = expected.get(row?.id);
    if (!identity || seen.has(row.id)) throw new Error("vndb_identity_mismatch");
    seen.add(row.id);
    const links = Array.isArray(row.extlinks) ? row.extlinks : [];
    const igdbLinks = links.filter((link: any) => link.name === "igdb_game");
    const wikidataLinks = links.filter((link: any) => link.name === "wikidata");
    if (igdbLinks.some((link: any) => link.id !== identity.slug) || wikidataLinks.some((link: any) => `Q${link.id}` !== identity.wikidataId)) {
      result.set(identity.igdbId, null);
      continue;
    }
    const playtimeSeconds = completionSeconds(row.length_minutes, 60);
    if (playtimeSeconds === null || !Number.isSafeInteger(row.length_votes) || row.length_votes < 1) continue;
    result.set(identity.igdbId, { provider: "vndb", sourceUrl: `https://vndb.org/${identity.vndbId}`, scope: "Visual novel entry, across releases",
      statistic: "average_playtime", finishSeconds: null, masterSeconds: null, playtimeSeconds, sampleCount: row.length_votes,
      sourceUpdatedAt: null, fetchedAt: at.toISOString() });
  }
  return result;
}
