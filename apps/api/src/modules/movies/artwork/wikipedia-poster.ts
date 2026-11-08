import { attributionText, commonsFileName, normalizeCommonsPoster, reusablePosterCredit, safeWikimediaUrl, type MoviePoster } from "./commons-poster";
import { hasConflictingSequelNumber } from "./poster-title";

export type WikipediaArticleCandidate = { wikidataId: string; article: string; title: string };
export type WikipediaPosterReference = WikipediaArticleCandidate & { fileName: string };

export function wikipediaArticleTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/_/g, " ").trim().normalize("NFC");
  return title.length > 0 && title.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}]/.test(title) &&
    !/^(?:File|Image|Category|Wikipedia|Template|Help|Special|User|Talk|Portal|Module|Draft):/i.test(title) ? title : null;
}

function pagesAndAliases(data: unknown) {
  const body = data as any;
  if (!body || body.error || body.warnings || !Array.isArray(body.query?.pages) ||
    (body.continue && Object.keys(body.continue).some((key) => !["iistart", "continue"].includes(key)))) throw new Error("wikipedia_incomplete_response");
  const redirects = new Map<string, string>();
  for (const row of [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])]) {
    if (typeof row.from !== "string" || typeof row.to !== "string") throw new Error("wikipedia_invalid_redirect");
    if (row.from !== row.to) redirects.set(row.from, row.to);
  }
  const canonical = (title: string) => {
    const seen = new Set<string>();
    while (redirects.has(title)) {
      if (seen.has(title)) throw new Error("wikipedia_redirect_cycle");
      seen.add(title);
      title = redirects.get(title)!;
    }
    return title;
  };
  return { pages: body.query.pages as any[], canonical };
}

/** Article identity comes from the exact Wikidata sitelink and the returned QID, never title matching. */
export function wikipediaPosterReferences(data: unknown, requested: WikipediaArticleCandidate[]): Record<string, WikipediaPosterReference | null> {
  const { pages, canonical } = pagesAndAliases(data);
  const result: Record<string, WikipediaPosterReference | null> = {};
  for (const candidate of requested) {
    const page = pages.find((row) => row.title === canonical(candidate.article));
    if (!page) throw new Error("wikipedia_missing_article_response");
    const fileName = commonsFileName(page.pageimage);
    result[candidate.wikidataId] = !page.missing && page.ns === 0 && page.pageprops?.wikibase_item === candidate.wikidataId && fileName &&
      !hasConflictingSequelNumber(candidate.title, page.title)
      ? { ...candidate, article: page.title, fileName } : null;
  }
  return result;
}

/** PageImages can pick a still/logo. Require an explicit film-poster metadata category. */
export function normalizeWikipediaPoster(info: unknown): MoviePoster | null {
  if (!info || typeof info !== "object") return null;
  const row = info as any;
  const metadata = row.extmetadata;
  const categories = typeof metadata?.Categories?.value === "string" ? metadata.Categories.value.split("|") : [];
  const posterCategory = categories.some((category: string) => {
    const name = attributionText(category)?.toLowerCase() ?? "";
    return !/\b(?:not|missing|requested|needed)\b/.test(name) &&
      (/\bfilm posters$/.test(name) || /^film posters (?:for|by|of)\b/.test(name));
  });
  if (!posterCategory || !["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/tiff"].includes(row.mime)) return null;
  // An article may select reusable Commons art even without a P3383 claim.
  const commons = normalizeCommonsPoster(info);
  if (commons) return { ...commons, attribution: { ...commons.attribution, provider: "commons", rightsKind: "reusable" } };
  const sourceUrl = safeWikimediaUrl(row.descriptionurl, "en.wikipedia.org", "/wiki/File:");
  const imageUrl = safeWikimediaUrl(row.thumburl, "upload.wikimedia.org", "/wikipedia/en/") ??
    safeWikimediaUrl(row.thumburl, "thumb.wikimedia.org", "/wikipedia/en/thumb/");
  if (!sourceUrl || !imageUrl || attributionText(metadata.Restrictions?.value)) return null;
  const reusable = reusablePosterCredit(metadata);
  if (reusable) return { imageUrl, attribution: { ...reusable, sourceUrl, provider: "wikipedia", rightsKind: "reusable" } };
  // Non-free (fair-use) files are never usable: only freely licensed artwork may be shown.
  return null;
}

export function wikipediaPostersResponse(data: unknown, requested: WikipediaPosterReference[]): Record<string, MoviePoster | null> {
  const { pages, canonical } = pagesAndAliases(data);
  const result: Record<string, MoviePoster | null> = {};
  for (const candidate of requested) {
    const page = pages.find((row) => row.title === canonical(`File:${candidate.fileName}`));
    if (!page) throw new Error("wikipedia_missing_file_response");
    if (page.missing) { result[candidate.wikidataId] = null; continue; }
    if (page.ns !== 6 || !Array.isArray(page.imageinfo) || page.imageinfo.length !== 1) throw new Error("wikipedia_incomplete_file_response");
    const poster = normalizeWikipediaPoster(page.imageinfo[0]);
    result[candidate.wikidataId] = poster ? { ...poster, attribution: { ...poster.attribution, articleTitle: candidate.article }, fileName: candidate.fileName, origin: "wikipedia" } : null;
  }
  return result;
}
