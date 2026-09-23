FROM node:22.13.1-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/progress /app/.research-observer \
  && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
