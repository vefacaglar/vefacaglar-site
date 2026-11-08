import { sql } from "drizzle-orm";
import { pgTable, uuid, date, integer, text, timestamp, primaryKey, index, check } from "drizzle-orm/pg-core";
import { users } from "./users";
import { movies } from "./movies";
export const userMovieWatches = pgTable("user_movie_watches", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  movieId: uuid("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
  watchedOn: date("watched_on"),
  comment: text("comment"),
  sharedAt: timestamp("shared_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => ({
  commentLength: check("user_movie_watches_comment_length", sql`char_length(${table.comment}) <= 2000`),
  movieHistoryIdx: index("user_movie_watches_movie_history_idx").on(table.userId, table.movieId, table.watchedOn, table.id),
  userHistoryIdx: index("user_movie_watches_user_history_idx").on(table.userId, table.watchedOn, table.id),
  sharedMovieIdx: index("user_movie_watches_shared_movie_idx").on(table.movieId, table.sharedAt, table.id).where(sql`${table.sharedAt} is not null`),
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
  movieRatingIdx: index("user_movie_ratings_movie_id_idx").on(table.movieId),
}));
