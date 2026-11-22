import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true });

import { container } from "../container";
import { RefreshGameCompletionTimesHandler } from "../modules/catalog/completion-times/completion-times.handler";

async function main() {
  const result = await container.resolve(RefreshGameCompletionTimesHandler).handle((message) => console.log(`[catalog:completion-times] ${message}`));
  console.log(`[catalog:completion-times] IGDB published records=${result.providerRecords} usable=${result.usableRecords} matched=${result.matchedGames} usableGames=${result.usableGames}`);
  console.log(`[catalog:completion-times] Independent identity map games=${result.independent.identityCount}`);
  for (const source of result.independent.sources) {
    console.log(`[catalog:completion-times] ${source.provider} status=${source.status} attempted=${source.attempted} accepted=${source.accepted} added=${source.added}`);
  }
  process.exit(0);
}
main().catch((error: unknown) => {
  console.error(`[catalog:completion-times] refresh failed; previous published data remains available: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
