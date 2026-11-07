import type { PosterAttribution } from "./commons-poster";

type PosterInputs = { posterFileName: string | null; enwikiArticle: string | null };
type StoredPosterInputs = PosterInputs & { posterInputsCheckedAt: Date | null; posterCandidateVersion: number;
  posterResolvedFrom: string | null; posterAttribution: PosterAttribution | null };

/** A missing P3383 claim must not erase a valid poster resolved from the article. */
export function posterInputsPatch(existing: StoredPosterInputs, incoming: PosterInputs, now: Date) {
  const changed = existing.posterInputsCheckedAt === null || existing.posterFileName !== incoming.posterFileName || existing.enwikiArticle !== incoming.enwikiArticle;
  const origin = existing.posterResolvedFrom ?? "commons";
  const invalidate = origin === "wikipedia" ? existing.enwikiArticle !== incoming.enwikiArticle : existing.posterFileName !== incoming.posterFileName;
  const noSource = incoming.posterFileName === null && incoming.enwikiArticle === null;
  return { ...incoming, posterInputsCheckedAt: now,
    ...(changed ? { posterCandidateVersion: existing.posterCandidateVersion + 1, posterCheckedAt: noSource ? now : null,
      posterRetryAfter: noSource ? new Date(now.getTime() + 30 * 86_400_000) : null,
      posterErrorCode: noSource ? "poster_sources_missing" : null } : {}),
    ...(invalidate ? { posterImageUrl: null, posterAttribution: null, posterResolvedFileName: null, posterResolvedFrom: null } : {}) };
}
