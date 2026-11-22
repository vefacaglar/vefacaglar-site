import { injectable } from "tsyringe";
import { TvmazeRequestRepository } from "./tvmaze-request.repository";
import { parseTvCast } from "../cast/tv-cast-normalizer";
import { parseTvShow, parseTvPage, parseTvHierarchy } from "./tvmaze-normalizer";

export class TvmazeError extends Error {
  constructor(readonly code: string, readonly status: number | null = null, readonly retryAt = new Date(Date.now() + 60_000)) { super(code); }
}
@injectable()
export class TvmazeClient {
  constructor(private readonly requests: TvmazeRequestRepository) {}
  async cast(id: number, deadline: number) {
    if (!Number.isSafeInteger(id) || id<=0) throw new TvmazeError("tvmaze_cast_invalid_show");
    return parseTvCast(await this.json(`/shows/${id}/cast`, deadline, 8 * 1024 * 1024));
  }
  async page(page: number, deadline: number) {
    try { return parseTvPage(await this.json(`/shows?page=${page}`, deadline, 3 * 1024 * 1024), page); }
    catch (error) { if (error instanceof TvmazeError && error.status === 404) return null; throw error; }
  }
  async hierarchy(id: number, deadline: number) {
    const show = parseTvShow(await this.json(`/shows/${id}`, deadline));
    if (show.id !== id) throw new TvmazeError("tvmaze_show_identity_mismatch");
    try {
      const episodes = await this.json(`/shows/${id}/episodes?specials=1`, deadline, 32 * 1024 * 1024);
      const seasons = await this.json(`/shows/${id}/seasons`, deadline, 4 * 1024 * 1024);
      return parseTvHierarchy(show, seasons, episodes);
    } catch (error) {
      // Only the canonical show endpoint can prove a show was removed.
      if (error instanceof TvmazeError && error.status === 404) throw new TvmazeError("tvmaze_incomplete_hierarchy");
      throw error;
    }
  }
  async updates(lastCheckedAt: Date | null, deadline: number) {
    const age = lastCheckedAt ? Date.now() - lastCheckedAt.getTime() : Infinity;
    const since = age < 86400_000 ? "?since=day" : age < 7 * 86400_000 ? "?since=week" : age < 30 * 86400_000 ? "?since=month" : "";
    const raw = await this.json(`/updates/shows${since}`, deadline, 8 * 1024 * 1024);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TvmazeError("tvmaze_invalid_updates");
    return Object.entries(raw).map(([id, timestamp]) => {
      if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id)>2147483647 || !Number.isSafeInteger(timestamp) || Number(timestamp) <= 0 || Number(timestamp)>8640000000000) throw new TvmazeError("tvmaze_invalid_update_identity");
      return { id: Number(id), updatedAt: new Date(Number(timestamp) * 1000) };
    }).filter((row) => !lastCheckedAt || row.updatedAt.getTime() >= lastCheckedAt.getTime() - 60000);
  }
  private async json(path: string, deadline: number, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
    const slot = await this.requests.reserve();
    if (slot.cooldownMs>0) throw new TvmazeError("tvmaze_cooldown_active", null, new Date(Date.now()+slot.cooldownMs));
    if (Date.now()+slot.waitMs>=deadline) throw new TvmazeError("tvmaze_budget_exhausted");
    if (slot.waitMs>0) await new Promise((resolve)=>setTimeout(resolve,slot.waitMs));
    let response: Response;
    try { response = await fetch(`https://api.tvmaze.com${path}`, { redirect: "error", headers: {
      "User-Agent": "VefaLibrary/1.0 (+https://vefacaglar.com)", Accept: "application/json",
    }, signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - Date.now()))) }); }
    catch { throw new TvmazeError(Date.now() >= deadline ? "tvmaze_budget_exhausted" : "tvmaze_request_failed"); }
    if (!response.ok) {
      const header = response.headers.get("retry-after");
      const seconds = header === null ? NaN : Number(header);
      const retry = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(header ?? "");
      await response.body?.cancel();
      const retryAt = new Date(Math.min(Date.now() + 86400_000, Math.max(Date.now() + 60_000, Number.isFinite(retry) ? retry : 0)));
      if(response.status===429 || response.status>=500) await this.requests.cooldown(retryAt);
      throw new TvmazeError(`tvmaze_http_${response.status}`, response.status, retryAt);
    }
    if (!response.body || !response.headers.get("content-type")?.includes("json") || Number(response.headers.get("content-length") ?? 0) > maxBytes) {
      await response.body?.cancel(); throw new TvmazeError("tvmaze_invalid_body");
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) throw new TvmazeError("tvmaze_body_limit");
        parts.push(part.value);
      }
      return JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch (error) { if (error instanceof TvmazeError) throw error; throw new TvmazeError(Date.now() >= deadline ? "tvmaze_budget_exhausted" : "tvmaze_invalid_json"); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
