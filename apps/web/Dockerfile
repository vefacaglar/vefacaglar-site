FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.2.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --filter web...
COPY apps/web ./apps/web
# Public values are compiled into the image. No runtime credentials enter the build.
ARG NEXT_PUBLIC_API_URL=https://api2.vefacaglar.com
ARG NEXT_PUBLIC_SITE_URL=https://vefacaglar.com
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter web build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
