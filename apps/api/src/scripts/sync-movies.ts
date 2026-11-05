import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { container } from "../container";
import { SyncMoviesHandler } from "../modules/movies/sync/sync.handler";
async function main() {
  console.log("[catalog:movies] starting bounded Wikidata synchronization");
  const heartbeat = setInterval(() => console.log("[catalog:movies] working"), 30_000);
  try {
    const result = await container.resolve(SyncMoviesHandler).handle();
    console.log(`[catalog:movies] result ${JSON.stringify(result)}`);
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}
main().catch(() => {
  // Provider bodies, database URLs and query details never belong in job logs.
  console.error("[catalog:movies] failed; verify database migrations and runtime connectivity");
  process.exit(1);
});
