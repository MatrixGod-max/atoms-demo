# Quark self-hosting image. Validator (headless Chrome) degrades gracefully when
# chromium is absent; install it in the runtime stage if you want real runtime checks.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
# Optional: uncomment for the Validator stage to run real Chrome checks.
# RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/* \
#  && export CHROME_PATH=/usr/bin/chromium
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/templates ./templates
COPY --from=build /app/scripts ./scripts
VOLUME /data
EXPOSE 3000
CMD ["sh", "-c", "node scripts/seed-templates.mjs --no-s3 || true; npx next start -p ${PORT}"]
