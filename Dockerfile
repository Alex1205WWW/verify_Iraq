# Verification Dispatch MVP
#
# Deliberately a single-stage image on full node_modules rather than Next's
# standalone output. Standalone does not trace the Prisma engine or the seed
# script, and working around that costs more than the extra image size is
# worth for a demo. Reliability first.

FROM node:22-slim

# Prisma needs openssl present or the query engine refuses to load.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# The build must not touch the real database. Every route in this app is
# server-rendered on demand, so a throwaway file is enough to satisfy Prisma
# during the build.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npx next build

ENV NODE_ENV=production
ENV PORT=3000

# Both of these live on the mounted volume. The database and the uploaded
# photos are the only state this app has, and losing either one loses the job
# evidence, which is the whole product.
ENV DATABASE_URL="file:/data/app.db"
ENV UPLOADS_DIR="/data/uploads"

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
