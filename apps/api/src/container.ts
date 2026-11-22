import "reflect-metadata";
import { MOVIE_ACTIVITY_REPOSITORY } from "./modules/movies/activity/activity.tokens";
import { DrizzleMovieActivityRepository } from "./modules/movies/activity/activity.repository";
import { MOVIE_DASHBOARD_REPOSITORY } from "./modules/movies/dashboard/movies-dashboard.repository.interface";
import { DrizzleMovieDashboardRepository } from "./modules/movies/dashboard/movies-dashboard.repository";
import { container } from "tsyringe";
import { db } from "@vefacaglar/db";
import { DB_CONNECTION } from "./db.tokens";
import { DbProvider } from "./db.provider";
import { POSTS_REPOSITORY } from "./modules/posts/posts.tokens";
import { DrizzlePostsRepository } from "./modules/posts/posts.repository";
import { PAGES_REPOSITORY } from "./modules/pages/pages.tokens";
import { DrizzlePagesRepository } from "./modules/pages/pages.repository";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY, OIDC_CLIENT } from "./modules/auth/auth.tokens";
import { DrizzleUsersRepository } from "./modules/auth/users.repository";
import { DrizzleSessionsRepository } from "./modules/auth/sessions.repository";
import { OidcClient } from "./modules/auth/oidc/oidc-client.service";
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
import { IGDB_CLIENT } from "./modules/catalog/import/import.tokens";
import { IgdbClient } from "./modules/catalog/import/igdb.client";
import { GameAudienceService } from "./modules/catalog/popularity/game-audience.service";
import { GameWikipediaAudienceClient } from "./modules/catalog/popularity/wikipedia-audience.client";
import { PopularityDiscoveryService } from "./modules/catalog/popularity/popularity-discovery.service";
import { OwnerRankingService } from "./modules/catalog/popularity/owner-ranking.service";
import { GAME_LOGS_REPOSITORY } from "./modules/games/games.tokens";
import { DrizzleGameLogsRepository } from "./modules/games/game-logs.repository";
import { GAME_COMMUNITY_REPOSITORY } from "./modules/games/community/community.tokens";
import { DrizzleGameCommunityRepository } from "./modules/games/community/community.repository";
import { MOVIE_COMMUNITY_REPOSITORY } from "./modules/movies/community/community.tokens";
import { DrizzleMovieCommunityRepository } from "./modules/movies/community/community.repository";
import { PACKAGES_REPOSITORY } from "./modules/packages/packages.tokens";
import { DrizzlePackagesRepository } from "./modules/packages/packages.repository";
import { JOBS_REPOSITORY, JOB_EVENTS_LISTENER, JOB_STREAM_TOKEN_CONFIG, JOB_STREAM_TOKEN_SERVICE } from "./modules/jobs/jobs.tokens";
import { DrizzleJobsRepository } from "./modules/jobs/jobs.repository";
import { PgJobEventsListener } from "./modules/jobs/job-events.listener";
import { JobStreamTokenService, readJobStreamTokenConfig } from "./modules/jobs/job-stream-token.service";
import { SEARCH_CLIENT, MEILISEARCH_CONFIG, SEARCH_READER, SEARCH_WRITER } from "./shared/search/search.tokens";
import { MeilisearchClient, readMeilisearchConfig } from "./shared/search/meilisearch.client";
import { MeilisearchSearchReader } from "./shared/search/queries/meilisearch-search-reader";
import { MeilisearchSearchWriter } from "./shared/search/commands/meilisearch-search-writer";
import { SearchEventSubscriber } from "./shared/search/commands/search-event-subscriber";
import { EVENT_BUS } from "./shared/events/events.tokens";
import { InProcessEventBus } from "./shared/events/in-process-event-bus";

import { MOVIE_CATALOG_SERVICE, MovieCatalogService } from "./modules/movies/search/movie-catalog.service";
import { MOVIE_SEARCH_READER, MeilisearchMovieSearchReader } from "./modules/movies/search/movie-search-reader";
import { MOVIE_PEOPLE_SEARCH_STATE_REPOSITORY, MOVIE_SEARCH_STATE_REPOSITORY } from "./modules/movies/search/movie-search.types";
import { DrizzleMoviePeopleSearchStateRepository, DrizzleMovieSearchStateRepository } from "./modules/movies/search/movie-search-state.repository";
import { MOVIE_PEOPLE_SEARCH_SERVICE, MoviePeopleSearchService } from "./modules/movies/search/movie-people-search.service";
import { MOVIE_PEOPLE_SEARCH_READER, MeilisearchMoviePeopleSearchReader } from "./modules/movies/search/movie-people-search-reader";
import { MOVIES_REPOSITORY, WIKIDATA_ENTITY_CLIENT } from "./modules/movies/movies.tokens";
import { DrizzleMoviesRepository } from "./modules/movies/movies.repository";
import { WikidataEntityClient } from "./modules/movies/import/wikidata-entity.client";
import { MOVIE_DISCOVERY_CLIENT } from "./modules/movies/import/wikidata-discovery.types";
import { WikidataFilmDiscoveryClient } from "./modules/movies/import/wikidata-discovery.client";

import { MOVIE_POPULARITY_REPOSITORY, WIKIPEDIA_INTEREST_CLIENT } from "./modules/movies/popularity/popularity.types";
import { DrizzleMoviePopularityRepository } from "./modules/movies/popularity/popularity.repository";
import { WikipediaInterestClient } from "./modules/movies/popularity/wikipedia-interest.client";
import { MOVIE_AUDIENCE_CLIENT, MOVIE_AUDIENCE_REPOSITORY } from "./modules/movies/popularity/audience.types";
import { MovieAudienceClient } from "./modules/movies/popularity/audience.client";
import { DrizzleMovieAudienceRepository } from "./modules/movies/popularity/audience.repository";
import { MOVIE_ENGLISH_TITLE_REPOSITORY } from "./modules/movies/english-titles/english-titles.types";
import { DrizzleMovieEnglishTitleRepository } from "./modules/movies/english-titles/english-titles.repository";

container.registerInstance(DB_CONNECTION, db);
container.registerSingleton(DbProvider);
container.registerSingleton(MOVIES_REPOSITORY, DrizzleMoviesRepository);
container.registerSingleton(MOVIE_CATALOG_SERVICE, MovieCatalogService);
container.registerSingleton(MOVIE_SEARCH_READER, MeilisearchMovieSearchReader);
container.registerSingleton(MOVIE_SEARCH_STATE_REPOSITORY, DrizzleMovieSearchStateRepository);
container.registerSingleton(MOVIE_PEOPLE_SEARCH_SERVICE, MoviePeopleSearchService);
container.registerSingleton(MOVIE_PEOPLE_SEARCH_READER, MeilisearchMoviePeopleSearchReader);
container.registerSingleton(MOVIE_PEOPLE_SEARCH_STATE_REPOSITORY, DrizzleMoviePeopleSearchStateRepository);
container.registerSingleton(MOVIE_POPULARITY_REPOSITORY, DrizzleMoviePopularityRepository);
container.registerSingleton(WIKIPEDIA_INTEREST_CLIENT, WikipediaInterestClient);
container.registerSingleton(MOVIE_AUDIENCE_CLIENT, MovieAudienceClient);
container.registerSingleton(MOVIE_AUDIENCE_REPOSITORY, DrizzleMovieAudienceRepository);
container.registerSingleton(MOVIE_ENGLISH_TITLE_REPOSITORY, DrizzleMovieEnglishTitleRepository);
container.registerSingleton(WIKIDATA_ENTITY_CLIENT, WikidataEntityClient);
container.registerSingleton(MOVIE_DISCOVERY_CLIENT, WikidataFilmDiscoveryClient);
container.registerSingleton(POSTS_REPOSITORY, DrizzlePostsRepository);
container.registerSingleton(PAGES_REPOSITORY, DrizzlePagesRepository);
container.registerSingleton(PROJECTS_REPOSITORY, DrizzleProjectsRepository);
container.registerSingleton(USERS_REPOSITORY, DrizzleUsersRepository);
container.registerSingleton(SESSIONS_REPOSITORY, DrizzleSessionsRepository);
container.registerSingleton(OIDC_CLIENT, OidcClient);
container.registerSingleton(IMAGE_CLIENT, ImageKitClient);
container.registerSingleton(LOCALIZATIONS_REPOSITORY, DrizzleLocalizationsRepository);
container.registerSingleton(DEVELOPERS_REPOSITORY, DrizzleDevelopersRepository);
container.registerSingleton(PUBLISHERS_REPOSITORY, DrizzlePublishersRepository);
container.registerSingleton(GENRES_REPOSITORY, DrizzleGenresRepository);
container.registerSingleton(THEMES_REPOSITORY, DrizzleThemesRepository);
container.registerSingleton(PLATFORMS_REPOSITORY, DrizzlePlatformsRepository);
container.registerSingleton(GAMES_REPOSITORY, DrizzleGamesRepository);
container.registerSingleton(IGDB_CLIENT, IgdbClient);
container.registerSingleton(OwnerRankingService);
container.registerSingleton(GameWikipediaAudienceClient);
container.register(GameAudienceService, { useClass: GameAudienceService });
container.register(PopularityDiscoveryService, { useClass: PopularityDiscoveryService });
container.registerSingleton(GAME_LOGS_REPOSITORY, DrizzleGameLogsRepository);
container.registerSingleton(GAME_COMMUNITY_REPOSITORY, DrizzleGameCommunityRepository);
container.registerSingleton(MOVIE_COMMUNITY_REPOSITORY, DrizzleMovieCommunityRepository);
container.registerSingleton(MOVIE_ACTIVITY_REPOSITORY, DrizzleMovieActivityRepository);
container.registerSingleton(MOVIE_DASHBOARD_REPOSITORY, DrizzleMovieDashboardRepository);
container.registerSingleton(PACKAGES_REPOSITORY, DrizzlePackagesRepository);
container.registerSingleton(JOBS_REPOSITORY, DrizzleJobsRepository);
// Process-wide LISTEN job_events; connects lazily on the first stream subscriber.
container.registerSingleton(JOB_EVENTS_LISTENER, PgJobEventsListener);
container.registerInstance(JOB_STREAM_TOKEN_CONFIG, readJobStreamTokenConfig());
container.registerSingleton(JOB_STREAM_TOKEN_SERVICE, JobStreamTokenService);

// Readers and writers check `enabled` before calling the client, which rejects
// every request while Meilisearch is not configured.
const meilisearchConfig = readMeilisearchConfig();
container.registerInstance(MEILISEARCH_CONFIG, meilisearchConfig);
container.registerInstance(SEARCH_CLIENT, new MeilisearchClient(meilisearchConfig));

// CQRS segregation: read and write sides are separate implementations behind
// distinct, narrow tokens.
container.registerSingleton(SEARCH_READER, MeilisearchSearchReader);
container.registerSingleton(SEARCH_WRITER, MeilisearchSearchWriter);

container.registerSingleton(EVENT_BUS, InProcessEventBus);

// Wire up synchronous, in-process domain-event subscribers.
container.resolve(SearchEventSubscriber).register();

export { container };
