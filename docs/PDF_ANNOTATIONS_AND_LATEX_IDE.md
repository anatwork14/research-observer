# PDF annotations + LaTeX research IDE architecture

Research Observer treats papers, annotations, research evidence, bibliography records, manuscript source, compiled PDFs, and AI/editor assistance as parts of one project-scoped research workspace.

The design deliberately keeps durable research objects separate from transient views/build artifacts while linking them through explicit provenance.

## Durable storage boundaries

Three authored data domains remain separate:

```text
progress/                 Markdown research knowledge + evidence
annotations/<project>/    structured PDF annotation sidecars
manuscripts/<project>/    LaTeX/BibTeX source + manuscript resources
```

Transient/rebuildable state:

```text
.research-observer/latex-builds/
public/_research/latex/
public/_research/media/
```

`progress/` remains canonical research knowledge. Annotation sidecars and manuscript files do not become fake research Markdown merely to make indexing convenient.

## PDF annotation model

Annotations are structured records with stable IDs.

Core metadata includes:

- semantic type;
- page;
- anchor kind (`text` or `region`);
- normalized rectangles;
- quote context where applicable;
- comment;
- tags/color;
- created/updated timestamps;
- soft-delete `deletedAt`;
- current anchor metadata/history;
- optional reviewed region source-text provenance.

### Semantic types

Text/research types:

```text
highlight
comment
evidence
claim
question
limitation
method
definition
important
```

Visual types:

```text
area
figure
table
```

The semantic type is reading/authoring metadata. It is not automatic scientific graph truth.

## Annotation anchors

### Text anchors

Text annotations combine multiple location signals:

- page;
- normalized PDF-page rectangles;
- exact quote;
- prefix/suffix context;
- optional normalized page-text SHA-256;
- optional page-text character index;
- source PDF SHA-256.

This preserves both rendering geometry and text-oriented recovery information.

### Visual-region anchors

Visual areas store normalized rectangles without requiring selectable text.

This supports:

- figures;
- tables;
- equations;
- charts/diagrams;
- scanned/image PDFs;
- arbitrary visual regions.

A visual region may have an empty quote. A user comment is never treated as source quotation.

## Document revisions and schema v2

New annotation anchors bind to the actual source PDF SHA-256.

Every listed annotation is classified as:

```text
current  anchor fingerprint matches current PDF
stale    PDF bytes changed since anchor creation/re-anchor
legacy   older record has no document fingerprint
```

Schema v2 remains backward-readable from v1 sidecars. Reading an old sidecar does not silently rewrite it.

This makes PDF replacement/version changes visible instead of allowing old coordinates to masquerade as verified locations.

## Explicit re-anchoring

Re-anchor is always an explicit operation.

Text flow:

```text
Re-anchor text
→ select verified replacement text
→ confirm Re-anchor here
```

Region flow:

```text
Re-anchor area
→ drag verified replacement region
→ apply explicit re-anchor
```

Before replacing the active anchor, the old page/quote/geometry/fingerprint is appended to bounded `anchorHistory`.

Automatic/fuzzy matching must never write an anchor directly.

## Proposal-only re-anchor assistance

Stale/legacy text anchors can request read-only candidate search.

The matcher ranks candidates using:

1. exact quote match;
2. prefix/suffix context;
3. previous page hint;
4. previous page-text index hint;
5. conservative token/bigram fuzzy matching if wording changed.

The PDF Suggestions UI extracts current text with the existing local PDF.js runtime and displays:

- candidate page;
- exact/fuzzy classification;
- confidence;
- surrounding snippet.

Opening a candidate page still does **not** apply it. The user must inspect the source and complete the normal explicit re-anchor flow.

This is a central safety rule: **matching suggests; humans re-anchor.**

## Visual source-text provenance

Visual evidence needs source text that is distinct from interpretation.

A region may hold reviewed `sourceText` with kind:

```text
caption
ocr
transcription
```

It stores:

- exact reviewed text;
- SHA-256 of that text;
- verification timestamp;
- anchor page;
- anchor PDF SHA-256;
- review state.

`sourceTextHistory` retains superseded/invalidated reviewed text.

### Re-anchor invalidation

When region geometry changes, previously reviewed visual source text becomes `reviewRequired`.

The user must explicitly review/save it again against the new region before it can support new research evidence.

Raw OCR output is therefore not equivalent to reviewed source evidence.

## Soft deletion and concurrency

Normal annotation deletion sets `deletedAt`.
Restore clears it.
The underlying annotation remains recoverable.

Sidecar mutations use:

- optimistic revision checks;
- atomic temporary-write + rename;
- short-lived filesystem lock.

A stale browser cannot silently overwrite newer annotation state.

## Annotation → durable evidence

Promotion is explicit and reuses the canonical Markdown evidence writer.

### Text evidence requirements

- annotation visible;
- anchor status `current`;
- verified selected quote.

### Visual evidence requirements

- annotation visible;
- region anchor status `current`;
- reviewed caption/OCR/transcription;
- source text not marked `reviewRequired`.

Promotion records annotation provenance, document fingerprint, and region source-text provenance where relevant.

Promotion remains idempotent through the stable annotation marker.

A promoted evidence note is a historical snapshot. Later annotation edits/re-anchors/hiding do not silently rewrite that note.

Promotion does not infer `supports`, `contradicts`, `answers`, or other semantic graph relationships.

## LaTeX manuscript workspace

Each research project owns a durable manuscript root under configured `manuscriptsDir`.

Editable source types:

```text
.tex
.bib
.sty
.cls
.bst
```

`.observaire-ide.json` stores selected main file, engine, hidden source paths, and workspace timestamp.

Browser saves include a source SHA-256. External changes cause stale-save rejection rather than silent overwrite.

Hide/Restore is metadata-based; manuscript bytes are preserved.

## Compilation model

Local compilation uses `latexmk` with:

- pdfLaTeX / XeLaTeX / LuaLaTeX selection;
- SyncTeX enabled;
- unrestricted shell escape disabled;
- bounded process time/log capture;
- generated build directory separated from source;
- parsed file/line diagnostics.

Successful PDF/SyncTeX browser artifacts are rebuildable copies, not source of truth.

### Build retention

Old generated build IDs are pruned from both private build cache and public preview directories.

Default retention is 12 per project; configuration is clamped to 2–100.

Cleanup never targets durable manuscript source.

## Source ↔ compiled PDF navigation

SyncTeX is the canonical mapping layer.

```text
editor cursor → synctex view → PDF position
PDF double click → synctex edit → manuscript file/line
```

Reverse-resolved paths are validated inside the selected manuscript root.

## Research citation bridge

Citation discovery reuses canonical project `literature` and `evidence` records.

The application does not maintain a second bibliography database.

A source is citation-ready only when verified metadata is sufficient. Missing authors/year/source identity is shown rather than fabricated.

Evidence may inherit verified bibliography metadata from the strongest literature record resolving to the same local PDF.

### BibTeX identity and deduplication

Identity preference:

```text
DOI
→ source URL
→ local PDF
→ title + year
```

Existing matching records reuse their current key.
New records receive deterministic author/year/title keys.

Generated records currently use conservative `@misc` until richer canonical publication metadata exists.

`.bib` writes use normal manuscript path guards and stale-write protection.

## Bibliography source configuration

The IDE can explicitly connect the selected `.bib` to the active TeX source.

Classic BibTeX:

- preserve existing bibliography style;
- add selected library if missing;
- conservatively add `plain` only when necessary;
- do not silently switch an existing different bibliography library.

`biblatex`:

- use `\addbibresource`;
- use `\printbibliography`;
- do not mix classic BibTeX commands into a detected biblatex document.

## Editor assistance

The dependency-independent editor fallback currently provides:

- command palette;
- line-comment toggle;
- formatting wrappers;
- common LaTeX environment snippets;
- section/label outline;
- navigation;
- lightweight structural problems.

These diagnostics are advisory only. Compiler output remains authoritative.

### Rich editor dependency boundary

CodeMirror is a planned adapter, not a storage/build dependency.

Because the repository commits `package-lock.json`, editor packages must be added only in a lockfile-safe change with the quality gate run. The current textarea/editor-assistance surface remains the mobile/safe fallback.

## Codex manuscript context

The manuscript assistant intentionally supports Ask/Draft only.

It may include as untrusted context:

- project ID;
- active TeX file;
- unsaved selection/source snapshot;
- compiler diagnostics.

Ask/Draft are read-only. Draft output is proposal text and is not automatically inserted.

Existing Codex Act remains scoped to reviewed research-file changes under `progress/`.

A future manuscript Act must have its own stale-safe snapshot/diff/apply workflow rather than weakening the research-only path guard.

## Docker persistence

Compose must preserve all durable authored domains:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains transient/rebuildable state.

## Next architectural integrations

### Citation token → source navigation

Resolve a `\cite{key}` from visible project `.bib` source back to canonical literature/evidence using verified DOI/URL/PDF identity.

### Manuscript Act/review

A manuscript-writing agent path should use:

- project-scoped manuscript snapshot;
- source hashes;
- proposed patch/diff;
- stale-source detection;
- explicit apply;
- path guards independent from research Act.

### Optional CodeMirror / TexLab

When package installation/lockfile verification is available:

- add CodeMirror adapter;
- keep touch-safe fallback;
- optionally add TexLab/LSP completion/symbols/hover/references;
- keep compiler diagnostics authoritative.

## Verification contract

Before merge/release, a real checkout/container must run:

```bash
npm run check
npm run check:full
```

Browser/toolchain verification must include:

- text annotations across reload/zoom;
- mouse + touch visual-region drag;
- PDF replacement → stale detection;
- text/region re-anchor + history;
- visual source-text review/re-review;
- candidate matching on real papers;
- evidence promotion;
- citation/BibTeX insertion and deduplication;
- classic BibTeX + biblatex output;
- real TeX engine builds;
- forward/reverse SyncTeX;
- build retention;
- mobile/tablet layouts;
- Docker durable-state recreation.

The governing principle is that PDF pixels, editor widgets, match suggestions, and compiled artifacts are **views over durable, provenance-aware project objects**, not the durable objects themselves.
