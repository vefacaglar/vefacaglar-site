import { pgTable, uuid, varchar, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { jobs } from "./jobs";
/** Finite daily work owned by one durable worker job, including retries/drain. */
export const tvJobCampaigns = pgTable("tv_job_campaigns", {
  jobId: uuid("job_id").primaryKey().references(() => jobs.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 80 }).notNull(), stage: varchar("stage", { length: 24 }).notNull().default("init"),
  horizon: timestamp("horizon", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ceiling: integer("ceiling"), processed: integer("processed").notNull().default(0), failed: integer("failed").notNull().default(0),
});
export const tvJobCampaignItems = pgTable("tv_job_campaign_items", {
  jobId: uuid("job_id").notNull().references(() => tvJobCampaigns.jobId, { onDelete: "cascade" }),
  seriesId: integer("series_id").notNull(), failed: boolean("failed").notNull().default(false), requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }), revision: integer("revision"),
}, table => [primaryKey({ columns: [table.jobId, table.seriesId] })]);
