import { injectable } from "tsyringe";
import { sql } from "drizzle-orm";
import { DbProvider } from "../../../db.provider";
/** One shared provider slot across import/cast jobs and worker generations. */
@injectable()
export class TvmazeRequestRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async reserve() {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [state] = await db.execute(sql`select cooldown_until from tv_source_state where id='tvmaze' for update`);
      if (!state) throw new Error("tvmaze_request_state_missing_migration");
      const [row] = await db.execute(sql`update tv_source_state set next_request_at=greatest(coalesce(next_request_at,clock_timestamp()),clock_timestamp())+interval '550 milliseconds' where id='tvmaze'
        returning greatest(0,extract(epoch from(next_request_at-clock_timestamp()-interval '550 milliseconds'))*1000)::int as wait_ms,
        greatest(0,extract(epoch from(cooldown_until-clock_timestamp()))*1000)::bigint as cooldown_ms`);
      return { waitMs: Number(row.wait_ms), cooldownMs: Number(row.cooldown_ms ?? 0) };
    });
  }
  async cooldown(until: Date) {
    await this.dbProvider.client.execute(sql`update tv_source_state set cooldown_until=greatest(cooldown_until,${until.toISOString()}::timestamptz) where id='tvmaze'`);
  }
}
