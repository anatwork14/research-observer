# Research Observer Architecture

## Purpose

Research Observer is a research operating layer over plain files. Markdown is authoritative; generated indexes and UI views are derived.

## Invariants

1. **Markdown is the source of truth.** Never require a separate database to understand the research record.
2. **Filename order is presentation, not identity.** Numeric prefixes order notes; stable frontmatter `id` values identify notes.
3. **Stable IDs are immutable.** Renaming/reordering a note must preserve its `id`; use `aliases` for old identifiers.
4. **The compiler is canonical.** Search, backlinks, validation, and manifests consume one compiled research workspace rather than each feature rescanning Markdown independently.
5. **Generated files are disposable.** `public/_research/` can always be rebuilt from source notes.
6. **Unknown facts are omitted, not invented.** This applies especially to AI-authored dates, citations, results, measurements, and metadata.
7. **Content validation is local-first.** No GitHub Actions are required. `npm run doctor` and `npm run check` are the portable quality gate.

## Content flow

```text
progress/
  XX_*.md
  figures/
  media/
       │
       ▼
lib/research/compiler.mjs
       │
       ├── metadata normalization
       ├── stable routes / aliases
       ├── note relationships / backlinks
       ├── asset inventory
       ├── workspace diagnostics
       └── search text
       │
       ├──────────────► public/_research/manifest.json
       └──────────────► public/_research/search.json
                              │
                              ▼
                            UI
```

## Runtime boundaries

### Build/static path

- Home and research-note pages are forced static.
- `generateStaticParams` enumerates canonical IDs plus aliases.
- Search reads the generated static index in the browser.
- Markdown content is read by the compiler/Server Components, not by a per-query search endpoint.

### Research media path

Approved local research assets are copied by the compiler into `public/_research/media/` while preserving their relative paths.

This deliberately avoids request-time filesystem access. The deployment/static hosting layer is responsible for efficient delivery, caching, and byte-range support.

The compiler remains responsible for:

- rejecting symlinks in the research source tree
- preventing source path escapes
- enforcing the configured extension allowlist
- validating referenced assets
- copying only approved local assets into generated public output

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

- broken internal research links
- missing referenced local assets
- invalid stable IDs
- invalid date/type/status values
- duplicate canonical identities
- alias collisions
- unsupported/unsafe URL schemes
- progress-directory path escapes
- symlinks within the research tree

Warnings represent maintainability issues:

- missing stable IDs
- duplicate ordering numbers
- orphan assets
- HTTP rather than HTTPS remote resources
- very large assets
- ignored Markdown that does not follow the filename convention

## Extending metadata

Prefer optional metadata. Researchers should always be able to create a useful note with plain Markdown.

When adding a new formal metadata field:

1. define its semantics in `AGENTS.md`
2. add validation/default behavior in the compiler
3. add it to generated manifest/search data only if consumers need it
4. add compiler tests for valid and invalid forms
5. preserve backwards compatibility where practical

## Parser note

The compiler centralizes Markdown-derived metadata today. Link and heading extraction should continue moving toward one Markdown AST pipeline if/when parser dependencies can be added and locked reproducibly. Do not introduce a second independent parser in a UI feature.

## Dependency policy

- Direct dependency versions are pinned.
- Commit `package-lock.json` as soon as registry access is available.
- After that, use `npm ci` for clean/release installs.
- Dependency upgrades should be deliberate and validated with `npm run check:full`.

## AI authoring

`AGENTS.md` is authoritative for AI-generated notes. AI agents should inspect existing ordered notes before creating a new filename, preserve stable IDs when editing, use relative Markdown links/assets, and run the local integrity checks before considering work complete.
