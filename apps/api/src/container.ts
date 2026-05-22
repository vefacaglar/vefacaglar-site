import { container } from "tsyringe";
import { db } from "@vefacaglar/db";
import { DB_CONNECTION } from "./db.tokens";
import { POSTS_REPOSITORY } from "./modules/posts/posts.tokens";
import { DrizzlePostsRepository } from "./modules/posts/posts.repository";
import { PAGES_REPOSITORY } from "./modules/pages/pages.tokens";
import { DrizzlePagesRepository } from "./modules/pages/pages.repository";
import { USERS_REPOSITORY, SESSIONS_REPOSITORY } from "./modules/auth/auth.tokens";
import { DrizzleUsersRepository } from "./modules/auth/users.repository";
import { DrizzleSessionsRepository } from "./modules/auth/sessions.repository";

container.registerInstance(DB_CONNECTION, db);
container.registerSingleton(POSTS_REPOSITORY, DrizzlePostsRepository);
container.registerSingleton(PAGES_REPOSITORY, DrizzlePagesRepository);
container.registerSingleton(USERS_REPOSITORY, DrizzleUsersRepository);
container.registerSingleton(SESSIONS_REPOSITORY, DrizzleSessionsRepository);

export { container };
