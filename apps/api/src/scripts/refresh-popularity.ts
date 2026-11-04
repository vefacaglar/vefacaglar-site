import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { container } from "../container";
import { RefreshPopularityHandler } from "../modules/catalog/popularity/popularity.handler";

/**
 * Refreshes IGDB popularity signals and scores for the whole catalog, then
 * reindexes changed games. IGDB recalculates the data daily, so running it
 * more than once a day gains nothing.
 *
 * usage: pnpm --filter api catalog:popularity
 */
async function main() {
  console.log("[catalog:popularity] refreshing...");
  const result = await container.resolve(RefreshPopularityHandler).handle();
  console.log(
    `[catalog:popularity] done in ${(result.durationMs / 1000).toFixed(1)}s: ` +
      `${result.gameCount} games, ${result.signalCount} signals, ` +
      `${result.scoredCount} scored, ${result.reindexedCount} reindexed`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[catalog:popularity] failed:", err);
  process.exit(1);
});
