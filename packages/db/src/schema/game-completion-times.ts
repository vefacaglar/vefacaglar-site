import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";

// Official IGDB game_time_to_beats values. Separate from legacy HLTB columns.
export const gameIgdbCompletionTimes = pgTable("game_igdb_completion_times", {
  igdbId: integer("igdb_id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  hastilySeconds: integer("hastily_seconds"),
  normallySeconds: integer("normally_seconds"),
  completelySeconds: integer("completely_seconds"),
  sampleCount: integer("sample_count").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true, mode: "date" }),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
