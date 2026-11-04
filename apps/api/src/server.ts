import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";

// Always attempt to load environment variables from the root .env file if it exists.
// This ensures local .env files are loaded in self-hosted production environments,
// while not overriding variables already injected by cloud platforms (e.g. Vercel, Docker).
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { app, applicationLogs } from "./app";
import { container } from "./container";
import { SEARCH_WRITER } from "./shared/search/search.tokens";
import type { ISearchIndexWriter } from "./shared/search/commands/search-writer.interface";

const start = async () => {
  try {
    const port = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001;
    const host = process.env.API_HOST ?? "127.0.0.1";
    await app.listen({ port, host });
    applicationLogs.write({ level: "info", event: "api_started", message: "API started" });
    // Non-blocking: create missing Typesense collections (alias-aware, never
    // deletes). Full reindexing is the worker's `search.reindex` job.
    container
      .resolve<ISearchIndexWriter>(SEARCH_WRITER)
      .ensureCollections()
      .catch((err) => {
        app.log.error(err, "[search] collection bootstrap failed");
        applicationLogs.write({
          level: "error",
          event: "search_collection_bootstrap_failed",
          message: "Search collection bootstrap failed",
        });
      });
  } catch (err) {
    console.error(err);
    applicationLogs.write({ level: "error", event: "api_start_failed", message: "API failed to start" });
    await applicationLogs.close();
    process.exit(1);
  }
};

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 25_000);
  timeout.unref();
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err, "Failed to shut down API");
    process.exit(1);
  }
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
start();
