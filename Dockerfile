FROM node:22.13.1-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
ENV CODEX_HOME=/app/.research-observer/codex

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    latexmk \
    biber \
    ghostscript \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-pictures \
    texlive-science \
    texlive-xetex \
    texlive-luatex \
  && rm -rf /var/lib/apt/lists/* \
  && git config --system --add safe.directory /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/progress /app/annotations /app/manuscripts /app/.research-observer /app/.next /app/public/_research \
  && chown -R 1001:1001 /app \
  && chmod 0777 /app/annotations /app/manuscripts /app/.research-observer /app/.next /app/public/_research

USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
