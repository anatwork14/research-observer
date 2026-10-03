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

### Citation-token navigation

The editor can resolve `\\cite{key}` tokens from an unsaved source snapshot against all visible project `.bib` files. Resolution maps verified DOI, URL, local PDF, or title/year identity back to canonical compiler `literature` and `evidence` records; it does not create another bibliography store.

Resolved sources link to their research note or local PDF. When a key maps to multiple canonical records, the UI presents the available choices. Missing or incomplete matches remain visible with no guessed destination. This lookup is read-only.

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

The desktop editor uses CodeMirror 6 with the LaTeX `stex` mode and a lightweight BibTeX mode. A shared editor adapter keeps citation insertion, editor helpers, Codex snapshots, cursor-based SyncTeX, and optional language intelligence independent of the editor widget. A plain textarea remains available as a fallback and is selected automatically at narrow viewport widths.

The editor assistance provides:

- command palette;
- line-comment toggle;
- formatting wrappers;
- common LaTeX environment snippets;
- section/label outline;
- navigation;
- lightweight structural problems;
- optional on-demand TexLab diagnostics, document symbols, and cursor completions.

Local structural diagnostics and TexLab results are advisory only. Compiler output remains authoritative.

CodeMirror is a UI dependency only; manuscript source remains plain files with the existing path and stale-write protections. The textarea fallback remains available for smaller viewports and safe plain-text editing.

### Optional TexLab language intelligence

TexLab integration is intentionally optional. The IDE probes the configured `texlab` binary and degrades to the existing editor tools when the executable is absent or explicitly disabled.

Configuration:

```text
RESEARCH_OBSERVER_TEXLAB=0        disable TexLab probing entirely
OBSERVAIRE_TEXLAB_BIN=/path/...   use a non-PATH TexLab executable
```

Language analysis is user-triggered from the **Language** tab rather than spawned on every keystroke. The server receives the current unsaved `.tex` buffer through LSP `textDocument/didOpen`, so diagnostics/symbols/completions describe what the user is actually editing without requiring a save first.

The TexLab bridge:

- validates the selected research project and `.tex` path against the existing manuscript workspace;
- runs a bounded one-shot stdio LSP session under that project root;
- caps source size, protocol frame size, result counts, stderr capture, and execution time;
- handles common server→client configuration/progress requests without granting write capability;
- refuses `workspace/applyEdit` because language analysis is read-only;
- uses same-origin POST protection for buffer analysis;
- normalizes LSP positions into editor line/column navigation;
- exposes snippet completions as preview-only;
- applies plain completion edits only when the active file and complete buffer still match the analyzed snapshot;
- forces a new analysis after one completion edit so stale completion ranges cannot be reused.

TexLab does not save manuscript files, change project state, or decide whether a build succeeds. `latexmk` plus the selected TeX engine remain authoritative for compilation diagnostics and build status.

## Codex manuscript context

The manuscript assistant has three distinct modes:

- **Ask** is read-only reasoning about the manuscript.
- **Draft** returns proposed text without inserting it.
- **Act** prepares an isolated source patch for exact human review and explicit apply.

Ask and Draft may include as untrusted context:

- project ID;
- active TeX file;
- unsaved selection/source snapshot;
- compiler diagnostics.

Act uses separate `/api/codex/manuscript-act` and `/api/codex/manuscript-apply` routes. It refuses an unsaved active editor, snapshots visible `.tex`, `.bib`, `.sty`, `.cls`, and `.bst` sources into a detached worktree, and stores a bounded exact patch with source hashes for review. Hidden sources, resources, IDE state, sibling projects, app/config files, renames, and physical deletions cannot be applied. Apply checks proposal identity, patch hash, path scope, hidden-source status, destructive state, and current source hashes before `git apply --check` and mutation. It validates the resulting source and rolls back on validation failure. Discard removes transient proposal state only.

The existing research Codex Act remains a separate workflow restricted to reviewed changes under `progress/`. Manuscript Act remains local-development only until an authenticated production agent service is configured.

## Docker persistence

Compose must preserve all durable authored domains:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains transient/rebuildable state.

## Integrated editor and research navigation

The shared editor adapter supports CodeMirror 6 and the plain-textarea fallback for citation insertion, editor helpers, manuscript Codex snapshots, cursor-based SyncTeX, and stale-safe application of plain TexLab completions.

Citation tokens resolve from visible project `.bib` source to canonical literature/evidence using verified DOI, URL, local-PDF, or title/year identity. Ambiguous and missing matches remain explicit rather than guessing a destination.

### Possible future tooling

TexLab hover/references and longer-lived per-project LSP sessions remain optional future work. The current diagnostics/symbols/completions flow stays on-demand and read-only except for explicit stale-safe insertion of a selected plain completion. Lightweight editor diagnostics and TexLab hints remain advisory; latexmk and the selected TeX engine remain authoritative for compilation.

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
- optional TexLab unavailable fallback;
- TexLab diagnostics/symbol/completion analysis when a real binary is available;
- stale-buffer completion rejection;
- build retention;
- mobile/tablet layouts;
- Docker durable-state recreation.

The governing principle is that PDF pixels, editor widgets, match suggestions, language-server hints, and compiled artifacts are **views over durable, provenance-aware project objects**, not the durable objects themselves.
