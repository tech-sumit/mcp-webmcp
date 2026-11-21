FROM node:22-alpine AS base
# Pin pnpm (matches CI). pnpm@latest enforces a 1-day minimumReleaseAge,
# which breaks release builds right after a dependency is published.
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
RUN pnpm build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 3100
EXPOSE 8765

CMD ["node", "dist/cli.js", "start", "--no-cdp", "--extension"]
