import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
config({path:resolve(__dirname,"../../../../.env"),quiet:true});
import { container } from "../container";
import { TvDailyJobService } from "../modules/tv-series/daily/tv-daily-job.service";
const prefix="[catalog:tv-cast] ";
container.resolve(TvDailyJobService).run("catalog.tv-series.cast.refresh",message=>console.log(prefix+message)).then(result=>{console.log(prefix+`daily run completed processed=${result.processed} failed=${result.failed}`);process.exit(0);}).catch(error=>{console.error(prefix+(error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:"tv_daily_run_failed"));process.exit(1);});
