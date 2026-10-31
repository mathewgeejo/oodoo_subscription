FROM node:22-bookworm-slim AS app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
