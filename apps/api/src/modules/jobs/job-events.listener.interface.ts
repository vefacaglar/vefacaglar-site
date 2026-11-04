/**
 * Postgres channel carrying "job <id> changed" notifications (payload = job id
 * as text). Sent by the worker after every progress update, log insert and
 * status change, and by the API inside its own job state transactions.
 */
export const JOB_EVENTS_CHANNEL = "job_events";

export interface IJobEventsListener {
  /**
   * Calls `onChange` whenever a `job_events` notification for `jobId` arrives.
   * It is also called for every subscriber after the LISTEN connection has
   * been (re-)established, because notifications may have been missed while
   * it was down. Connects lazily on the first subscriber.
   * Returns an idempotent unsubscribe function.
   */
  subscribe(jobId: string, onChange: () => void): () => void;
  /** Closes the LISTEN connection (process shutdown). */
  stop(): Promise<void>;
}
