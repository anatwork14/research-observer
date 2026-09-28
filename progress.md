# Research Observer implementation progress

Last updated: 2026-09-28

## Active checkpoint

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this progress commit: 64 commits ahead of main, 0 behind
```

Observaire now has a connected foundation spanning PDF reading/annotation, explicit annotation→evidence promotion, project-scoped LaTeX authoring/compilation, source↔PDF SyncTeX, bounded generated-build retention, and a provenance-safe research citation bridge.

The architecture still preserves the existing research compiler, Markdown evidence model, PDF.js reader, Direct Edit/Codex review boundaries, and filesystem-first project model instead of introducing a parallel research database.

## Implemented — PDF annotator

- Durable project-scoped sidecars under configured `annotationDir`.
- Existing indexed local PDFs only; arbitrary filesystem paths are rejected.
- Annotation types: highlight, comment, evidence, claim, question, limitation, method, definition, important.
- Exact quote + prefix/suffix context + normalized page rectangles.
- Zoom/responsive-safe overlay rendering.
- Optimistic revision checks and atomic sidecar writes behind a short-lived lock.
- Same-origin/write-gated annotation API.
- Selection toolbar and structured annotation drawer.
- In-place edit of semantic type, comment, tags, and color while preserving source anchors.
- Hide/Restore soft deletion through `deletedAt`; normal browser actions never physically delete annotation records.
- Tablet/mobile annotation composer and drawer layouts.

## Implemented — annotation → durable evidence

- Explicit **Promote to evidence** action from a visible annotation.
- Reuses the existing Markdown evidence writer rather than creating another evidence store.
- Preserves local PDF path, page, selected excerpt, annotation comment/type/tags, and stable annotation ID provenance.
- Annotation listing discovers already-promoted evidence and exposes Open evidence state after reload.
- Promotion is idempotent; retries resolve to the existing evidence note rather than creating duplicates.
- Annotation semantic labels never automatically create `supports`, `contradicts`, `answers`, or other research relationships.
- Promoted evidence remains an independent provenance snapshot; later annotation edits/hiding do not silently rewrite/delete it.

## Implemented — LaTeX IDE foundation

- `/ide?research=<project-id>` shares the normal Observaire project context.
- Durable source root under configured `manuscriptsDir`, project-scoped by stable project ID.
- Editable `.tex`, `.bib`, `.sty`, `.cls`, `.bst` sources plus manuscript resources.
- Project IDE state stores main file, engine, hidden files, timestamp.
- Source creation and SHA-256 stale-write protection.
- Hide/Restore soft file deletion; source bytes remain intact.
- pdfLaTeX, XeLaTeX, and LuaLaTeX engine selection.
- `latexmk` compilation with bounded process/log handling, file-line errors, SyncTeX, halt-on-error, and unrestricted shell escape disabled.
- Parsed diagnostics with source-line navigation.
- Compiled PDF preview through the existing local PDF.js/React-PDF runtime.
- Forward SyncTeX: source cursor → PDF location.
- Reverse SyncTeX: PDF double-click → project-contained source file/line.
- Responsive desktop/tablet/mobile file/editor/preview surfaces.
- Current editor remains dependency-free/touch-compatible pending the planned CodeMirror adapter.

## Implemented — bounded LaTeX build retention

- `lib/research/latex-retention.mjs` + declarations/tests.
- Browser compiles prune old matching build IDs from both:

```text
.research-observer/latex-builds/<project>/
public/_research/latex/<project>/
```

- Default retention: 12 builds per project.
- `OBSERVAIRE_LATEX_BUILD_RETENTION` supported and clamped to 2–100.
- Cleanup failure is a warning and does not turn an otherwise valid compile into a failed build.
- Only generated/transient build output is pruned; manuscript source is never eligible.

## Implemented — research citation bridge

### Citation discovery

- Added `lib/research/latex-citations.mjs` + declarations.
- Added `/api/ide/citations` GET/POST API with same-origin/write protections.
- Citation search is project-scoped and uses the canonical research compiler.
- Search candidates are indexed `literature` and `evidence` objects only.
- Search matches title, summary, authors, year, DOI, URL, and tags.
- Results link back to the source research note and local paper when available.

### Provenance-safe metadata resolution

- No citation registry/database separate from research Markdown.
- No invented author, year, DOI, URL, publication type, or journal data.
- Incomplete sources remain browseable but non-insertable until verified metadata exists.
- When promoted/local evidence points at a PDF also referenced by a literature note, Observaire chooses the most complete matching literature metadata while keeping the evidence object as the research-context origin.
- Consensus evidence uses provider metadata already persisted into the reviewed evidence object.

### BibTeX creation and deduplication

- Citation actions can create a project `references.bib` or use an existing visible `.bib` file.
- `.bib` writes reuse manuscript stale-write protection.
- Concurrent stale writes retry once rather than overwriting another edit.
- Durable source matching order:
  1. DOI
  2. source URL
  3. local PDF path
  4. title + year
- Existing matching BibTeX entries reuse their current citation key.
- New keys are deterministic author/year/title-based keys with collision suffixes.
- Generated records deliberately use conservative `@misc` entries rather than guessing `@article`, `@inproceedings`, etc.

### IDE citation UX

- Added a floating **Citations** launcher and responsive citation drawer.
- Search project literature/evidence without leaving the IDE.
- Select/create bibliography library.
- Show missing metadata and inherited literature metadata explicitly.
- Open source research note, local PDF, or verified external source.
- **Insert citation** ensures/reuses the BibTeX record then inserts `\cite{key}` at the active `.tex` cursor.
- Insertion uses the textarea's native input event so React dirty-state/save behavior is preserved.
- The current textarea adapter is intentionally isolated and replaceable when CodeMirror becomes the editor surface.
- Insert target is validated before the `.bib` write, so opening the citation drawer without a valid `.tex` editor cannot create an orphan bibliography mutation.

## Implemented — persistence and agent contracts

- Added configured `annotationDir` and `manuscriptsDir` roots.
- Added `annotations/AGENTS.md` for annotation schema, locking, soft-delete, promotion, provenance, and idempotency.
- Added `manuscripts/AGENTS.md` for manuscript state, builds, SyncTeX, citation integrity, BibTeX deduplication, and non-fabrication.
- Updated `app/AGENTS.md` with annotation/IDE/citation/mobile/execution boundaries.
- Added manuscript `.gitignore` rules for TeX intermediate files.
- `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` documents the unified architecture.

## Implemented — Docker/toolchain persistence

The image includes `latexmk`, Biber, Ghostscript, TeX Live base/recommended/extra/science/pictures/fonts, XeTeX, and LuaTeX.

Compose persists all durable authoring domains:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` stays on the named state volume because build/cache/integration data is rebuildable/transient.

`npm run observaire:start` / `observaire:start:build` run a directory preflight to create durable host bind directories before Compose starts.

## Tests added in code

### `tests/pdf-annotations.test.mjs`

- create/list structured annotations;
- stale revision rejection;
- non-destructive metadata editing;
- Hide/Restore;
- promotion to evidence;
- annotation-ID provenance;
- promotion discovery after reload;
- idempotent repeated promotion.

### `tests/latex-ide.test.mjs`

- source creation;
- main file/engine state;
- stale-safe saves;
- stale save rejection;
- Hide/Restore without deleting bytes;
- manuscript separation from Markdown compiler.

### `tests/latex-retention.test.mjs`

- default/configured/clamped retention;
- synchronized transient/public preview pruning;
- newest-build retention.

### `tests/latex-citations.test.mjs`

- project citation discovery;
- evidence inheriting verified metadata from the matching literature/PDF source;
- BibTeX creation;
- deterministic citation key generation;
- DOI-based deduplication across literature/evidence views of the same paper;
- local PDF provenance in BibTeX;
- refusal to cite incomplete metadata rather than fabricating it.

These tests are present in the branch but have **not been executed in this GitHub-only session**.

## Verification status

### Confirmed by repository inspection

- Branch remained directly based on current `main`: 64 commits ahead / 0 behind before this progress commit.
- Annotation/manuscript stores remain scoped outside `progress/`.
- Hide paths remain non-destructive.
- Annotation promotion reuses canonical evidence writing.
- Citation discovery reuses canonical compiler metadata.
- Citation/BibTeX writes reuse manuscript path and stale-write protections.
- LaTeX compilation and citation writes remain server-side/same-origin gated.
- Build retention removes generated directories only.
- Docker persistence covers all three durable source roots.

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

Browser/toolchain matrix still required:

- PDF selection → annotate → reload/page/zoom → anchor alignment;
- annotation edit → reload → same source anchor;
- Promote to evidence → reload/open evidence → one durable note;
- concurrent/repeated promotion in a real server process;
- annotation Hide/Restore;
- touch/iPad annotation interactions;
- create/edit/hide/restore `.tex` and `.bib`;
- citation search and incomplete-metadata refusal;
- first citation creates `.bib` and inserts `\cite{...}` at the correct cursor;
- repeated citation reuses one BibTeX record/key;
- citation insertion correctly marks the source editor dirty and survives Save/reload;
- citation drawer works on tablet/mobile;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- BibTeX/Biber smoke build with a real inserted citation;
- diagnostics → source line;
- forward/reverse SyncTeX;
- repeated compiles prune old builds without removing the latest preview;
- missing TeX toolchain degrades gracefully;
- Compose recreation preserves progress/annotations/manuscripts.

## Architecture decisions to preserve

1. Markdown research remains canonical research knowledge.
2. Annotations remain structured sidecars rather than mutations burned into PDFs.
3. Normal delete actions are reversible Hide/Restore operations.
4. Annotation promotion is explicit and neutral; reading labels do not become scientific relationships automatically.
5. Promoted evidence is a provenance snapshot, not a live mirror of annotation edits.
6. Manuscript source is durable; build output is transient.
7. SyncTeX is the source↔PDF positioning contract.
8. Compilation is execution: preserve path/process/time/security boundaries and keep shell escape disabled.
9. Citation metadata comes from verified research records; missing bibliography fields are never guessed.
10. `.bib` files are normal stale-safe manuscript source, not a separate hidden database.
11. Mobile/tablet support remains first-class.
12. Editor-specific integration stays replaceable; citation/research/build services must not depend on textarea/CodeMirror internals.

## Next implementation checkpoints

### Checkpoint A — runtime verification/hardening

Still blocked on access to a real checkout/browser in this session:

- run `npm run check` and `npm run check:full`;
- run the browser/toolchain matrix above;
- repair any real PDF.js/TeX/BibTeX/SyncTeX regressions found;
- review TeX Live process/filesystem isolation in the real container.

### Checkpoint B — PDF annotation refinements

- region/figure/table annotations for non-text and scanned PDFs;
- PDF identity hashes and document-version re-anchoring/confidence;
- optional explicit relationship-review step after evidence promotion;
- threaded replies/@mentions after the single-user data model is stable.

### Checkpoint C — citation bridge

Implemented in this checkpoint:

- project evidence/paper search;
- verified-metadata readiness checks;
- `.bib` creation/update;
- BibTeX identity deduplication;
- deterministic key generation;
- Consensus/local evidence support through indexed research objects;
- `\cite{...}` cursor insertion;
- research-note/PDF/source navigation;
- responsive citation drawer.

Remaining citation refinements:

- explicit bibliography setup helper for manuscripts that do not yet contain `\bibliography`/`\addbibresource` configuration;
- optional citation-command preference (`\cite`, `\citep`, `\parencite`, etc.) once editor/settings UX exists;
- richer publication-type fields only after the research metadata contract explicitly stores verified journal/booktitle/publisher/type information.

### Checkpoint D — richer editor without sacrificing mobile

- CodeMirror 6 adapter for syntax highlighting, folding, search, bracket/environment matching, completions;
- retain textarea/mobile fallback;
- replace only the citation insertion adapter, preserving citation service/API;
- optional TexLab/LSP process adapter for diagnostics, symbols, hover, references, completion;
- compiler diagnostics remain authoritative for build success.

### Checkpoint E — deeper unified research IDE

- Codex context for current manuscript selection, diagnostics, annotations, evidence, citations;
- preserve Ask/Draft/Act review boundaries;
- compiled-manuscript PDF comments mapped back to TeX through SyncTeX;
- manuscript/evidence/citation events in Insights/Timeline/Graph without turning build artifacts into durable graph nodes;
- annotation export/import (XFDF/W3C-inspired) after the internal model stabilizes.

## Resume instructions

1. Read `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless already merged.
4. Compare against `main` before editing.
5. If a shell/browser becomes available, do Checkpoint A first.
6. Otherwise the next implementation target is bibliography setup UX, followed by Checkpoint D.

## Definition of merge-ready

The branch is merge-ready only when:

- `npm run check` passes;
- `npm run check:full` passes in the supported environment;
- annotation create/edit/Hide/Restore survives reload/page/zoom;
- annotation promotion is browser-confirmed and duplicate-safe;
- manuscript stale-write + Hide/Restore is browser-confirmed;
- citation search/BibTeX deduplication/cursor insertion is browser-confirmed;
- at least one real citation compiles and renders in the generated PDF;
- real `latexmk` PDF build succeeds;
- forward/reverse SyncTeX works against a real build;
- build retention works across repeated real builds;
- missing TeX toolchain is graceful;
- Compose recreation preserves all durable roots;
- docs/contracts remain consistent with implementation.
