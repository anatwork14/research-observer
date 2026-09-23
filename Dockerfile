FROM node:22.13.1-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && git config --system --add safe.directory /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/progress /app/.research-observer /app/.next /app/public/_research /home/node/.codex \
  && chown -R node:node /app /home/node/.codex \
  && chmod 0777 /app/.research-observer /app/.next /app/public/_research \
  && chmod 0700 /home/node/.codex

USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
