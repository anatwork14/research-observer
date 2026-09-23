# Observaire

Observaire is a Markdown-first research intelligence workspace. Plain files remain the source of truth; the application auto-indexes them into projects, navigation, search, evidence, graphs, diagnostics, timelines, versions, and analytics.

Use it for literature exploration, experiments, model development, field notes, design research, lab work, historical research, or any other research process where the durable record should stay readable outside the application.

## Fastest start: Docker

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:4173
```

The supplied Compose setup bind-mounts the host research directory into Observaire:

```text
./progress  →  /app/progress
```

So research imported through the website is written to your **real host folder**, not only into the container. Rebuilding or recreating the container does not delete the Markdown research source.

You can change the host research directory without changing Observaire:

```bash
OBSERVAIRE_RESEARCH_DIR=/absolute/path/to/research docker compose up --build
```

You can also change the browser port:

```bash
OBSERVAIRE_PORT=4180 docker compose up --build
```

On Linux, if needed, pass your host ownership IDs:

```bash
OBSERVAIRE_UID=$(id -u) OBSERVAIRE_GID=$(id -g) docker compose up --build
```

See `docs/PROJECT_FOLDERS_AND_DOCKER.md` for the complete storage/import behavior.

## Create a project without editing config

Open **Projects** in the web application, then choose or drop one folder:

```text
My Research Project/
├── 00_question.md
├── 01_literature.md
├── 02_hypothesis.md
├── 03_experiment.md
├── papers/
│   └── source.pdf
└── figures/
    └── result.svg
```

Observaire validates the folder, writes it under the configured research directory (`progress/` by default), registers it as a project, recompiles the workspace, and refreshes the live index.

With the default Compose mount, that example becomes a real host directory:

```text
<repository>/progress/My Research Project/
```

No `research-observer.config.json` project edit is required.

The browser importer is transactional: invalid imports are rolled back instead of leaving a half-created project, and an existing project directory is never silently overwritten.

### Direct host copy works too

The web importer is optional. With the default configuration, copy a folder directly into the host `progress/` directory:

```text
progress/
└── New Study/
    ├── 00_scope.md
    ├── 01_sources.md
    └── 02_analysis.md
```

Observaire watches the configured research tree and recompiles it. Docker Compose also enables a 1-second signature poll so host changes still appear on Docker Desktop/filesystems where recursive filesystem events are unreliable.

## Project folder convention

A top-level folder under the configured research root (`progress/` by default) becomes a research project when it contains at least one ordered Markdown note matching the numeric-prefix convention:

```text
00_*.md
01_*.md
10_*.md
100_*.md
```

Numbering is **per project**, not global:

```text
progress/
├── Project A/
│   ├── 00_question.md
│   ├── 01_method.md
│   └── 02_result.md
└── Project B/
    ├── 00_question.md
    ├── 01_literature.md
    └── 02_experiment.md
```

The filename number controls sequence only. It is not object identity.

Asset-only folders such as `figures/`, `papers/`, `data/`, or `media/` do not become projects unless they themselves contain ordered Markdown research notes.

Legacy root-level ordered notes such as `progress/00_start_here.md` remain supported with the default research root.

## Stable project identity

If a project folder has no project manifest, Observaire derives a lowercase kebab-case ID from its folder name. For example:

```text
progress/My Retrieval Study/
```

becomes:

```text
my-retrieval-study
```

For project identity that should survive a directory rename, add `.observaire-project.json` inside the folder:

```json
{
  "schemaVersion": 1,
  "id": "retrieval-study",
  "label": "Retrieval Study",
  "description": "Retrieval experiments and supporting evidence."
}
```

The website importer creates this file automatically when one is not supplied.

Inside an auto-indexed folder project, you normally do **not** need a `research:` field in every note. Folder membership is the project source of truth. If a nested note contains a conflicting `research` value, the folder project wins and the compiler emits a diagnostic.

`researchProjects` in `research-observer.config.json` remains supported for legacy/root-level notes, intentionally predeclared projects, and advanced portfolio configuration.

## Stable research-object IDs

For long-lived work, give each durable Markdown object a stable lowercase kebab-case `id`. The ID becomes the canonical route identity and should not change when the note is reordered or renamed.

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
  - reranking-v1-name
---
```

The canonical contract is `docs/OBSERVAIRE_DATA_CONTRACT.md`.

## Run without Docker

Use Node 22.13 or newer, but earlier than 25:

```bash
node --version
npm ci
npm run dev
```

`npm run dev` starts the research watcher, prepares the local PDF.js runtime, compiles search/media artifacts, and starts Next.js.

If port 3000 is busy:

```bash
npm run dev -- --port 4173
```

## Local integrity checks

The repository is local-first and does not require GitHub Actions for its quality gate:

```bash
npm run doctor       # research content integrity
npm test             # compiler/runtime regression tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run check        # doctor + tests + typecheck + lint
npm run check:full   # everything above + production build
```

`npm run doctor` reports broken note links, missing assets, invalid IDs/dates/statuses/types, project-folder conflicts, unsafe paths, symlinks, duplicate identities, orphan assets, and other workspace diagnostics. Errors produce a non-zero exit code.

## Research compiler

`lib/research/compiler.mjs` is the canonical content compiler. UI surfaces do not maintain independent project registries.

```text
progress/                 # default configured research root
├── Project A/00_*.md + assets
├── Project B/00_*.md + assets
└── legacy root notes
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

`npm run research:compile` writes generated artifacts to `public/_research/`. That directory is ignored by Git because it is rebuildable output, not the research database.

The compiler provides:

- project-folder auto-discovery;
- independent note ordering per project;
- folder-local project manifests;
- stable IDs + aliases;
- normalized frontmatter;
- nested relative references and backlinks;
- typed semantic relationships;
- word/read-time metadata;
- heading extraction;
- asset inventory;
- link/asset validation;
- symlink/path checks;
- workspace health diagnostics;
- search, graph, manifest, and health artifacts.

## Search and Collections

`Cmd/Ctrl + K` (or `/`) opens research search.

Structured filters include:

```text
research:my-retrieval-study
type:experiment
status:validating
tag:retrieval
type:result tag:retrieval latency
```

Collections use the same indexed dimensions and can combine filters.

## Markdown and math

Research notes support GitHub-Flavored Markdown, tables, task lists, fenced code, note links, and KaTeX math.

Inside one project folder:

```md
See [the experiment](02_first_experiment.md).

![Accuracy](figures/accuracy.svg)

Inline math: $E = mc^2$

$$
\operatorname{score}(x) = \frac{1}{1 + e^{-x}}
$$
```

An intentional cross-project file reference may use a real relative path, for example:

```md
See [the evaluation method](../Evaluation Study/01_method.md).
```

Use stable IDs rather than filenames for semantic `relationships.target` values.

## Figures and research media

Keep project-specific assets beside the project when practical:

```text
My Project/
├── 00_question.md
├── figures/
│   └── accuracy.svg
├── papers/
│   └── source.pdf
└── media/
    └── demo.mp4
```

Supported media includes common browser-viewable image formats, PDF, MP4/WebM/OGV video, MP3/WAV/M4A/AAC/FLAC audio, plus CSV/JSON/TXT downloads.

Approved local assets are compiled to `public/_research/media/` for the web runtime while the originals remain durable source files under the configured research root.

## PDF research reader

Local PDFs under the configured research root appear in **Papers** and open in a PDF.js/React-PDF research reader with page navigation, lazy thumbnails, zoom/rotation, full-document text search, mouse/touch text selection, extracted text view, related notes, Codex context, and page-deep-linked URLs.

A literature note can use verified metadata:

```yaml
type: literature
pdf: papers/smith-2026.pdf
authors:
  - Jane Smith
year: 2026
doi: 10.xxxx/verified-doi
```

The PDF worker, cMaps, standard fonts, and WASM assets are copied from the installed `pdfjs-dist` package into local generated runtime assets; no public PDF.js CDN is required.

## Evidence

PDF selections can be stored as durable `type: evidence` objects with PDF/page provenance. Reviewed Consensus results can also be saved as external scholarly evidence with canonical provider ID/DOI/HTTPS source identity.

Folder-backed projects keep generated evidence inside their own project folder at the next project-local order number, so the project remains portable as a self-contained research tree.

Observaire keeps discovery context separate from verified source quotations and does not automatically create `supports`, `contradicts`, `answers`, or other strong semantic relationships from search results.

Local development enables evidence writes by default. Production remains read-only unless `RESEARCH_OBSERVER_WRITES=1` is explicitly configured.

## Consensus and New Research

Observaire can use Consensus as an external peer-reviewed literature provider.

Configure the API key server-side through **Settings** or an environment variable. Never expose the key in browser code or commit it to the repository.

**New Research** is staged:

1. enter a topic/question and optional objective;
2. search Consensus;
3. screen and select papers;
4. send only the selected bounded literature packet to local Codex;
5. Codex runs read-only/network-disabled and proposes synthesis, gaps, falsifiable hypotheses, experiments, next actions, and cautions;
6. the proposal remains review-only unless an explicit later workflow applies a reviewed change.

Consensus rank, semantic score, citation count, takeaways, and abstracts are discovery signals, not automatic evidence of a scientific claim.

## Codex and Direct Edit

Research-note and PDF contexts can use the local Codex integration.

- **Ask** is read-only analysis.
- **Draft** is read-only proposed research change.
- **Act** snapshots the current live research filesystem into an isolated detached review worktree, so imported/untracked or already-uncommitted research does not need to be committed first. Changes outside the configured research root are rejected.
- **Apply** is an explicit separate action after patch/doctor review. New proposals store per-file baseline blob states, so Apply rejects touched files changed after review rather than rejecting research merely because it was dirty relative to Git HEAD.
- **Direct Edit** keeps browser-local drafts, shows a review diff, validates with the research doctor, rejects stale overwrites, and rolls back failed saves.
- Codex and Direct Edit proposal types cannot be cross-applied.

Act restores its frozen review index after the Codex turn, so accidental staging inside the isolated worktree cannot erase the human-review comparison point. The live repository index is not staged or committed by Act/Apply.

Codex authentication delegates to the installed Codex CLI. Observaire checks actual CLI login status and does not read or expose Codex access/refresh tokens.

Set `RESEARCH_OBSERVER_CODEX=0` to disable the local bridge. Optionally use `RESEARCH_OBSERVER_CODEX_MODEL` to select a locally available model.

## Graph, Health, and Research Intelligence

The **Graph** distinguishes explicit typed relationships from ordinary Markdown reference edges.

The **Health** view reports factual compiler conditions such as unanswered questions, experiments without results, decisions without basis, incomplete literature metadata, evidence without provenance, and missing stable IDs.

The **Insights** workspace supports:

- one or multiple project scopes;
- research-object type/status distributions;
- research pipeline charts;
- typed-relationship distributions;
- activity-over-time charts;
- project composition comparison;
- health heatmaps;
- cross-project relationship matrices;
- multi-lane research timelines;
- semantic version lineages and Markdown diffs.

### Semantic research versions

Technical edits remain available through Git history. Use the typed `supersedes` relationship only for meaningful intellectual versions that should remain independently reviewable:

```yaml
relationships:
  - type: supersedes
    target: hypothesis-v1
```

**Insights → Timeline** draws these lineages across project lanes; **Insights → Versions** compares semantic versions.

## AI authoring instructions

`AGENTS.md` is the repository-level AI authoring contract. `progress/AGENTS.md` (for the default research root), `docs/OBSERVAIRE_DATA_CONTRACT.md`, the JSON Schema, and `.agents/skills/create-research-note/SKILL.md` refine the same model.

AI-created research must preserve:

- folder/project identity;
- stable object IDs;
- filename ordering per project;
- verified provenance;
- readable body links versus semantic relationships;
- non-fabrication rules;
- existing valid project and vocabulary constraints.

The **Instruction** tab exposes the repository's actual prompt/contract sources for external AI handoff and falls back to repository-level contracts when an external bind mount does not contain `progress/AGENTS.md`.

## Configuration

`research-observer.config.json` still controls global workspace behavior such as:

- allowed object types;
- statuses;
- relationship vocabulary;
- allowed media extensions;
- asset-size thresholds;
- saved Collections;
- legacy/predeclared `researchProjects`;
- progress directory location (`progressDir`).

For ordinary new research projects, you no longer need to edit `researchProjects`; create/import a project folder instead.

If you intentionally extend a global vocabulary, update the config and authoring contracts together.

## Storage model

Durable research source lives under the configured `progressDir` (`progress/` by default):

```text
<progressDir>/**
```

Folder-local project metadata:

```text
<progressDir>/<project>/.observaire-project.json
```

Rebuildable generated index/media:

```text
public/_research/**
```

Local integration/Codex transient state:

```text
.research-observer/**
```

Under the supplied Docker Compose configuration, the host research directory is bind-mounted at `/app/progress`, while `.research-observer/**` uses the separate `observaire-state` named volume. Do not confuse transient app state with durable research source.

## Architecture and detailed guides

- `docs/ARCHITECTURE.md` — architecture and trust boundaries.
- `docs/OBSERVAIRE_DATA_CONTRACT.md` — canonical research content contract.
- `docs/PROJECT_FOLDERS_AND_DOCKER.md` — folder auto-indexing, browser import, and Docker persistence.
- `docs/INTEGRATIONS_AND_DIRECT_EDIT.md` — integration state, filesystem-first Codex review, and Direct Edit safety model.
- `docs/VERIFICATION_EVIDENCE_SETTINGS_EDIT.md` — release/browser verification matrix for evidence/settings/edit UX.
- `docs/VERIFICATION_PROJECT_FOLDERS_DOCKER.md` — project-folder and host-persistence verification matrix.
- `docs/VERIFICATION_CODEX_FILESYSTEM_REVIEW.md` — filesystem-first Act/Apply verification matrix.

## License

MIT.
