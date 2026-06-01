import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { container } from "../container";
import { SEARCH_WRITER } from "../shared/search/search.tokens";
import type { ISearchIndexWriter } from "../shared/search/commands/search-writer.interface";

async function main() {
  const drop = process.argv.includes("--drop");

  const indexer = container.resolve<ISearchIndexWriter>(SEARCH_WRITER);

  if (!indexer.enabled) {
    console.error("[search:reindex] typesense is not configured (missing TYPESENSE_HOST or TYPESENSE_API_KEY).");
    process.exit(1);
  }

  console.log(`[search:reindex] starting (drop=${drop})...`);
  const start = Date.now();
  await indexer.reindexAll({ drop });
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[search:reindex] done in ${elapsed}s`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[search:reindex] failed:", err);
  process.exit(1);
});
