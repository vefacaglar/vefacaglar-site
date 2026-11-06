import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { container } from "../container";
import { RefreshMoviePopularityHandler } from "../modules/movies/popularity/popularity.handler";
const PREFIX = "[catalog:movie-interest]";
async function main() {
  console.log(`${PREFIX} starting bounded English Wikipedia interest refresh`);
  const heartbeat = setInterval(() => console.log(`${PREFIX} working`), 30_000);
  try {
    const result = await container.resolve(RefreshMoviePopularityHandler).handle();
    console.log(`${PREFIX} ${result.status}; observation: ${result.sourceDate ?? "none"}; observed catalog films: ${result.observedMovieCount ?? "unknown"}; articles: ${result.articleCount ?? "unknown"}; requests: ${result.requests}`);
    if (result.nextRetryAt) console.log(`${PREFIX} source cooldown; next retry after ${result.nextRetryAt}`);
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}
main().catch((error) => {
  const code = error instanceof Error && /^Movie interest refresh failed: [a-z0-9_-]+$/.test(error.message) ? error.message : "Movie interest refresh failed; verify migrations and runtime connectivity";
  console.error(`${PREFIX} ${code}`);
  process.exit(1);
});
