import { hasConflictingSequelNumber } from "./poster-title";

export type PosterAttribution = {
  provider?: "commons" | "wikipedia";
  rightsKind?: "reusable" | "non-free";
  sourceUrl: string;
  artist: string | null;
  license: string;
  licenseUrl: string | null;
  articleTitle?: string;
};

export function commonsFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/_/g, " ").trim().normalize("NFC");
  return name.length > 0 && name.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}:/\\]/.test(name) &&
    /\.(?:jpe?g|png|webp|gif|svg|tiff?)$/i.test(name) ? name : null;
}

export function commonsCategoryName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/_/g, " ").trim().normalize("NFC").replace(/^category\s*:\s*/i, "").replace(/\s+/g, " ");
  return name.length > 0 && name.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}]/.test(name) ? name : null;
}

export function wikipediaArticleTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/_/g, " ").trim().normalize("NFC");
  return title.length > 0 && title.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}]/.test(title) &&
    !/^(?:File|Image|Category|Wikipedia|Template|Help|Special|User|Talk|Portal|Module|Draft):/i.test(title) ? title : null;
}

type PosterInputs = { posterFileName: string | null; enwikiArticle: string | null; commonsCategory: string | null };
type StoredPosterInputs = PosterInputs & {
  posterInputsCheckedAt: Date | null;
  posterCandidateVersion: number;
  posterResolvedFrom: string | null;
  posterAttribution: PosterAttribution | null;
  title: string | null;
};

/**
 * Tracks Wikidata P3383/P373/enwiki sitelink metadata on movie rows while keeping
 * existing nullable artwork columns intact without schema migrations.
 */
export function posterInputsPatch(
  existing: StoredPosterInputs,
  incoming: PosterInputs & { title: string },
  now: Date,
  options: { preserveStoredTitle?: boolean } = {},
) {
  const title = options.preserveStoredTitle ? existing.title ?? incoming.title : incoming.title;
  const changed = existing.posterInputsCheckedAt === null ||
    existing.posterFileName !== incoming.posterFileName ||
    existing.enwikiArticle !== incoming.enwikiArticle ||
    existing.commonsCategory !== incoming.commonsCategory ||
    existing.title !== title;
  const origin = existing.posterResolvedFrom ?? "commons";
  const article = existing.enwikiArticle === incoming.enwikiArticle
    ? existing.posterAttribution?.articleTitle ?? incoming.enwikiArticle
    : incoming.enwikiArticle;
  const invalidate = origin === "wikipedia"
    ? existing.enwikiArticle !== incoming.enwikiArticle || hasConflictingSequelNumber(title, article)
    : origin === "commons-category"
      ? existing.commonsCategory !== incoming.commonsCategory
      : existing.posterFileName !== incoming.posterFileName;
  const noSource = incoming.posterFileName === null && incoming.enwikiArticle === null && incoming.commonsCategory === null;
  return {
    posterFileName: incoming.posterFileName,
    enwikiArticle: incoming.enwikiArticle,
    commonsCategory: incoming.commonsCategory,
    posterInputsCheckedAt: now,
    ...(changed
      ? {
          posterCandidateVersion: existing.posterCandidateVersion + 1,
          posterCheckedAt: noSource ? now : null,
          posterRetryAfter: noSource ? new Date(now.getTime() + 30 * 86_400_000) : null,
          posterErrorCode: noSource ? "poster_sources_missing" : null,
        }
      : {}),
    ...(invalidate
      ? { posterImageUrl: null, posterAttribution: null, posterResolvedFileName: null, posterResolvedFrom: null }
      : {}),
  };
}

export type PublicPosterAttribution = Omit<PosterAttribution, "rightsKind"> & { rightsKind?: "reusable" };

/**
 * The single gate for every public poster read.
 * External movie poster hotlinking and attribution are suppressed across all public APIs.
 */
export function publicMoviePoster(_movie?: {
  title?: string | null;
  enwikiArticle?: string | null;
  posterResolvedFrom?: string | null;
  posterImageUrl?: string | null;
  posterAttribution?: PosterAttribution | null;
  posterBlockedAt?: Date | string | null;
}): { posterImageUrl: null; posterAttribution: null } {
  return { posterImageUrl: null, posterAttribution: null };
}
