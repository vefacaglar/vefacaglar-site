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
    // Whitelist numeric counters so the dashboard can show a useful summary
    // without forwarding provider bodies or relying on redacted JSON output.
    const counters = [["discovered", result.discovered], ["hydrated", result.hydrated],
      ["refreshed", result.refreshed], ["failed", result.failed], ["labels checked", result.labelsChecked],
      ["source requests", result.requests]] as const;
    console.log(`[catalog:movies] finished: ${counters.map(([label, value]) =>
      `${label}: ${Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0}`).join(", ")}; more work: ${result.hasMore ? "yes" : "no"}`);
    console.log(`[catalog:movies] result ${JSON.stringify(result)}`);
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}
main().catch(() => {
  // Provider bodies, database URLs and query details never belong in job logs.
  console.error("[catalog:movies] failed; verify database migrations and runtime connectivity");
  process.exit(1);
});
