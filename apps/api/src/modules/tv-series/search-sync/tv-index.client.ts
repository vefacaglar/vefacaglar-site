import { injectable } from "tsyringe";
@injectable()
export class TvIndexClient {
  private configuration() {
    const base = process.env.MEILISEARCH_URL?.replace(/\/$/, ""), key = process.env.MEILISEARCH_API_KEY;
    if (!base || !key) throw new Error("tv_meilisearch_configuration_missing");
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/") throw new Error("tv_meilisearch_configuration_invalid");
    return { base, key };
  }
  private async request(path: string, method = "GET", body?: unknown): Promise<any> {
    const { base, key } = this.configuration();
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`tv_meilisearch_http_${response.status}`); }
    return response.json();
  }
  private owned(index: string) {
    if (!/^tv_series_en(?:__\d{13}_[a-f0-9]{12})?$/.test(index)) throw new Error("tv_index_name_invalid");
  }
  private async task(result: any) {
    if (!Number.isSafeInteger(result?.taskUid)) throw new Error("tv_index_task_missing");
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const task = await this.request(`/tasks/${result.taskUid}`);
      if (task?.status === "succeeded") return;
      if (!task || ["failed", "canceled"].includes(task.status)) throw new Error("tv_index_task_failed");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("tv_index_task_timeout");
  }
  async exists(index:string){this.owned(index);return !!await this.request(`/indexes/${index}`);}
  async configure(index: string) {
    this.owned(index);
    if (!await this.request(`/indexes/${index}`)) await this.task(await this.request("/indexes", "POST", { uid: index, primaryKey: "id" }));
    await this.task(await this.request(`/indexes/${index}/settings`, "PATCH", {
      searchableAttributes: ["title"], displayedAttributes: ["id", "kind", "buildToken"],
      filterableAttributes: ["kind"], sortableAttributes: ["popularityScore", "titleSort", "id"],
      rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"], pagination: { maxTotalHits: 1000000 },
    }));
  }
  async documents(index: string, rows: unknown[]) { this.owned(index); if (rows.length) await this.task(await this.request(`/indexes/${index}/documents`, "POST", rows)); }
  async remove(index: string, ids: number[]) { this.owned(index); if (ids.length) await this.task(await this.request(`/indexes/${index}/documents/delete-batch`, "POST", ids)); }
  async marker(index: string): Promise<string | null> { this.owned(index); return (await this.request(`/indexes/${index}/documents/0`))?.buildToken ?? null; }
  async swap(index: string) {
    this.owned(index);
    if (!await this.request("/indexes/tv_series_en")) await this.task(await this.request("/indexes", "POST", { uid: "tv_series_en", primaryKey: "id" }));
    await this.task(await this.request("/swap-indexes", "POST", [{ indexes: ["tv_series_en", index] }]));
  }
  async settleSwap() {
    // A crash may leave a swap task queued. Wait for it before inspecting the
    // live marker, otherwise retrying could swap the old index back into view.
    const result = await this.request("/tasks?indexUids=tv_series_en&types=indexSwap&statuses=enqueued,processing&limit=100");
    if (!Array.isArray(result?.results)) throw new Error("tv_index_tasks_invalid");
    for (const task of result.results) await this.task({ taskUid: task.uid });
  }
  async discard(index: string) { this.owned(index); if (index === "tv_series_en") throw new Error("tv_index_delete_live_forbidden"); const result = await this.request(`/indexes/${index}`, "DELETE"); if (result) await this.task(result); }
}
