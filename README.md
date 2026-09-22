# Research Observer

Research Observer is a convention-driven Next.js workspace for research progress. Plain Markdown remains the source of truth; the application compiles those notes into validated navigation, relationships, diagnostics, and a static search index.

Use it for literature exploration, experiments, model development, field notes, design research, lab work, historical research, or any other research process.

## Quick start

Use Node 22 (see `.nvmrc`), install dependencies, then start development:

```bash
npm install
npm run dev
```

`npm run dev` starts the research watcher, prepares the local PDF.js runtime, compiles search/media artifacts, and then starts Next.js.

## The note convention

Put research notes directly in `progress/` and prefix each Markdown filename with a numeric order:

```text
progress/
├── 00_start_here.md
├── 01_problem_and_questions.md
├── 02_first_experiment.md
├── 03_results.md
├── figures/
│   ├── accuracy.svg
│   └── ablation.png
└── media/
    └── demo.mp4
```

Files matching a numeric prefix such as `00_*.md`, `10_*.md`, or `100_*.md` are discovered automatically. The filename number controls sequence only.

## Stable research IDs

For long-lived work, add a stable `id` in frontmatter. The `id` becomes the canonical URL and should not change when a note is renamed or reordered.

```yaml
---
id: reranking-experiment-v2
title: Reranking experiment v2
summary: Tests whether reranking improves recall under a fixed latency budget.
type: experiment
status: validating
date: 2026-09-22
tags:
  - retrieval
  - reranking
aliases:
  - reranking-v2
---
```

`id`, `type`, `status`, `date`, `tags`, and `aliases` are optional for hand-written notes, but stable IDs are strongly recommended. Allowed types/statuses live in `research-observer.config.json`.

Old filename slugs and declared aliases continue to resolve and redirect to the canonical ID.

## Instructions for AI-generated research notes

`AGENTS.md` is the authoritative authoring contract for AI agents. It defines:

- filename/order rules
- stable IDs and aliases
- allowed metadata
- Markdown structure
- internal link syntax
- figure/media paths
- math support
- citation/non-fabrication rules
- forbidden raw HTML/executable content
- local validation commands

Any AI that creates or edits files in `progress/` should read `AGENTS.md` first.

## Local integrity checks — no GitHub Actions required

This project intentionally does not assume GitHub Actions. The quality gate lives in the repository and runs locally or in any deployment environment:

```bash
npm run doctor       # research content integrity
npm test             # compiler regression tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run check        # doctor + tests + typecheck + lint
npm run check:full   # everything above + production build
```

`npm run doctor` reports broken note links, missing assets, invalid IDs/dates/statuses/types, unsafe paths, symlinks, duplicate identities, orphan assets, and other workspace diagnostics. Errors produce a non-zero exit code.

## Research compiler

The app does not independently reinterpret the folder for every feature. `lib/research/compiler.mjs` is the canonical content compiler.

```text
progress/*.md + research assets
            │
            ▼
    Research compiler
            │
     ┌──────┼──────────┐
     ▼      ▼          ▼
manifest  search    diagnostics
     │      index       │
     └──────┼───────────┘
            ▼
         Next.js
```

`npm run research:compile` writes generated artifacts to `public/_research/`. That directory is ignored by Git because it is regenerated before development/build.

The compiler currently provides:

- ordered note discovery
- stable IDs + aliases
- normalized frontmatter
- word/read-time metadata
- internal references and backlinks
- heading extraction
- asset inventory
- link/asset validation
- symlink/path checks
- workspace diagnostics
- static search data

## Search

`Cmd/Ctrl + K` (or `/`) opens research search. Search uses the precompiled static index rather than reparsing files on every keystroke.

Structured filters are supported:

```text
type:experiment
status:validating
tag:retrieval
type:result tag:retrieval latency
```

## Markdown and math

Research notes support GitHub-Flavored Markdown, tables, task lists, fenced code, note links, and KaTeX math.

```md
See [the experiment](02_first_experiment.md).

Inline math: $E = mc^2$

$$
\operatorname{score}(x) = \frac{1}{1 + e^{-x}}
$$
```

Use Markdown filenames when linking research notes. Research Observer resolves those links to stable canonical IDs automatically.

## Figures and research media

Store assets under `progress/` and reference them with relative paths:

```md
![Accuracy by epoch](figures/accuracy.svg)
![PDF diagram](figures/system-diagram.pdf)
![Experiment demo](media/demo.mp4)
![Interview audio](media/interview.wav)
```

Supported media includes common browser-viewable image formats, PDF, MP4/WebM/OGV video, MP3/WAV/M4A/AAC/FLAC audio, plus CSV/JSON/TXT downloads.

During research compilation, approved local assets are copied to `public/_research/media/` and served as static deployment assets. This avoids relying on the runtime server filesystem and lets the hosting layer/CDN handle caching and byte-range delivery.

## PDF research reader

Local PDFs under `progress/` appear in **Papers** and open in a first-class PDF.js/React-PDF reader with page navigation, lazy thumbnails, zoom/rotation, full-document text search, selectable text, extracted text view, related research notes, and page-deep-linked URLs.

For literature notes, companion metadata can be declared with verified values:

```yaml
type: literature
pdf: papers/smith-2026.pdf
authors:
  - Jane Smith
year: 2026
doi: 10.xxxx/verified-doi
```

The PDF worker, cMaps, standard fonts, and WASM assets are copied from the installed `pdfjs-dist` package into generated local assets; the reader does not require a public CDN.

## Codex Ask mode

In local development, Research Observer exposes an optional Codex **Ask** inspector on research notes and PDFs. The integration uses `@openai/codex-sdk` server-side with a read-only sandbox, approvals disabled, network/web search disabled, and explicit visible research context.

- **Ask** is read-only analysis.
- **Draft** is also read-only and returns a proposed research change without writing files.
- **Act** runs Codex in a detached Git worktree with workspace-write access there, rejects any changes outside `progress/**` and any `AGENTS.md` policy-file edit, runs `npm run doctor` against the proposal, and presents the patch for explicit human review.
- **Apply** is a separate user action. Oversized or binary patches are intentionally non-applicable because the UI cannot fully review them. For reviewable text patches, Apply refuses overlapping live edits, checks the patch with Git, applies it, reruns the doctor, and rolls the patch back if validation fails.
- Selected PDF text is treated as untrusted evidence, not agent instructions.
- Production embedded Codex is disabled until a separate authenticated agent service is configured.
- Set `RESEARCH_OBSERVER_CODEX=0` to disable the local bridge.
- Optionally set `RESEARCH_OBSERVER_CODEX_MODEL` to select a locally available Codex model.

Authenticate the local Codex CLI/SDK before using the panel. If Codex is unavailable, Overview, Notes, Papers, Evidence, and PDF reading continue to work normally.

Repository-scoped Codex instructions live in root/nested `AGENTS.md` files and reusable workflows live under `.agents/skills/`.

## Configuration

`research-observer.config.json` controls the workspace contract, including suggested research types/statuses, media extensions, asset-size warnings, and the progress directory. By default, unknown type/status values are warnings for backward compatibility; set `strictVocabulary: true` to make them doctor errors.

If you intentionally extend the research vocabulary, update the config and `AGENTS.md` together.

## Static-first rendering

Research note routes are pre-generated from the committed workspace, while development still permits newly added notes without restarting. Search and approved local research media are generated into `public/_research/` before production builds.

The app therefore follows a static-first deployment model without requiring request-time Markdown parsing or access to the source `progress/` filesystem.

## Dependency reproducibility

Direct dependency versions are pinned exactly. A `package-lock.json` is still required for fully deterministic transitive dependency resolution.

When npm registry access is available, run:

```bash
npm install
git add package-lock.json
git commit -m "chore: lock npm dependencies"
```

After a lockfile is committed, prefer `npm ci` for clean/release installs.

## Architecture

See `docs/ARCHITECTURE.md` for invariants, trust boundaries, compiler flow, and extension guidance.

## License

MIT.
