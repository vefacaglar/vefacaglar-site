import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true });
import { container } from "../container";
import { SyncTvSeriesHandler } from "../modules/tv-series/import/sync.handler";

const PREFIX = "[catalog:tv-series]";
async function main() {
  const result = await container.resolve(SyncTvSeriesHandler).handle((message) => console.log(`${PREFIX} ${message}`));
  console.log(`${PREFIX} completed pages=${result.pages} shows=${result.shows} hydrated=${result.hydrated} failed=${result.failed}`);
  console.log(`${PREFIX} result ${JSON.stringify(result)}`);
  process.exit(0);
}
main().catch((error: unknown) => {
  console.error(`${PREFIX} failed: ${error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "verify database migrations and source connectivity"}`);
  process.exit(1);
});
