FROM oven/bun AS build
WORKDIR /app
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun scripts/build.ts
RUN bunx @capgo/cli bundle zip --path dist --name bundle && mv bundle.zip dist/bundle.zip

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
