import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { container } from "../container";
import { FixMovieEnglishTitlesHandler } from "../modules/movies/english-titles/english-titles.handler";
import { ENGLISH_TITLE_USAGE, parseEnglishTitleArgs } from "../modules/movies/english-titles/english-titles.args";

const PREFIX = "[catalog:movie-titles]";

async function main() {
  const options = parseEnglishTitleArgs(process.argv.slice(2));
  console.log(`${PREFIX} starting ${options.dryRun ? "read-only dry run" : "bounded English title correction"}`);
  const heartbeat = setInterval(() => console.log(`${PREFIX} working`), 30_000);
  try {
    const result = await container.resolve(FixMovieEnglishTitlesHandler).handle(options);
    for (const change of result.samples) console.log(`${PREFIX} ${change.slug}: ${change.from ?? "(none)"} → ${change.to}`);
    const changed = options.dryRun ? "would change" : "changed";
    console.log(`${PREFIX} ${result.status}: scanned ${result.scanned}, english found ${result.englishFound}, ${changed} ${result.changed}, ` +
      `unchanged ${result.unchanged}, no english ${result.noEnglish}, errors ${result.errors}, requests ${result.requests}, ` +
      `seconds ${Math.round(result.durationMs / 1000)}; last movie id: ${result.cursor ?? "none"}`);
    if (!options.dryRun) {
      console.log(`${PREFIX} pass so far: scanned ${result.passScanned}, changed ${result.passChanged}`);
      // Fixed numeric/boolean summary consumed by the worker's continuation protocol.
      const { hasMore, progressMade, nextRunAt, scanned, changed: changedCount, errors, requests } = result;
      console.log(`${PREFIX} result ${JSON.stringify({ hasMore, progressMade, nextRunAt, scanned, changed: changedCount, errors, requests })}`);
    }
  } finally { clearInterval(heartbeat); }
  process.exit(0);
}

main().catch((error) => {
  // Provider bodies, database URLs and query details never belong in job logs.
  const usage = error instanceof Error && error.message === ENGLISH_TITLE_USAGE;
  console.error(`${PREFIX} ${usage ? ENGLISH_TITLE_USAGE : "failed; verify database migrations and runtime connectivity"}`);
  process.exit(usage ? 2 : 1);
});
