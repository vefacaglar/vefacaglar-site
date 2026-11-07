import type { PosterAttribution } from "./commons-poster";
import { hasConflictingSequelNumber } from "./poster-title";

type PosterInputs = { posterFileName: string | null; enwikiArticle: string | null };
type StoredPosterInputs = PosterInputs & { posterInputsCheckedAt: Date | null; posterCandidateVersion: number;
  posterResolvedFrom: string | null; posterAttribution: PosterAttribution | null; title: string | null };

/** A missing P3383 claim must not erase a valid poster resolved from the article. */
export function posterInputsPatch(existing: StoredPosterInputs, incoming: PosterInputs & { title: string }, now: Date, options: { preserveStoredTitle?: boolean } = {}) {
  const title = options.preserveStoredTitle ? existing.title : incoming.title;
  const changed = existing.posterInputsCheckedAt === null || existing.posterFileName !== incoming.posterFileName || existing.enwikiArticle !== incoming.enwikiArticle || existing.title !== title;
  const origin = existing.posterResolvedFrom ?? "commons";
  const article = existing.enwikiArticle === incoming.enwikiArticle ? existing.posterAttribution?.articleTitle ?? incoming.enwikiArticle : incoming.enwikiArticle;
  const invalidate = origin === "wikipedia" ? existing.enwikiArticle !== incoming.enwikiArticle || hasConflictingSequelNumber(title, article) : existing.posterFileName !== incoming.posterFileName;
  const noSource = incoming.posterFileName === null && incoming.enwikiArticle === null;
  return { posterFileName: incoming.posterFileName, enwikiArticle: incoming.enwikiArticle, posterInputsCheckedAt: now,
    ...(changed ? { posterCandidateVersion: existing.posterCandidateVersion + 1, posterCheckedAt: noSource ? now : null,
      posterRetryAfter: noSource ? new Date(now.getTime() + 30 * 86_400_000) : null,
      posterErrorCode: noSource ? "poster_sources_missing" : null } : {}),
    ...(invalidate ? { posterImageUrl: null, posterAttribution: null, posterResolvedFileName: null, posterResolvedFrom: null } : {}) };
}

/** Suppress previously cached article artwork as well as new fetches. */
export function publicMoviePoster(movie: { title: string | null; enwikiArticle: string | null; posterResolvedFrom: string | null;
  posterImageUrl: string | null; posterAttribution: PosterAttribution | null }) {
  const article = movie.posterAttribution?.articleTitle ?? movie.enwikiArticle;
  return movie.posterResolvedFrom === "wikipedia" && hasConflictingSequelNumber(movie.title, article)
    ? { posterImageUrl: null, posterAttribution: null }
    : { posterImageUrl: movie.posterImageUrl, posterAttribution: movie.posterAttribution };
}
