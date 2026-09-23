# Observaire Architecture

## Purpose

Observaire is a research operating layer over plain files. Markdown and project-folder metadata are authoritative; generated indexes and UI views are derived.

## Invariants

1. **Plain files are the source of truth.** Durable research lives under the configured research root (`progressDir`, `progress/` by default); never require a separate database or a Git commit to understand the current research record.
2. **Top-level numbered-note folders are projects.** A top-level folder containing ordered Markdown notes is auto-indexed as one research project. Optional `.observaire-project.json` stabilizes folder-local project metadata.
3. **Filename order is presentation, not identity.** Numeric prefixes order notes inside one project; stable frontmatter `id` values identify research objects.
4. **Stable IDs are durable.** Renaming/reordering a note should preserve its `id`; use `aliases` for old identifiers.
5. **The compiler is canonical.** Projects, search, backlinks, relationships, validation, manifests, Insights, and graph data consume one compiled research workspace rather than each feature rescanning Markdown independently.
6. **Generated files are disposable.** `public/_research/` can always be rebuilt from source notes/assets.
7. **Unknown facts are omitted, not invented.** This applies especially to AI-authored dates, citations, results, measurements, and metadata.
8. **Content validation is local-first.** No GitHub Actions are required. `npm run doctor` and `npm run check` are the portable quality gate.
9. **Browser project import is transactional.** It must not silently overwrite an existing project or leave a partial project after compiler failure.
10. **Docker research storage is host-backed.** The supplied Compose workflow bind-mounts the durable research directory; container-only state must not become the research source of truth.
11. **Git review is not the research database.** Direct Edit and Codex Act/Apply use Git worktree/patch mechanics for review, but their baseline is the current research filesystem. Imported, untracked, or already-uncommitted research does not need to be committed before it can be reviewed.

## Content flow

```text
<configured research root>/        # progress/ by default
  Project A/
    .observaire-project.json        (optional/stable project metadata)
    00_*.md
    01_*.md
    papers/
    figures/
  Project B/
    00_*.md
    01_*.md
  00_legacy_root_note.md            (compatible)
       │
       ▼
lib/research/compiler.mjs
       │
       ├── project-folder discovery
       ├── metadata normalization
       ├── stable routes / aliases
       ├── relative document links
       ├── semantic relationships / backlinks
       ├── asset inventory
       ├── workspace diagnostics
       └── search / graph / health data
       │
       ├──────────────► public/_research/manifest.json
       ├──────────────► public/_research/search.json
       ├──────────────► public/_research/graph.json
       └──────────────► public/_research/health.json
                              │
                              ▼
                            UI
```

## Project discovery boundary

`lib/research/project-folders.mjs` owns folder-to-project identity rules.

A folder becomes a project only when it contains at least one ordered Markdown note whose basename matches the numeric-prefix convention. This prevents ordinary asset folders such as `figures/` and `papers/` from becoming fake projects.

Project identity resolution:

1. valid folder-local `.observaire-project.json` with `schemaVersion: 1` when present;
2. otherwise deterministic normalized identity derived from folder name;
3. root-level notes continue to use configured/default `research` semantics for compatibility.

Folder membership takes precedence over conflicting `research` frontmatter on a nested note and produces a diagnostic rather than silently assigning the object to another project.

Order diagnostics are scoped per resolved project, so multiple projects can independently use `00`, `01`, and so on.

### Document links versus semantic relationships

Observaire deliberately keeps two resolution models separate:

- Explicit Markdown `.md` links are document paths. A project-local link such as `01_method.md` resolves the real path relative to the source note before any global route/alias fallback. This prevents a root-level legacy alias with the same basename from hijacking a local project link.
- Frontmatter `relationships.target` values are semantic identities. Stable IDs/aliases are resolved before filename compatibility fallbacks.

This distinction preserves both portable folders and durable semantic graph identities.

## Browser import boundary

`lib/research/project-import.mjs` and `/api/research/projects/import` implement the project-folder write boundary.

The importer:

- is same-origin only;
- follows the existing research-write production opt-in;
- accepts one selected folder at a time;
- normalizes/rejects unsafe paths;
- enforces file-count/size/type limits;
- stages files under an ignored `.observaire-import-*` temporary directory;
- creates folder-local project metadata when missing;
- rejects an identity already owned by a populated project;
- promotes the directory atomically;
- recompiles the canonical workspace;
- rolls the imported directory back if it introduces compiler errors;
- refuses silent overwrite of an existing project folder.

The compiler ignores `.observaire-import-*` staging directories so half-written uploads cannot enter search/graph/Insights.

## Runtime boundaries

### Local/dev live workspace

Local development treats the configured source filesystem as live input.

- `scripts/dev-research.mjs` performs the initial compilation and watches `workspace.progressRoot` plus workspace config.
- Optional `OBSERVAIRE_WATCH_POLL_MS` adds signature polling for bind-mounted filesystems where recursive change events are unreliable.
- Project and note Server Components may request a fresh compiled workspace so newly imported/copied research becomes navigable without a container restart.
- Generated search/media/graph/health artifacts are refreshed from the same compiler.

### Build/static assets

`npm run build` compiles the committed/candidate workspace before the application build. Search and approved research media are generated into `public/_research/`.

The generated artifacts are deployment output, not a second writable content database.

### Research media path

Approved local research assets are copied by the compiler into `public/_research/media/` while preserving paths relative to the configured research root.

The compiler remains responsible for:

- rejecting symlinks in the research source tree;
- preventing source path escapes;
- enforcing the configured extension allowlist;
- validating referenced assets;
- copying only approved local assets into generated public output.

## Evidence write boundary

`lib/research/evidence-write.mjs` persists reviewed evidence as ordinary research objects.

- Root/configured legacy projects retain root-level evidence behavior.
- Folder-backed projects receive new PDF/Consensus evidence inside the project folder at the next project-local order number.
- Folder-backed evidence does not need redundant `research:` frontmatter because folder membership supplies project scope.
- Local PDF provenance is written relative to the evidence note when practical, while the compiler resolves it to the canonical research-root-relative asset path.
- Ambiguous filename-only relationship targets are rejected; semantic relationships should use stable IDs.

Evidence persistence never infers strong semantic relationships from search/ranking signals.

## Git-backed review boundary

Git is used as a **review mechanism**, not as the authoritative current research state.

### Codex Act / Apply

Act uses a filesystem-first review baseline:

1. compile the current workspace and resolve the repository-relative configured research root;
2. create an isolated detached worktree;
3. copy the current live research filesystem into that worktree, excluding transient `.observaire-import-*` and nested `.git` directories;
4. copy the current workspace config;
5. stage that snapshot only inside the isolated worktree and freeze it with `git write-tree`;
6. run Codex with network disabled and workspace-write sandboxing;
7. restore the frozen baseline index with `git read-tree`, even if Codex happened to stage files;
8. compute the proposal diff from the frozen live-filesystem snapshot, not from repository `HEAD`;
9. record the baseline Git blob hash for each touched file (`null` for paths absent at review time);
10. run the research doctor before the proposal becomes apply-eligible.

Apply independently rechecks the touched-file baseline. Pre-existing dirty/untracked content is allowed if unchanged since review; edits, creations, symlink replacements, or other touched-path drift after review are rejected. The patch must still pass `git apply --check`, and post-apply Doctor failure triggers reverse-patch rollback with rollback failures surfaced explicitly.

### Direct Edit

Direct Edit also uses an isolated worktree and the current filesystem as its review baseline. Browser-local drafts do not modify source files until Save, and Save protects against stale source SHA changes plus post-apply Doctor failures.

Neither workflow stages or commits the live repository index.

## Docker boundaries

The supplied `compose.yaml` is a local-workspace deployment, not an immutable production-content model.

- `${OBSERVAIRE_RESEARCH_DIR:-./progress}` is bind-mounted at `/app/progress`.
- The normal way to relocate durable host storage is to change `OBSERVAIRE_RESEARCH_DIR` while keeping runtime `progressDir: "progress"`.
- If `progressDir` is intentionally changed (for example to `research-data`), the Compose bind-mount target must be changed to the matching container path as well.
- host `.git` metadata is mounted to supply detached-worktree/patch mechanics; research files themselves do not need to be committed before review.
- `.research-observer` is a named volume for local integration/Codex transient state.
- `CODEX_HOME=/app/.research-observer/codex`, so normal container recreation can preserve Codex authorization.
- the research watcher uses polling in addition to filesystem events.
- browser-imported research therefore writes through to the host research directory.

An arbitrary external host research directory remains reviewable when it is bind-mounted at the configured in-container research path: Git supplies review mechanics, while the mounted filesystem supplies the research baseline.

Container recreation must never be required to preserve research source content.

## Local quality gate

```text
npm run doctor
    ↓
npm test
    ↓
npm run typecheck
    ↓
npm run lint
    ↓
npm run build
```

`npm run check` runs everything except the production build. `npm run check:full` adds the build.

Do not add CI-only assumptions to validation logic. A developer, AI agent, local workstation, or hosting build environment should be able to run the same commands.

## Diagnostics philosophy

Errors represent broken integrity and should fail `doctor`:

- broken internal research links;
- missing referenced local assets;
- invalid stable IDs;
- invalid date/type/status values;
- duplicate canonical identities;
- alias collisions;
- invalid/colliding project-folder manifests;
- unsupported/unsafe URL schemes;
- configured research-root path escapes;
- symlinks within the research tree;
- folder/root project-scope collisions.

Warnings represent maintainability or semantic conflicts:

- missing stable IDs;
- duplicate ordering numbers inside one project;
- folder/frontmatter project mismatch;
- orphan assets;
- HTTP rather than HTTPS remote resources;
- very large assets;
- ignored Markdown that does not follow the filename convention.

## Extending metadata

Prefer optional metadata. Researchers should always be able to create a useful note with plain Markdown.

When adding a new formal metadata field:

1. define its semantics in `AGENTS.md` and `docs/OBSERVAIRE_DATA_CONTRACT.md`;
2. add validation/default behavior in the compiler;
3. add it to generated manifest/search data only if consumers need it;
4. add compiler tests for valid and invalid forms;
5. preserve backwards compatibility where practical.

For project-level metadata, prefer the folder-local project manifest rather than repeating project labels/descriptions on every note.

## Parser note

The compiler centralizes Markdown-derived metadata today. Link and heading extraction should continue moving toward one Markdown AST pipeline if/when parser dependencies can be added and locked reproducibly. Do not introduce a second independent parser in a UI feature.

## Dependency policy

- Direct dependency versions are pinned.
- `package-lock.json` is required for deterministic clean/Docker installs.
- Use `npm ci` for clean/release installs.
- Dependency upgrades should be deliberate and validated with `npm run check:full`.

## AI authoring

`AGENTS.md` is authoritative for AI-generated notes. AI agents should inspect the target project folder before creating a new filename, preserve stable IDs when editing, use relative Markdown links/assets, respect folder-derived project identity, and run the local integrity checks before considering work complete.
