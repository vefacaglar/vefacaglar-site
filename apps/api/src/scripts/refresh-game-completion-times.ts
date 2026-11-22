import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true });

import { container } from "../container";
import { RefreshGameCompletionTimesHandler } from "../modules/catalog/completion-times/completion-times.handler";

async function main() {
  const result = await container.resolve(RefreshGameCompletionTimesHandler).handle();
  console.log(`[catalog:completion-times] published ${JSON.stringify(result)}`);
  process.exit(0);
}
main().catch((error: unknown) => {
  console.error(`[catalog:completion-times] refresh failed; previous published data remains available: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
});
