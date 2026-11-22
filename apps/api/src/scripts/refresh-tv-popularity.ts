import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../../../.env"), quiet: true });
import { container } from "../container";
import { TvDailyJobService } from "../modules/tv-series/daily/tv-daily-job.service";
import { RefreshTvPopularityHandler } from "../modules/tv-series/popularity/refresh.handler";
const prefix = "[catalog:tv-interest] ";
container.resolve(TvDailyJobService).runSnapshot("catalog.tv-series.popularity.refresh",()=>container.resolve(RefreshTvPopularityHandler).handle((message) => console.log(prefix + message))).then((result) => {
  console.log(prefix + Object.entries(result).map(([key, value]) => `${key}=${value}`).join(" "));
  process.exit(0);
}).catch((error) => {
  console.error(prefix + (error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "tv_popularity_refresh_failed"));
  process.exit(1);
});
