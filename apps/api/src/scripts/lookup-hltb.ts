import "reflect-metadata";
import * as dotenv from "dotenv";
import * as path from "node:path";
dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true } as dotenv.DotenvConfigOptions);
import { container } from "../container";
import { HLTB_LOOKUP_SERVICE } from "../modules/catalog/hltb/hltb.types";
import type { HltbLookupService } from "../modules/catalog/hltb/hltb.service";
import { translateError } from "../shared/localization";
import { parseHltbOptions } from "./hltb-options";
async function main() {
  const options = parseHltbOptions(process.argv.slice(2));
  const service = container.resolve<HltbLookupService>(HLTB_LOOKUP_SERVICE);
  if (options.retrySync) return service.retrySync(options.game);
  const lookup = await service.lookup(options.game, { query: options.query, refresh: options.refresh });
  if (!options.apply || lookup.outcome !== "matches") return lookup;
  return service.apply(options.game, { receiptId: lookup.receiptId, expectedVersion: lookup.expectedVersion,
    hltbId: options.hltbId!, overwriteFields: options.overwriteFields, replaceMapping: options.replaceMapping, acknowledgeMismatch: options.acknowledgeMismatch });
}
main().then((result) => {
  console.log(JSON.stringify(result));
  process.exit("outcome" in result && (result.outcome === "provider_unavailable" || process.argv.includes("--apply")) ? 2 : 0);
}).catch((error: unknown) => {
  // Do not print connection strings, public session tokens, or provider response bodies.
  const message = error instanceof Error ? error.message : "HLTB lookup failed";
  const safe = message.startsWith("err_hltb_") ? translateError(message, "en")
    : /^(--|Invalid |Unknown option:|Duplicate option:|Missing value for |Mutation options)/.test(message) ? message : "HLTB lookup failed. Check configuration and try again.";
  console.error(JSON.stringify({ error: safe }));
  process.exit(1);
});
