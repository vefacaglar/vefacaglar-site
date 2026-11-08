export type WatchDraft = { watchedOn: string; comment: string; isPublic: boolean };
export type WatchSubmission = Readonly<{ id: string; watchedOn: string | null; comment: string | null; isPublic: boolean }>;
/** Once a request may have reached the server, retries must keep its identity and payload. */
export function freezeWatchSubmission(current: WatchSubmission | null, draft: WatchDraft, createId: () => string): WatchSubmission {
  return current ?? Object.freeze({ id: createId(), watchedOn: draft.watchedOn || null, comment: draft.comment.trim() || null, isPublic: draft.isPublic });
}
