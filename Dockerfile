# syntax=docker/dockerfile:1.7

FROM node:22.13.1-bookworm-slim AS toolchain

ENV DEBIAN_FRONTEND=noninteractive
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
ENV CODEX_HOME=/app/.research-observer/codex

WORKDIR /app

# TeX Live is the heaviest image layer. Keep it isolated so a successful
# installation is reusable by both the smoke target and the full app image.
# Debian package downloads can be slow/intermittent on arm64 Docker hosts, so
# use bounded retries/timeouts instead of allowing one mirror request to hang
# indefinitely.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get \
      -o Acquire::Retries=6 \
      -o Acquire::http::Timeout=30 \
      -o Acquire::https::Timeout=30 \
      -o Acquire::ForceIPv4=false \
      update \
  && apt-get \
      -o Acquire::Retries=6 \
      -o Acquire::http::Timeout=30 \
      -o Acquire::https::Timeout=30 \
      install -y --no-install-recommends \
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

# This target is intentionally small and stable. It lets verification prove the
# expensive OS/TeX layer independently before npm/application layers are built.
FROM toolchain AS latex-toolchain

RUN latexmk -v \
  && pdflatex --version \
  && xelatex --version \
  && lualatex --version \
  && bibtex --version \
  && biber --version \
  && synctex --version

FROM toolchain AS app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /app/progress /app/annotations /app/manuscripts /app/.research-observer /app/.next /app/public/_research \
  && chown -R 1001:1001 /app \
  && chmod 0777 /app/annotations /app/manuscripts /app/.research-observer /app/.next /app/public/_research

USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
