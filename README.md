# Observaire

Observaire is a **local-first, Markdown-first research intelligence workspace**. Durable research stays in ordinary files; the application compiles those files into projects, navigation, search, evidence, graph views, health diagnostics, timelines, semantic versions, analytics, PDF provenance, manuscript tooling, and optional AI-assisted workflows.

Observaire is designed for research that should remain readable and portable outside the application. It does not require a separate research database or a cloud backend.

## Local-first v1 status

The local-first v1 product loop is implemented:

- folder-backed and legacy research projects;
- canonical Markdown compiler with stable IDs, aliases, links, typed relationships, assets, graph, search, health, and project statistics;
- project import and direct filesystem discovery;
- multi-project orchestration with explicit status/dependencies/next-step editing;
- graph-heavy Insights, timeline, semantic evolution, version comparison, and drill-down analytics;
- local PDF reader, annotations, stale-anchor handling, region capture, reviewed source text, and reviewed PDF Evidence promotion;
- immutable spatial provenance snapshots for promoted PDF regions;
- Consensus literature search with reviewed Evidence promotion and explicit semantic relationships;
- Research Assist workspace context grounded in canonical compiler facts;
- New Research flow from topic → literature selection → read-only Codex plan → exact reviewed workspace scaffold → explicit Apply;
- Codex Ask/Draft plus reviewed Act/Apply for research changes;
- browser Direct Edit with draft recovery, diff review, stale protection, validation, and rollback;
- LaTeX IDE, BibTeX/citation bridge, SyncTeX, optional TexLab intelligence, and manuscript review flows;
- Local Workspace Health and safe rebuild/repair actions;
- large-workspace hardening with linear reverse indexes and incremental generated-media mirroring.

See `docs/LOCAL_FIRST_V1_RELEASE.md` for the release contract and `progress.md` for the current implementation/verification status.

## Fastest start: Docker

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:4173
```

The supplied Compose setup bind-mounts durable research source from the host:

```text
./progress  →  /app/progress
```

Rebuilding or recreating the container does not delete Markdown research source.

Use a different host research directory without changing the in-container contract:

```bash
OBSERVAIRE_RESEARCH_DIR=/absolute/path/to/research docker compose up --build
```

Change the browser port if needed:

```bash
OBSERVAIRE_PORT=4180 docker compose up --build
```

On Linux, host ownership can be passed explicitly:

```bash
OBSERVAIRE_UID=$(id -u) OBSERVAIRE_GID=$(id -g) docker compose up --build
```

See `docs/PROJECT_FOLDERS_AND_DOCKER.md` for storage/import behavior.

## Run without Docker

Use Node 22.13 or newer, but earlier than 25:

```bash
node --version
npm ci
npm run dev
```

`npm run dev` prepares the local PDF.js runtime, compiles research artifacts, watches the configured workspace, and starts Next.js.

If port 3000 is busy:

```bash
npm run dev -- --port 4173
```

## Project model

A top-level folder under the configured research root (`progress/` by default) becomes a project when it contains ordered Markdown research notes:

```text
progress/
├── Retrieval Study/
│   ├── .observaire-project.json
│   ├── 00_question.md
│   ├── 01_literature.md
│   ├── 02_hypothesis.md
│   ├── papers/
│   │   └── source.pdf
│   └── figures/
│       └── result.svg
└── Evaluation Study/
    ├── 00_question.md
    └── 01_experiment.md
```

Ordering is **per project**. The filename number controls sequence, not identity.

For durable object identity, use a stable lowercase kebab-case `id`:

```yaml
---
id: reranking-experiment-v2
title: Reranking experiment v2
type: experiment
status: validating
date: 2026-09-22
tags:
  - retrieval
aliases:
  - reranking-v1-name
---
```

For stable folder identity across renames, use `.observaire-project.json`:

```json
{
  "schemaVersion": 1,
  "id": "retrieval-study",
  "label": "Retrieval Study",
  "description": "Retrieval experiments and supporting evidence."
}
```

The browser importer can create the project manifest automatically. Direct host copy also works.

Legacy root-level ordered notes remain supported.

The canonical content contract is `docs/OBSERVAIRE_DATA_CONTRACT.md`.

## Canonical compiler and generated artifacts

`lib/research/compiler.mjs` owns the compiled research workspace. Product surfaces do not maintain independent research registries.

```text
progress/ + research-observer.config.json
                 │
                 ▼
        canonical compiler
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
   manifest    search     graph/health
       │         │         │
       └─────────┼─────────┘
                 ▼
               UI
```

Generated artifacts live under:

```text
public/_research/**
```

They are rebuildable and are not the research source of truth.

Large-workspace generation uses transient fingerprints in:

```text
.research-observer/research-media-state.json
```

Unchanged heavy assets are reused instead of recopied on every artifact rebuild. This state is disposable: deleting it causes a safe generated-media rebuild.

## Local integrity and release checks

The project does not require GitHub Actions for its quality gate:

```bash
npm run doctor       # research/content integrity
npm test             # compiler/runtime regression tests
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run check        # doctor + tests + typecheck + lint
npm run check:full   # everything above + production build
```

Cross-domain and Docker/toolchain verification commands are documented in `docs/MERGE_READINESS.md`.

`npm run doctor` covers broken links, missing assets, IDs/dates/types/statuses, project conflicts, orchestration configuration, unsafe paths, symlinks, duplicate identities, orphan assets, and other workspace integrity conditions.

## Research orchestration

**Projects** is the local portfolio control plane.

Orchestration metadata is explicit and human-authored:

```text
queued
active
blocked
done
untracked
```

Optional project metadata includes dependencies, a next step, and a coordination note. Dependency state such as `Waiting` or `Clear` is derived informational context; it does **not** rewrite authored project status.

The local Orchestration Editor supports review-before-save, same-origin checks, stale-config rejection, validation, atomic writes, and production write gating.

Cross-project research relationships do not automatically become orchestration dependencies.

## Search, graph, Insights, timeline, and versions

`Cmd/Ctrl + K` (or `/`) opens research search.

Structured filters include:

```text
research:retrieval-study
type:experiment
status:validating
tag:retrieval
type:result tag:retrieval latency
```

The Graph distinguishes ordinary Markdown references from explicit typed relationships.

The Health view reports factual compiler conditions such as unanswered questions, experiments without results, incomplete literature metadata, evidence without provenance, and missing stable IDs. These are conditions, not quality scores.

Insights supports:

- project and multi-project scopes;
- type/status/pipeline distributions;
- relationship and evidence-signal distributions;
- activity-over-time charts;
- project composition;
- health conditions;
- cross-project boundaries;
- URL-backed inspectable drill-down;
- multi-lane timelines;
- semantic revision summaries;
- authored `supersedes` lineages and Markdown version comparison.

Technical edits remain available through Git history. Use `supersedes` only for meaningful intellectual versions.

## PDF research and spatial Evidence provenance

Local PDFs appear in **Papers** and open in the local React-PDF/PDF.js reader with navigation, thumbnails, zoom/rotation, text search, text selection, extracted text, annotations, related notes, and deep-linked pages.

Annotations support selectable-text anchors and visual `area`, `figure`, and `table` regions. Anchors bind to the source PDF fingerprint; replacing the PDF surfaces stale anchors instead of silently moving them.

Visual regions keep reviewed source text separate from interpretation comments. Supported reviewed provenance kinds are:

```text
caption
ocr
transcription
```

OCR text is not automatically trusted merely because it is called OCR; promotion requires explicit review.

Durable PDF Evidence uses review-before-write. Before Apply the user can inspect exact Markdown and normalized geometry. Promoted Evidence freezes a machine-readable `observaire-pdf-annotation-v1` snapshot containing page/region/document/source-text provenance.

Later edits to the private annotation sidecar do not rewrite historical Evidence. The Evidence page can render **Spatial provenance** from canonical Markdown even when the sidecar is unavailable.

PDF Evidence promotion does not infer `supports`, `contradicts`, `answers`, confidence, or quality scores.

## Consensus and reviewed scholarly Evidence

Consensus is an optional external peer-reviewed literature provider.

Configure the API key server-side through Settings or `CONSENSUS_API_KEY`. Never expose it in browser code or commit it to the repository.

Consensus search results remain discovery context until explicitly reviewed. The default durable action is **Review evidence**, not one-click save.

A reviewed proposal shows exact Evidence Markdown before Apply. The user may author one of:

```text
no semantic relationship
supports
contradicts
answers   # only to a canonical question
```

No relationship is inferred from ranking, semantic score, abstract, takeaway, citation count, or Codex output.

## New Research: plan → reviewed scaffold

**New Research** is staged:

1. define a topic/question and optional objective;
2. search Consensus;
3. screen and select literature;
4. send only the selected bounded packet to local Codex;
5. Codex runs read-only/network-disabled and proposes synthesis, gaps, hypotheses, experiments, next actions, and cautions;
6. choose an existing project or a new folder-backed project;
7. review the exact project manifest + Markdown scaffold;
8. explicitly Apply the reviewed scaffold.

The scaffold creates planning research objects such as Question, Plan/source-trace, Hypothesis, and Experiment notes. It deliberately creates **zero Evidence objects and zero semantic Evidence edges** from literature discovery context.

Preview is read-only. Apply is stale-safe, collision-safe, compiler-validated, and transactional with rollback.

## Research Assist and Codex

Research Assist builds server-authoritative context from the canonical workspace rather than trusting browser-supplied titles/project metadata.

Context can include:

- current note identity;
- explicit incoming/outgoing relationships;
- authored Evidence signals;
- Evidence provenance;
- compiler health facts;
- project orchestration context;
- recent dated work;
- deterministic questions and literature-search ideas.

The public context inspector does not expose the raw note body. Codex receives a bounded current-note source snapshot as explicitly untrusted source data.

Codex modes:

- **Ask** — read-only analysis;
- **Draft** — read-only proposed change;
- **Act** — runs in an isolated review worktree with network disabled and path restrictions;
- **Apply** — explicit separate action after patch/doctor review.

Act/Apply use the current research filesystem as the review baseline, not Git commit cleanliness. Touched paths changed after review are rejected.

Direct Edit uses browser-local drafts, exact review diff, source hashes, Doctor validation, stale-write rejection, and rollback.

Set `RESEARCH_OBSERVER_CODEX=0` to disable the bridge. `RESEARCH_OBSERVER_CODEX_MODEL` may select a locally available model.

## LaTeX manuscripts and TexLab

The project-scoped LaTeX IDE supports `.tex`, `.bib`, `.sty`, `.cls`, and `.bst` source, stale-safe editing, build diagnostics, PDF preview, forward/reverse SyncTeX, citations/BibTeX, and reviewed manuscript workflows.

CodeMirror is used on capable desktop layouts with a simpler textarea fallback retained for narrow/mobile contexts.

Optional TexLab intelligence provides diagnostics, document symbols, and completions from the current unsaved buffer. TexLab is advisory; `latexmk`/compiler diagnostics remain authoritative.

Set `RESEARCH_OBSERVER_TEXLAB=0` to disable probing or `OBSERVAIRE_TEXLAB_BIN` to point to a local binary.

## Local Workspace Health

**Health → Local workspace** reports runtime and research-integrity state.

Safe maintenance actions only rebuild disposable/generated state, such as research artifacts or the local PDF.js runtime. Durable roots are not repair targets.

Production local maintenance is opt-in through `OBSERVAIRE_LOCAL_MAINTENANCE=1` and is separate from research-write enablement.

## Write policy

Local development enables supported research/config writes by default.

A production build started locally remains read-only for research mutations unless explicitly enabled:

```text
RESEARCH_OBSERVER_WRITES=1
```

That gate covers reviewed/local write workflows including Evidence capture, reviewed Consensus Evidence, reviewed PDF Evidence, Direct Edit, project import, New Research scaffold Apply, and the orchestration editor.

Settings credential writes and local-maintenance actions have their own explicit production controls. See `.env.example`.

Mutation routes use same-origin checks and narrowly scoped request models. Browser requests do not supply arbitrary filesystem paths.

## Storage model

Durable source:

```text
<progressDir>/**
annotations/**
manuscripts/**
research-observer.config.json
```

Folder-local project metadata:

```text
<progressDir>/<project>/.observaire-project.json
```

Generated/rebuildable state:

```text
public/_research/**
```

Transient local integration/review/cache state:

```text
.research-observer/**
```

The supplied Compose setup bind-mounts durable research, annotations, and manuscripts; transient app state uses the separate local state volume.

## AI authoring contract

`AGENTS.md`, project/root authoring instructions, `docs/OBSERVAIRE_DATA_CONTRACT.md`, the JSON Schema, and `.agents/skills/create-research-note/SKILL.md` define AI authoring behavior.

AI-created research must preserve project identity, stable IDs, per-project ordering, verified provenance, the distinction between document links and semantic relationships, and non-fabrication rules.

## Detailed guides

- `docs/LOCAL_FIRST_V1_RELEASE.md` — current v1 scope, boundaries, optional integrations, known warnings, and sign-off rules.
- `docs/MERGE_READINESS.md` — final local-first release verification sequence.
- `docs/ARCHITECTURE.md` — architecture and trust boundaries.
- `docs/OBSERVAIRE_DATA_CONTRACT.md` — canonical research content contract.
- `docs/PROJECT_FOLDERS_AND_DOCKER.md` — project folders, imports, and persistence.
- `docs/RESEARCH_ORCHESTRATION.md` — explicit multi-project orchestration semantics.
- `docs/RESEARCH_ASSISTANT_CONTEXT.md` — canonical Research Assist context boundary.
- `docs/NEW_RESEARCH_SCAFFOLD.md` — reviewable New Research scaffold.
- `docs/REVIEWED_EVIDENCE_PROMOTION.md` — reviewed Consensus Evidence workflow.
- `docs/PDF_REGION_EVIDENCE_V2.md` — reviewed PDF spatial provenance.
- `docs/LARGE_WORKSPACE_PERFORMANCE.md` — large-workspace performance contract.
- `docs/INTEGRATIONS_AND_DIRECT_EDIT.md` — integration state and Direct Edit safety.

## License

MIT.
