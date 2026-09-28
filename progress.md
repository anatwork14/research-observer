# Research Observer implementation progress

Last updated: 2026-09-28

## Active checkpoint

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this progress commit: 75 commits ahead of main, 0 behind
```

Observaire now has a connected foundation spanning PDF reading/annotation, explicit annotation→evidence promotion, project-scoped LaTeX authoring/compilation, source↔PDF SyncTeX, bounded generated-build retention, research-aware BibTeX citation management, and explicit bibliography setup.

The implementation preserves the existing Markdown research compiler, evidence writer, PDF.js reader, Direct Edit/Codex review boundaries, and filesystem-first project model instead of introducing a parallel research database.

## Implemented — PDF annotator

- Durable project-scoped annotation sidecars under configured `annotationDir`.
- Annotation targets must be existing indexed local PDFs.
- Structured types: highlight, comment, evidence, claim, question, limitation, method, definition, important.
- Exact quote + prefix/suffix text context + normalized page rectangles.
- Zoom/responsive-safe overlays.
- Optimistic revision checks and atomic sidecar writes behind a short-lived lock.
- Same-origin/write-gated API.
- Text selection toolbar and structured annotation drawer.
- In-place metadata editing for type, comment, tags, and color without moving the source anchor.
- Hide/Restore soft deletion via `deletedAt`; normal browser actions do not physically delete annotation records.
- Responsive tablet/mobile composer and drawer behavior.

## Implemented — annotation → durable evidence

- Explicit **Promote to evidence** action.
- Reuses the existing Markdown evidence writer.
- Preserves PDF path, page, excerpt, annotation comment/type/tags, and annotation ID provenance.
- Promoted evidence is discoverable from annotation listing after reload.
- Repeated promotion is idempotent and resolves to the same evidence note.
- Reading labels never automatically create `supports`, `contradicts`, `answers`, or other scientific relationships.
- Hiding/editing a source annotation does not silently rewrite or delete already-promoted evidence.

## Implemented — LaTeX IDE foundation

- `/ide?research=<project-id>` uses normal Observaire project context.
- Durable project source under configured `manuscriptsDir`.
- Editable `.tex`, `.bib`, `.sty`, `.cls`, `.bst` source.
- Main file, engine, hidden files, and update timestamp in `.observaire-ide.json`.
- Source creation plus SHA-256 stale-write protection.
- Hide/Restore file behavior without deleting bytes.
- pdfLaTeX, XeLaTeX, LuaLaTeX selection.
- Local `latexmk` orchestration with bounded process/log handling, file-line errors, SyncTeX, halt-on-error, and unrestricted shell escape disabled.
- Parsed build diagnostics with source-line navigation.
- PDF preview through the existing local React-PDF/PDF.js runtime.
- Forward SyncTeX: editor cursor → PDF position.
- Reverse SyncTeX: PDF double-click → source file/line with project-boundary checks.
- Responsive desktop/tablet/mobile file/editor/preview panels.
- Current editor stays dependency-free/touch-compatible until CodeMirror is intentionally introduced.

## Implemented — build retention

- `lib/research/latex-retention.mjs` + declarations/tests.
- Old generated build IDs are pruned from both `.research-observer/latex-builds/<project>/` and `public/_research/latex/<project>/`.
- Default retention: 12 builds per project.
- `OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100.
- Cleanup errors are warnings; they do not invalidate an otherwise successful compile.
- Durable manuscript source is never eligible for pruning.

## Implemented — research citation bridge

### Discovery and provenance

- `lib/research/latex-citations.mjs` + declarations.
- `/api/ide/citations` with same-origin/write protections.
- Project-scoped search over canonical compiler `literature` and `evidence` objects.
- Search includes title, summary, authors, year, DOI, URL, and tags.
- Results link back to research notes, local papers, and verified external sources.
- No parallel citation registry/database.
- Missing author/year/source identity is never fabricated; incomplete sources remain visible but non-insertable.
- Local/promoted evidence can inherit bibliography metadata from the most complete literature note that resolves to the same indexed PDF.
- Reviewed Consensus evidence uses metadata already persisted into the research object.

### BibTeX creation and deduplication

- Can create `references.bib` or use an existing visible project `.bib` file.
- `.bib` writes reuse manuscript path guards and stale-write protection.
- One stale concurrent write is retried rather than overwritten.
- Deduplication identity priority:
  1. DOI
  2. source URL
  3. local PDF path
  4. title + year
- Existing matching records reuse their existing citation key.
- New keys are deterministic author/year/title keys with collision suffixes.
- Generated entries intentionally use conservative `@misc` rather than guessing article/conference/book types that are not present in verified metadata.

### IDE citation UX

- Floating **Citations** launcher plus responsive drawer.
- Search project literature/evidence without leaving the manuscript IDE.
- Choose/create bibliography library.
- Show inherited metadata and missing fields explicitly.
- Open source note/PDF/external source.
- **Insert citation** creates/reuses the BibTeX record and inserts `\cite{key}` at the active `.tex` cursor.
- Insertion is validated before server-side `.bib` mutation, avoiding orphan bibliography writes when no valid TeX editor is open.
- Textarea insertion uses the native input event so current React dirty/save behavior is retained.
- The insertion adapter is isolated so CodeMirror can replace it later without changing citation services/APIs.

## Implemented — explicit bibliography setup

- Added browser-safe `lib/research/latex-bibliography.mjs` + declarations/tests.
- Citation drawer now exposes **Configure bibliography in current TeX file**.
- Unsafe/escaping `.bib` paths are rejected.
- The active source must contain a normal `\begin{document}` / `\end{document}` pair.
- Classic BibTeX behavior:
  - preserves an existing `\bibliographystyle{...}`;
  - connects the selected `.bib` through `\bibliography{...}` when none exists;
  - adds `plain` only when an explicit basic style is needed;
  - repairs an existing selected `\bibliography{...}` that has no style by adding `plain`;
  - refuses to silently switch an existing classic bibliography command to a different library.
- `biblatex` behavior:
  - detects package/resource usage;
  - adds the selected `\addbibresource{...}` only when missing;
  - adds `\printbibliography` only when missing;
  - never mixes classic BibTeX commands into detected `biblatex` setup.
- Cursor/selection offsets are mapped through inserted source text so configuration does not unnecessarily disrupt editing position.

## Implemented — persistence and agent contracts

- Configured `annotationDir` and `manuscriptsDir` roots.
- `annotations/AGENTS.md` documents sidecar schema, locking, soft delete, promotion, provenance, idempotency.
- `manuscripts/AGENTS.md` documents manuscript state, compile boundaries, SyncTeX, citation integrity, BibTeX deduplication, bibliography setup, and metadata non-fabrication.
- `app/AGENTS.md` documents annotation/IDE/citation/mobile/server-client boundaries.
- Manuscript `.gitignore` excludes TeX intermediate files.
- `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` documents the unified architecture.

## Implemented — Docker/toolchain persistence

Docker includes `latexmk`, Biber, Ghostscript, TeX Live base/recommended/extra/science/pictures/fonts, XeTeX, and LuaTeX.

Durable Compose mounts:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains transient/rebuildable state on the named volume.

`observaire:start` / `observaire:start:build` run a preflight that creates host bind directories before Compose starts.

## Tests added in code

### `tests/pdf-annotations.test.mjs`

- structured creation/listing;
- stale revision rejection;
- non-destructive metadata edits;
- Hide/Restore;
- evidence promotion;
- annotation-ID provenance;
- promoted-evidence discovery;
- idempotent promotion.

### `tests/latex-ide.test.mjs`

- source creation;
- main file/engine state;
- stale-safe save/rejection;
- Hide/Restore without deleting bytes;
- manuscript separation from Markdown compiler.

### `tests/latex-retention.test.mjs`

- retention defaults/config/clamping;
- synchronized generated-build/preview pruning;
- newest-build retention.

### `tests/latex-citations.test.mjs`

- project citation discovery;
- evidence → verified literature metadata resolution;
- `.bib` creation;
- deterministic key generation;
- DOI deduplication across evidence/literature views;
- local PDF provenance;
- refusal of incomplete metadata.

### `tests/latex-bibliography.test.mjs`

- basic BibTeX setup;
- preservation of an existing custom style;
- missing-style repair for an existing selected bibliography;
- duplicate-setup avoidance;
- `biblatex` resource/print setup;
- cursor mapping through insertions;
- unsafe path and non-document rejection.

These tests exist in the branch but have **not been executed in this GitHub-only session**.

## Verification status

### Confirmed by repository inspection

- Branch remained directly based on current `main`: 75 commits ahead / 0 behind before this progress commit.
- Annotation/manuscript stores remain path-scoped and separate from Markdown research.
- Browser Hide flows remain non-destructive.
- Annotation promotion reuses canonical evidence writing.
- Citation discovery reuses canonical research compiler metadata.
- Citation/BibTeX writes reuse manuscript path/stale-write guards.
- Bibliography source transform is browser-safe and does not import Node/process/filesystem APIs.
- Compile/citation mutation APIs remain server-side/same-origin gated.
- Build retention removes generated output only.
- Docker persistence covers all durable roots.

### Still requiring real runtime/browser verification

Do not claim these passed until executed in a checkout/container:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run check
npm run check:full
```

Browser/toolchain matrix:

- PDF annotation create/edit/Hide/Restore across reload/page/zoom;
- annotation promotion/Open evidence/retry behavior in a real server;
- iPad/tablet annotation interactions;
- manuscript create/edit/hide/restore;
- citation search and incomplete-metadata refusal;
- first citation creates `.bib` and inserts `\cite{...}` at the correct cursor;
- repeated citation reuses one BibTeX record/key;
- bibliography setup marks editor dirty and survives Save/reload;
- classic BibTeX inserted citation renders in a real compiled PDF;
- `biblatex`/Biber inserted citation renders in a real compiled PDF;
- citation drawer/bibliography setup on tablet/mobile;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- diagnostics → source line;
- forward/reverse SyncTeX;
- build pruning after repeated real compiles;
- missing TeX toolchain graceful degradation;
- Compose recreation persistence.

## Architecture decisions to preserve

1. Markdown research remains canonical research knowledge.
2. Annotations remain structured sidecars, not paint burned into PDFs.
3. Normal delete actions remain reversible Hide/Restore operations.
4. Annotation promotion is explicit and neutral.
5. Promoted evidence is a provenance snapshot, not a live mirror.
6. Manuscript source is durable; build output is transient.
7. SyncTeX is the source↔PDF positioning contract.
8. Compilation is execution; preserve path/process/time/security boundaries and keep shell escape disabled.
9. Citation metadata comes only from verified research records; missing bibliography fields are never guessed.
10. `.bib` files are normal stale-safe manuscript source, not a hidden database.
11. Bibliography configuration is explicit and must preserve existing user choices rather than silently rewriting them.
12. Mobile/tablet support remains first-class.
13. Editor-specific adapters remain replaceable; research/citation/build contracts must not depend on textarea/CodeMirror internals.

## Next implementation checkpoints

### Checkpoint A — runtime verification/hardening

Blocked in this connector-only session:

- run `npm run check` and `npm run check:full`;
- execute the browser/toolchain matrix above;
- repair real PDF.js/TeX/BibTeX/SyncTeX issues discovered;
- review actual TeX Live process/filesystem isolation in the container.

### Checkpoint B — PDF annotation refinements

- region/figure/table annotations for non-text/scanned PDFs;
- document hashes and PDF-version re-anchoring with confidence;
- optional explicit relationship-review step after promotion;
- threaded replies/@mentions after the single-user model is stable.

### Checkpoint C — citation bridge

Implemented:

- project evidence/paper search;
- verified metadata readiness;
- `.bib` create/update;
- source-identity deduplication;
- deterministic keys;
- Consensus/local evidence support through indexed research objects;
- `\cite{...}` cursor insertion;
- source note/PDF navigation;
- explicit classic BibTeX / `biblatex` bibliography setup;
- responsive citation drawer.

Remaining optional refinements:

- citation-command preference (`\cite`, `\citep`, `\parencite`, etc.) after editor/settings UX exists;
- verified publication-type fields only after the research data contract stores journal/booktitle/publisher/type explicitly.

### Checkpoint D — richer editor without sacrificing mobile

- CodeMirror 6 adapter for LaTeX/BibTeX syntax highlighting, folding, search, bracket/environment matching, completion;
- reliable textarea/mobile fallback;
- replace only the current editor insertion adapter, preserving citation/bibliography service contracts;
- optional TexLab/LSP process adapter for diagnostics, symbols, hover, references, completion;
- compiler diagnostics remain authoritative for build success.

### Checkpoint E — deeper unified research IDE

- Codex context for manuscript selection, diagnostics, annotations, evidence, citations;
- keep Ask/Draft/Act review boundaries;
- map compiled-PDF annotations back to TeX using SyncTeX;
- expose manuscript/evidence/citation events in Insights/Timeline/Graph without treating build artifacts as durable graph nodes;
- annotation import/export (XFDF/W3C-inspired) after internal model stabilization.

## Resume instructions

1. Read `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless already merged.
4. Compare against `main` before editing.
5. If a shell/browser becomes available, do Checkpoint A first.
6. Otherwise continue with Checkpoint D or the PDF-region/re-anchoring work in Checkpoint B.

## Definition of merge-ready

The branch is merge-ready only when:

- `npm run check` passes;
- `npm run check:full` passes;
- annotation create/edit/Hide/Restore survives real reload/page/zoom;
- promotion is browser-confirmed and duplicate-safe;
- manuscript stale-write + Hide/Restore is browser-confirmed;
- citation search/BibTeX dedup/cursor insertion is browser-confirmed;
- a real classic BibTeX or `biblatex` citation renders in the generated PDF;
- real `latexmk` build succeeds;
- forward/reverse SyncTeX succeeds;
- build retention succeeds across repeated real builds;
- missing TeX toolchain remains graceful;
- Compose recreation preserves all durable roots;
- docs/contracts remain aligned with implementation.
