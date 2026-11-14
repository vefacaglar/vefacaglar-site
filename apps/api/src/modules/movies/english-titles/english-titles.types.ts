export const MOVIE_ENGLISH_TITLE_REPOSITORY = Symbol("MovieEnglishTitleRepository");
export const MOVIE_ENGLISH_TITLE_STATE_ID = "wikidata-english-titles-v1";

export type EnglishTitleState = {
  cursor: string | null;
  passStartedAt: Date | null;
  lastPassCompletedAt: Date | null;
  passScanned: number;
  passChanged: number;
  failureCount: number;
};
export type EnglishTitleCandidate = { id: string; wikidataId: string; slug: string; title: string | null };

export interface IMovieEnglishTitleRepository {
  /** Creates the state row on first use. */
  state(): Promise<EnglishTitleState>;
  saveState(patch: Partial<EnglishTitleState> & { errorCode?: string | null }): Promise<void>;
  /** The shared Wikidata cooldown also honored by the movie sync and interest jobs. */
  wikidataCooldown(): Promise<Date | null>;
  /** Raises the shared Wikidata cooldown; never shortens it. */
  recordWikidataCooldown(until: Date): Promise<void>;
  /** Hydrated films with an id after `afterId`, in id order. */
  candidates(afterId: string | null, limit: number): Promise<EnglishTitleCandidate[]>;
  /**
   * Replaces the title only while it still equals `expectedTitle`, with the same
   * side effects as a title change in `persistMovie` (poster inputs, updatedAt,
   * search re-index). Never touches the slug. Returns whether a row changed.
   */
  replaceTitle(movieId: string, expectedTitle: string | null, title: string, now: Date): Promise<boolean>;
}
