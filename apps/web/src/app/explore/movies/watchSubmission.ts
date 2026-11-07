export type WatchDraft = { watchedOn: string; comment: string };
export type WatchSubmission = Readonly<{ id: string; watchedOn: string; comment: string | null }>;
/** Once a request may have reached the server, retries must keep its identity and payload. */
export function freezeWatchSubmission(current: WatchSubmission | null, draft: WatchDraft, createId: () => string): WatchSubmission {
  return current ?? Object.freeze({ id: createId(), watchedOn: draft.watchedOn, comment: draft.comment.trim() || null });
}
