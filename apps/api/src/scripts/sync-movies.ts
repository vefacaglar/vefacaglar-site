import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { container } from "../container";
import { SyncMoviesHandler } from "../modules/movies/sync/sync.handler";
async function main() {
  console.log("[catalog:movies] starting Wikidata synchronization");
  const heartbeat = setInterval(() => console.log("[catalog:movies] working"), 30_000);
  try {
    const reason = await container.resolve(SyncMoviesHandler).handleRun((result, window) => {
      // Whitelist numeric counters so provider bodies never reach the dashboard.
      const counters = [["discovered", result.discovered], ["hydrated", result.hydrated],
        ["refreshed", result.refreshed], ["failed", result.failed], ["labels checked", result.labelsChecked],
        ["source requests", result.requests]] as const;
      console.log(`[catalog:movies] window ${window}: ${counters.map(([label, value]) =>
        `${label}: ${Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0}`).join(", ")}; more work: ${result.hasMore ? "yes" : "no"}`);
    });
    console.log(`[catalog:movies] finished: ${reason.replace("_", " ")}`);
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}
main().catch(() => {
  // Provider bodies, database URLs and query details never belong in job logs.
  console.error("[catalog:movies] failed; verify database migrations and runtime connectivity");
  process.exit(1);
});
