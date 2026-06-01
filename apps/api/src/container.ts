import "reflect-metadata";
import { container } from "tsyringe";
import { db } from "@vefacaglar/db";
import { DB_CONNECTION } from "./db.tokens";
import { DbProvider } from "./db.provider";
import { POSTS_REPOSITORY } from "./modules/posts/posts.tokens";
import { DrizzlePostsRepository } from "./modules/posts/posts.repository";
import { PAGES_REPOSITORY } from "./modules/pages/pages.tokens";
import { DrizzlePagesRepository } from "./modules/pages/pages.repository";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "./modules/auth/auth.tokens";
import { DrizzleUsersRepository } from "./modules/auth/users.repository";
import { DrizzleSessionsRepository } from "./modules/auth/sessions.repository";
import { PROJECTS_REPOSITORY } from "./modules/projects/projects.tokens";
import { DrizzleProjectsRepository } from "./modules/projects/projects.repository";
import { IMAGE_CLIENT } from "./modules/uploads/image/image-client.tokens";
import { ImageKitClient } from "./modules/uploads/image/imagekit-client.service";
import { LOCALIZATIONS_REPOSITORY } from "./modules/localizations/localizations.tokens";
import { DrizzleLocalizationsRepository } from "./modules/localizations/localizations.repository";
import { DEVELOPERS_REPOSITORY, PUBLISHERS_REPOSITORY, GENRES_REPOSITORY, THEMES_REPOSITORY, PLATFORMS_REPOSITORY, GAMES_REPOSITORY } from "./modules/catalog/catalog.tokens";
import { DrizzleDevelopersRepository } from "./modules/catalog/developers.repository";
import { DrizzlePublishersRepository } from "./modules/catalog/publishers.repository";
import { DrizzleGenresRepository } from "./modules/catalog/genres.repository";
import { DrizzleThemesRepository } from "./modules/catalog/themes.repository";
import { DrizzlePlatformsRepository } from "./modules/catalog/platforms.repository";
import { DrizzleGamesRepository } from "./modules/catalog/games.repository";
import { PACKAGES_REPOSITORY } from "./modules/packages/packages.tokens";
import { DrizzlePackagesRepository } from "./modules/packages/packages.repository";
import { TYPESENSE_CLIENT, TYPESENSE_CONFIG, REDIS_CLIENT, SEARCH_READER, SEARCH_WRITER } from "./shared/search/search.tokens";
import { createTypesenseClient, createDisabledTypesenseClient, readTypesenseConfig } from "./shared/search/typesense.client";
import { createRedisClient, createDisabledRedisClient, readRedisConfig } from "./shared/search/redis.client";
import { TypesenseSearchReader } from "./shared/search/queries/typesense-search-reader";
import { TypesenseSearchWriter } from "./shared/search/commands/typesense-search-writer";
import { SearchEventSubscriber } from "./shared/search/commands/search-event-subscriber";
import { EVENT_BUS } from "./shared/events/events.tokens";
import { InProcessEventBus } from "./shared/events/in-process-event-bus";

container.registerInstance(DB_CONNECTION, db);
container.registerSingleton(DbProvider);
container.registerSingleton(POSTS_REPOSITORY, DrizzlePostsRepository);
container.registerSingleton(PAGES_REPOSITORY, DrizzlePagesRepository);
container.registerSingleton(PROJECTS_REPOSITORY, DrizzleProjectsRepository);
container.registerSingleton(USERS_REPOSITORY, DrizzleUsersRepository);
container.registerSingleton(SESSIONS_REPOSITORY, DrizzleSessionsRepository);
container.registerSingleton(IMAGE_CLIENT, ImageKitClient);
container.registerSingleton(LOCALIZATIONS_REPOSITORY, DrizzleLocalizationsRepository);
container.registerSingleton(DEVELOPERS_REPOSITORY, DrizzleDevelopersRepository);
container.registerSingleton(PUBLISHERS_REPOSITORY, DrizzlePublishersRepository);
container.registerSingleton(GENRES_REPOSITORY, DrizzleGenresRepository);
container.registerSingleton(THEMES_REPOSITORY, DrizzleThemesRepository);
container.registerSingleton(PLATFORMS_REPOSITORY, DrizzlePlatformsRepository);
container.registerSingleton(GAMES_REPOSITORY, DrizzleGamesRepository);
container.registerSingleton(PACKAGES_REPOSITORY, DrizzlePackagesRepository);

const typesenseConfig = readTypesenseConfig();
container.registerInstance(TYPESENSE_CONFIG, typesenseConfig);
container.registerInstance(
  TYPESENSE_CLIENT,
  typesenseConfig.enabled ? createTypesenseClient(typesenseConfig) : createDisabledTypesenseClient()
);

const redisConfig = readRedisConfig();
container.registerInstance(
  REDIS_CLIENT,
  redisConfig ? createRedisClient(redisConfig) : createDisabledRedisClient()
);

// CQRS segregation: read and write sides are separate implementations behind
// distinct, narrow tokens.
container.registerSingleton(SEARCH_READER, TypesenseSearchReader);
container.registerSingleton(SEARCH_WRITER, TypesenseSearchWriter);

container.registerSingleton(EVENT_BUS, InProcessEventBus);

// Wire up synchronous, in-process domain-event subscribers.
container.resolve(SearchEventSubscriber).register();

export { container };
