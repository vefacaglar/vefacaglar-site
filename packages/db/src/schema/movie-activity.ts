import { sql } from "drizzle-orm";
import { pgTable, uuid, date, integer, timestamp, primaryKey, index, check } from "drizzle-orm/pg-core";
import { users } from "./users";
import { movies } from "./movies";
export const userMovieWatches = pgTable("user_movie_watches", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: uuid("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
  watchedOn: date("watched_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  movieHistoryIdx: index("user_movie_watches_movie_history_idx").on(table.userId, table.movieId, table.watchedOn, table.id),
  userHistoryIdx: index("user_movie_watches_user_history_idx").on(table.userId, table.watchedOn, table.id),
}));
export const userMovieRatings = pgTable("user_movie_ratings", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: uuid("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.movieId] }),
  ratingRange: check("user_movie_ratings_rating_range", sql`${table.rating} >= 1 and ${table.rating} <= 10`),
}));
