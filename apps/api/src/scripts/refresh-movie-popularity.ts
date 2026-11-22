import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { container } from "../container";
import { RefreshMoviePopularityHandler } from "../modules/movies/popularity/popularity.handler";
const PREFIX = "[catalog:movie-interest]";
async function main() {
  console.log(`${PREFIX} starting bounded movie audience popularity refresh`);
  const heartbeat = setInterval(() => console.log(`${PREFIX} working`), 30_000);
  try {
    const result = await container.resolve(RefreshMoviePopularityHandler).handle();
    console.log(`${PREFIX} ${result.status}; latest source: ${result.sourceDate ?? "none"}; ranked catalog films: ${result.observedMovieCount}; duration: ${result.durationMs}ms`);
    console.log(`${PREFIX} sources: ${JSON.stringify(result.sources)}; failures: ${JSON.stringify(result.failures)}`);
    console.log(`${PREFIX} leading scores: ${JSON.stringify(result.leaders)}`);
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}
main().catch((error) => {
  const code = error instanceof Error && /^Movie (?:interest|popularity) refresh failed: [a-z0-9_-]+$/.test(error.message) ? error.message : "Movie interest refresh failed; verify migrations and runtime connectivity";
  console.error(`${PREFIX} ${code}`);
  process.exit(1);
});
