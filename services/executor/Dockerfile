# Build the executor from the monorepo root (build context = repo root).
# turbo's `^build` compiles @shared/db, sim-core, sui-propfirm, venues first.
FROM node:22-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@service/executor
# Fail the build LOUDLY if the compiled output is missing, rather than shipping a
# broken image that crash-loops on a missing module.
RUN test -f /app/services/executor/dist/index.js \
  || (echo "BUILD ERROR: services/executor/dist/index.js was not produced" \
      && ls -la /app/services/executor && exit 1)

# Runtime: just Node + the built workspace (pnpm symlinks resolve @shared/*).
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/services/executor
RUN test -f dist/index.js || (echo "RUNTIME ERROR: dist/index.js missing after copy" && ls -la . && exit 1)
EXPOSE 8788
CMD ["node", "dist/index.js"]
