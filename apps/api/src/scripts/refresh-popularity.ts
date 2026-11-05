import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { container } from "../container";
import { RefreshPopularityHandler } from "../modules/catalog/popularity/popularity.handler";
import { SEARCH_WRITER } from "../shared/search/search.tokens";
import type { ISearchIndexWriter } from "../shared/search/commands/search-writer.interface";

/**
 * Refreshes IGDB popularity signals and scores for the whole catalog, then
 * synchronizes IGDB-linked games with search in bounded batches. IGDB recalculates the data daily, so running it
 * more than once a day gains nothing.
 *
 * usage: pnpm --filter api catalog:popularity
 */
async function main() {
  console.log("[catalog:popularity] refreshing...");
  if (!container.resolve<ISearchIndexWriter>(SEARCH_WRITER).enabled) {
    throw new Error("Configure TYPESENSE_PUBLIC_URL and a TYPESENSE_API_KEY with write access before refreshing popularity");
  }
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`[catalog:popularity] working: ${Math.round((Date.now() - startedAt) / 1000)}s elapsed, ${rssMb} MiB RSS`);
  }, 30_000);
  let result;
  try {
    result = await container.resolve(RefreshPopularityHandler).handle({ requireSearchSync: true });
  } finally {
    clearInterval(heartbeat);
  }
  console.log(
    `[catalog:popularity] done in ${(result.durationMs / 1000).toFixed(1)}s: ` +
      `${result.gameCount} games, ${result.signalCount} signals, ` +
      `${result.scoredCount} interest scores, ${result.recommendationScoredCount} owner scores, ${result.reindexedCount} reindexed; ` +
      `game modes ${result.gameModesStatus}: ${result.gameModesCheckedCount} checked; ` +
      `HLTB ${result.hltbStatus}: ${result.hltbMatchedCount}/${result.hltbFetchedCount} matched`
  );
  process.exit(0);
}

main().catch((err) => {
  const code = (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
  console.error("[catalog:popularity] failed:", code === "42P01"
    ? "Database schema is missing. Apply the generated database migrations before running catalog:popularity."
    : err instanceof Error ? err.message : "Unknown refresh failure");
  process.exit(1);
});
