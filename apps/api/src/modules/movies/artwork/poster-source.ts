import type { PosterAttribution } from "./commons-poster";
import { hasConflictingSequelNumber } from "./poster-title";

type PosterInputs = { posterFileName: string | null; enwikiArticle: string | null; commonsCategory: string | null };
type StoredPosterInputs = PosterInputs & { posterInputsCheckedAt: Date | null; posterCandidateVersion: number;
  posterResolvedFrom: string | null; posterAttribution: PosterAttribution | null; title: string | null };

/**
 * A missing P3383 claim must not erase a valid poster resolved from another source.
 * Each stored poster is invalidated only by a change to the input that resolved it.
 * Rows stored before P373 was tracked have a null category, so the first catalog
 * refresh that observes a category counts as a changed input and re-queues artwork.
 */
export function posterInputsPatch(existing: StoredPosterInputs, incoming: PosterInputs & { title: string }, now: Date, options: { preserveStoredTitle?: boolean } = {}) {
  const title = options.preserveStoredTitle ? existing.title : incoming.title;
  const changed = existing.posterInputsCheckedAt === null || existing.posterFileName !== incoming.posterFileName || existing.enwikiArticle !== incoming.enwikiArticle ||
    existing.commonsCategory !== incoming.commonsCategory || existing.title !== title;
  const origin = existing.posterResolvedFrom ?? "commons";
  const article = existing.enwikiArticle === incoming.enwikiArticle ? existing.posterAttribution?.articleTitle ?? incoming.enwikiArticle : incoming.enwikiArticle;
  const invalidate = origin === "wikipedia" ? existing.enwikiArticle !== incoming.enwikiArticle || hasConflictingSequelNumber(title, article)
    : origin === "commons-category" ? existing.commonsCategory !== incoming.commonsCategory : existing.posterFileName !== incoming.posterFileName;
  const noSource = incoming.posterFileName === null && incoming.enwikiArticle === null && incoming.commonsCategory === null;
  return { posterFileName: incoming.posterFileName, enwikiArticle: incoming.enwikiArticle, commonsCategory: incoming.commonsCategory, posterInputsCheckedAt: now,
    ...(changed ? { posterCandidateVersion: existing.posterCandidateVersion + 1, posterCheckedAt: noSource ? now : null,
      posterRetryAfter: noSource ? new Date(now.getTime() + 30 * 86_400_000) : null,
      posterErrorCode: noSource ? "poster_sources_missing" : null } : {}),
    ...(invalidate ? { posterImageUrl: null, posterAttribution: null, posterResolvedFileName: null, posterResolvedFrom: null } : {}) };
}

/** Public poster output never carries non-free attribution. */
export type PublicPosterAttribution = Omit<PosterAttribution, "rightsKind"> & { rightsKind?: "reusable" };

/**
 * The single gate for every public poster read. Suppresses previously cached article artwork as well as new fetches.
 * An admin-blocked poster is hidden together with its credit, so the UI falls back to the generic poster.
 */
export function publicMoviePoster(movie: { title: string | null; enwikiArticle: string | null; posterResolvedFrom: string | null;
  posterImageUrl: string | null; posterAttribution: PosterAttribution | null; posterBlockedAt: Date | string | null }): { posterImageUrl: string | null; posterAttribution: PublicPosterAttribution | null } {
  if (movie.posterBlockedAt !== null) return { posterImageUrl: null, posterAttribution: null };
  const stored = movie.posterAttribution;
  // Only freely licensed artwork may be shown. Legacy stored non-free rows stay hidden until a refresh clears them.
  if (!stored || stored.rightsKind === "non-free") return { posterImageUrl: null, posterAttribution: null };
  const article = stored.articleTitle ?? movie.enwikiArticle;
  return movie.posterResolvedFrom === "wikipedia" && hasConflictingSequelNumber(movie.title, article)
    ? { posterImageUrl: null, posterAttribution: null }
    : { posterImageUrl: movie.posterImageUrl, posterAttribution: stored as PublicPosterAttribution };
}
