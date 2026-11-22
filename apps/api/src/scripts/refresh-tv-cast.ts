import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "node:path";
config({path:resolve(__dirname,"../../../../.env"),quiet:true});
import { container } from "../container";
import { RefreshTvCastHandler } from "../modules/tv-series/cast/refresh.handler";
const prefix="[catalog:tv-cast] ";
container.resolve(RefreshTvCastHandler).handle(message=>console.log(prefix+message)).then(result=>{console.log(prefix+`completed shows=${result.shows} roles=${result.roles} matched=${result.matched} merged=${result.merged} failed=${result.failed}`);console.log(prefix+"result "+JSON.stringify(result));process.exit(0);}).catch(error=>{console.error(prefix+(error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:"tv_cast_refresh_failed"));process.exit(1);});
