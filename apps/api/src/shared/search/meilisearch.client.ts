/**
 * Minimal Meilisearch HTTP client (search, document writes, index lookup, task
 * polling). The API only queries existing indexes and writes single documents
 * or small batches; index creation and settings belong to the worker.
 */

export interface MeilisearchConfig {
  enabled: boolean;
  /** Base URL without a trailing slash, e.g. `http://meilisearch:7700`. */
  url: string;
  apiKey: string;
}

function parseMeilisearchUrl(rawUrl: string): URL | undefined {
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return;
  return url;
}

export function readMeilisearchConfig(env: NodeJS.ProcessEnv = process.env): MeilisearchConfig {
  const rawUrl = env.MEILISEARCH_URL?.trim();
  const apiKey = env.MEILISEARCH_API_KEY?.trim() ?? "";
  const url = rawUrl ? parseMeilisearchUrl(rawUrl) : undefined;
  if (!url) return { enabled: false, url: "", apiKey: "" };
  return { enabled: true, url: url.href.replace(/\/+$/, ""), apiKey };
}

/**
 * A startup warning when search is silently off: an unusable MEILISEARCH_URL,
 * or no URL in production. Never includes the configured value.
 */
export function meilisearchConfigWarning(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const rawUrl = env.MEILISEARCH_URL?.trim();
  if (rawUrl && !parseMeilisearchUrl(rawUrl)) {
    return "MEILISEARCH_URL is not a plain http(s) URL (no credentials, query or fragment). Search is disabled and Postgres answers every query";
  }
  if (!rawUrl && env.NODE_ENV === "production") {
    return "MEILISEARCH_URL is not set. Search is disabled and Postgres answers every query";
  }
}

/** An HTTP error response (`httpStatus` + Meilisearch `code`) or a communication failure (no status). */
export class MeilisearchError extends Error {
  readonly httpStatus?: number;
  /** Meilisearch error code (e.g. `index_not_found`), or `communication_error` when no response arrived. */
  readonly code: string;
  readonly type?: string;

  constructor(message: string, options: { httpStatus?: number; code: string; type?: string; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MeilisearchError";
    this.httpStatus = options.httpStatus;
    this.code = options.code;
    this.type = options.type;
  }
}

export interface MeilisearchSearchParams {
  q?: string;
  attributesToSearchOn?: string[];
  attributesToRetrieve?: string[];
  filter?: string;
  sort?: string[];
  page?: number;
  hitsPerPage?: number;
  showRankingScore?: boolean;
}

export interface MeilisearchSearchResponse<T> {
  hits: Array<T & { _rankingScore?: number }>;
  /**
   * Present for `page`/`hitsPerPage` searches: the exact number of matches. Hits
   * stop at the index's `pagination.maxTotalHits`, so pages past that limit come
   * back short or empty although `totalHits` is larger (see `reachablePage`).
   */
  totalHits?: number;
  page?: number;
  hitsPerPage?: number;
  totalPages?: number;
}

export interface MeilisearchTask {
  taskUid: number;
  indexUid?: string | null;
  status: "enqueued" | "processing" | "succeeded" | "failed" | "canceled";
  error?: { message?: string; code?: string; type?: string } | null;
}

/** Narrow client surface; injected under `SEARCH_CLIENT` and mocked in specs. */
export interface RequestOptions {
  /** Aborts the HTTP request (e.g. when the caller's search timeout fires). */
  signal?: AbortSignal;
}

export interface ISearchClient {
  search<T>(index: string, params: MeilisearchSearchParams, options?: RequestOptions): Promise<MeilisearchSearchResponse<T>>;
  /** The index's `pagination.maxTotalHits`: how many matches any search can page through. */
  maxTotalHits(index: string, options?: RequestOptions): Promise<number>;
  /** Adds or fully replaces documents by primary key `id`. Resolves when the task is enqueued. */
  addDocuments(index: string, documents: object[]): Promise<MeilisearchTask>;
  /** Resolves when the deletion is enqueued; a missing index fails the task without creating the index. */
  deleteDocument(index: string, id: string): Promise<MeilisearchTask>;
  /** `true` when the index exists, `false` on `index_not_found`; other errors propagate. */
  indexExists(index: string): Promise<boolean>;
  /** Polls until the task leaves the queue; rejects on timeout. */
  waitForTask(taskUid: number, options?: { timeoutMs?: number; intervalMs?: number }): Promise<MeilisearchTask>;
}

const REQUEST_TIMEOUT_MS = 5_000;
// Writes retry transient failures (no response or 5xx) before giving up.
const WRITE_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 500;
const TASK_TIMEOUT_MS = 5 * 60_000;
const TASK_POLL_INTERVAL_MS = 250;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const indexPath = (index: string) => `/indexes/${encodeURIComponent(index)}`;

/** Transient failures worth a retry or a Postgres fallback: no response, a timeout, or a server error. */
function isTransient(err: unknown): boolean {
  if (!(err instanceof MeilisearchError)) return false;
  return err.httpStatus === undefined || err.httpStatus >= 500;
}

export class MeilisearchClient implements ISearchClient {
  constructor(private readonly config: MeilisearchConfig) {}

  search<T>(index: string, params: MeilisearchSearchParams, options: RequestOptions = {}): Promise<MeilisearchSearchResponse<T>> {
    return this.request("POST", `${indexPath(index)}/search`, params, options.signal);
  }

  async maxTotalHits(index: string, options: RequestOptions = {}): Promise<number> {
    const pagination = await this.request<{ maxTotalHits?: unknown }>("GET", `${indexPath(index)}/settings/pagination`, undefined, options.signal);
    const value = pagination.maxTotalHits;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new MeilisearchError("Meilisearch returned invalid pagination settings", { code: "invalid_response" });
    }
    return value;
  }

  addDocuments(index: string, documents: object[]): Promise<MeilisearchTask> {
    return this.withRetries(() => this.request("POST", `${indexPath(index)}/documents?primaryKey=id`, documents));
  }

  deleteDocument(index: string, id: string): Promise<MeilisearchTask> {
    return this.withRetries(() => this.request("DELETE", `${indexPath(index)}/documents/${encodeURIComponent(id)}`));
  }

  async indexExists(index: string): Promise<boolean> {
    try {
      await this.request("GET", indexPath(index));
      return true;
    } catch (err) {
      if (err instanceof MeilisearchError && err.code === "index_not_found") return false;
      throw err;
    }
  }

  async waitForTask(taskUid: number, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<MeilisearchTask> {
    const deadline = Date.now() + (options.timeoutMs ?? TASK_TIMEOUT_MS);
    for (;;) {
      const task = await this.request<MeilisearchTask & { uid: number }>("GET", `/tasks/${taskUid}`);
      if (task.status !== "enqueued" && task.status !== "processing") return { ...task, taskUid: task.uid };
      if (Date.now() >= deadline) {
        throw new MeilisearchError(`Meilisearch task ${taskUid} did not finish in time`, { code: "task_timeout" });
      }
      await sleep(options.intervalMs ?? TASK_POLL_INTERVAL_MS);
    }
  }

  private async withRetries<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await call();
      } catch (err) {
        if (attempt >= WRITE_ATTEMPTS || !isTransient(err)) throw err;
        await sleep(WRITE_RETRY_DELAY_MS);
      }
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    if (!this.config.enabled) throw new Error("Meilisearch is not configured");
    const headers: Record<string, string> = {};
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(`${this.config.url}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new MeilisearchError("Could not reach Meilisearch", { code: "communication_error", cause: err });
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (err) {
      if (response.ok) throw new MeilisearchError("Meilisearch returned an invalid response", { code: "invalid_response", cause: err });
    }
    if (!response.ok) {
      const error = (payload ?? {}) as { message?: unknown; code?: unknown; type?: unknown };
      throw new MeilisearchError(typeof error.message === "string" ? error.message : `Meilisearch returned HTTP ${response.status}`, {
        httpStatus: response.status,
        code: typeof error.code === "string" ? error.code : `http_${response.status}`,
        type: typeof error.type === "string" ? error.type : undefined,
      });
    }
    return payload as T;
  }
}

/** A rejected or missing API key: misconfiguration that must be loud, but must not take pages offline. */
export function isSearchAuthError(err: unknown): boolean {
  return err instanceof MeilisearchError && (err.httpStatus === 401 || err.httpStatus === 403);
}

/**
 * Errors after which a search may fall back to Postgres: no response or timeout,
 * a 5xx, a missing index, an index whose settings predate the query (the worker
 * reapplies settings; Postgres answers meanwhile), or a rejected API key
 * (reported separately as `search_auth_failure`). Other request errors (invalid
 * parameters) are bugs and propagate.
 */
export function isSearchFallbackError(err: unknown): boolean {
  if ((err as { code?: unknown } | null)?.code === "SEARCH_TIMEOUT") return true;
  if (!(err instanceof MeilisearchError)) return false;
  if (isTransient(err) || isSearchAuthError(err)) return true;
  if (err.code === "index_not_found") return true;
  return /^invalid_search_(sort|filter|attributes_to_search_on)$/.test(err.code)
    && /is not (sortable|filterable|searchable)/.test(err.message);
}

/** Runtime-failure event and level for a search that fell back to Postgres. */
export function searchFailureEvent(err: unknown): { event: string; level: "error" | "warning" } {
  return isSearchAuthError(err)
    ? { event: "search_auth_failure", level: "error" }
    : { event: "search_fallback", level: "warning" };
}

/**
 * Reconciles a numbered page with `pagination.maxTotalHits`. Returns the total
 * the caller may page through (`totalHits` capped at `maxTotalHits`), or `null`
 * when the page is inconsistent even with that cap (a partial or corrupt page).
 * The pagination setting is read only for a page shorter than `totalHits` implies.
 */
export async function reachablePage(
  client: ISearchClient,
  index: string,
  page: { page: number; hitsPerPage: number; totalHits: number; count: number },
  options?: RequestOptions
): Promise<number | null> {
  const expected = (total: number) => Math.min(page.hitsPerPage, Math.max(0, total - (page.page - 1) * page.hitsPerPage));
  if (page.count === expected(page.totalHits)) return page.totalHits;
  if (page.count > expected(page.totalHits)) return null;
  const reachable = Math.min(page.totalHits, await client.maxTotalHits(index, options));
  return page.count === expected(reachable) ? reachable : null;
}
