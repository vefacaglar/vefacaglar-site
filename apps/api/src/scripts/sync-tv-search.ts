import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../../../.env"), quiet: true });
import { container } from "../container";
import { SyncTvIndexHandler } from "../modules/tv-series/search-sync/sync.handler";
const prefix = "[search:tv-series] ";
container.resolve(SyncTvIndexHandler).handle((message) => console.log(prefix + message)).then((result) => {
  console.log(prefix + "result " + JSON.stringify(result)); process.exit(0);
}).catch((error) => {
  console.error(prefix + (error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "tv_search_sync_failed")); process.exit(1);
});
