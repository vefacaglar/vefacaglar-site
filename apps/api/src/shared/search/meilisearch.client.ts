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

export function readMeilisearchConfig(env: NodeJS.ProcessEnv = process.env): MeilisearchConfig {
  const rawUrl = env.MEILISEARCH_URL?.trim();
  const apiKey = env.MEILISEARCH_API_KEY?.trim() ?? "";
  const url = rawUrl && URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    return { enabled: false, url: "", apiKey: "" };
  }
  return { enabled: true, url: url.href.replace(/\/+$/, ""), apiKey };
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
  /** Present for `page`/`hitsPerPage` searches: exact up to the index's `pagination.maxTotalHits`. */
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
export interface ISearchClient {
  search<T>(index: string, params: MeilisearchSearchParams): Promise<MeilisearchSearchResponse<T>>;
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

  search<T>(index: string, params: MeilisearchSearchParams): Promise<MeilisearchSearchResponse<T>> {
    return this.request("POST", `${indexPath(index)}/search`, params);
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

/**
 * Errors after which a search may fall back to Postgres: no response or timeout,
 * a 5xx, a missing index, or an index whose settings predate the query (the
 * worker reapplies settings; Postgres answers meanwhile). Other request errors
 * (invalid parameters, authentication) are bugs or misconfiguration and propagate.
 */
export function isSearchFallbackError(err: unknown): boolean {
  if ((err as { code?: unknown } | null)?.code === "SEARCH_TIMEOUT") return true;
  if (!(err instanceof MeilisearchError)) return false;
  if (isTransient(err)) return true;
  if (err.code === "index_not_found") return true;
  return /^invalid_search_(sort|filter|attributes_to_search_on)$/.test(err.code)
    && /is not (sortable|filterable|searchable)/.test(err.message);
}
