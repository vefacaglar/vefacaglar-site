FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.2.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/db/package.json ./packages/db/package.json

FROM dependencies AS build
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api ./apps/api
COPY packages/db ./packages/db
RUN pnpm --filter @vefacaglar/db exec tsc && pnpm --filter api exec tsc

FROM dependencies AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --filter api...

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001
COPY --from=production-dependencies --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/packages/db/dist ./packages/db/dist
USER node
EXPOSE 3001
CMD ["node", "--enable-source-maps", "apps/api/dist/server.js"]
