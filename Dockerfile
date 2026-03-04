FROM oven/bun AS build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN cd node_modules/better-sqlite3 && bunx --bun prebuild-install || bunx --bun node-gyp rebuild
RUN bun scripts/build.ts
RUN bunx @capgo/cli bundle zip --path dist --name bundle && mv bundle dist/bundle.zip

FROM oven/bun
WORKDIR /app
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/src src
COPY --from=build /app/scripts scripts
COPY --from=build /app/data data
COPY --from=build /app/static static
COPY --from=build /app/package.json .
EXPOSE 8000
ENTRYPOINT ["scripts/entrypoint.sh"]
