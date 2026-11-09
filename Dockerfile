FROM node:22-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY App.tsx index.ts app.json tsconfig.json ./
COPY components ./components
COPY lib ./lib
# Empty uses the same origin for camera UI, analysis and service APIs.
ARG EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL EXPO_NO_TELEMETRY=1
RUN npm run build:web

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY api ./api
COPY commerce-web ./commerce-web
COPY --from=web-build /app/dist ./dist
ENV API_HOST=0.0.0.0 API_PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node", "api/server.mjs"]
