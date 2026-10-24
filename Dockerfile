# Single image: Express API + built React app served as static files
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev
COPY server/prisma server/prisma
RUN cd server && npx prisma generate
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
WORKDIR /app/server
EXPOSE 4200
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
