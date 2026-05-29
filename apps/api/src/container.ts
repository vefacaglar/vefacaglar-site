import { container } from "tsyringe";
import { db } from "@vefacaglar/db";
import { DB_CONNECTION } from "./db.tokens";
import { DbProvider } from "./db.provider";
import { TransactionManager } from "./transaction.manager";
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
import { DEVELOPERS_REPOSITORY, PUBLISHERS_REPOSITORY, GENRES_REPOSITORY, THEMES_REPOSITORY, PLATFORMS_REPOSITORY, GAMES_REPOSITORY } from "./modules/games/games.tokens";
import { DrizzleDevelopersRepository } from "./modules/games/developers.repository";
import { DrizzlePublishersRepository } from "./modules/games/publishers.repository";
import { DrizzleGenresRepository } from "./modules/games/genres.repository";
import { DrizzleThemesRepository } from "./modules/games/themes.repository";
import { DrizzlePlatformsRepository } from "./modules/games/platforms.repository";
import { DrizzleGamesRepository } from "./modules/games/games.repository";
import { PACKAGES_REPOSITORY } from "./modules/packages/packages.tokens";
import { DrizzlePackagesRepository } from "./modules/packages/packages.repository";

container.registerInstance(DB_CONNECTION, db);
container.registerSingleton(DbProvider);
container.registerSingleton(TransactionManager);
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



export { container };
