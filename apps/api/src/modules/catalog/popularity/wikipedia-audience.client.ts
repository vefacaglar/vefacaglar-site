import { injectable } from "tsyringe";
import { gameAudienceUrl, parseGameAudience } from "./wikipedia-audience";
import type { WikipediaAudience } from "./popularity-score";

export class GameAudienceSourceError extends Error {
  constructor(readonly status: number | null, readonly retryAt: Date | null = null) { super(status ? `Game audience HTTP ${status}` : "Game audience source unavailable"); }
}

@injectable()
export class GameWikipediaAudienceClient {
  private lastRequestAt = 0;

  async fetch(article: string, sourceDate: string, signal: AbortSignal): Promise<WikipediaAudience | null> {
    const wait = this.lastRequestAt + 500 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    signal.throwIfAborted();
    this.lastRequestAt = Date.now();
    let response: Response;
    try {
      response = await fetch(gameAudienceUrl(article, sourceDate), { redirect: "error", headers: {
        "User-Agent": "VefaLibrary/1.0 (+https://vefacaglar.com)", Accept: "application/json",
      }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
    } catch { throw new GameAudienceSourceError(null); }
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) {
      const header = response.headers.get("retry-after");
      const seconds = header === null ? NaN : Number(header);
      const parsed = Number.isFinite(seconds) && seconds >= 0 ? Date.now() + seconds * 1000 : Date.parse(header ?? "");
      await response.body?.cancel();
      throw new GameAudienceSourceError(response.status, new Date(Math.max(Date.now() + 60_000, Number.isFinite(parsed) ? parsed : Date.now() + 60_000)));
    }
    if (!response.body || !response.headers.get("content-type")?.includes("json") || Number(response.headers.get("content-length") ?? 0) > 128 * 1024) {
      await response.body?.cancel(); throw new GameAudienceSourceError(null);
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 128 * 1024) throw new GameAudienceSourceError(null);
        parts.push(part.value);
      }
      let raw: unknown;
      try { raw = JSON.parse(Buffer.concat(parts).toString("utf8")); }
      catch { throw new GameAudienceSourceError(null); }
      try { return parseGameAudience(raw, article, sourceDate); }
      catch { return null; }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
