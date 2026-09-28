# Research Observer implementation progress

Last updated: 2026-09-28

## Active checkpoint

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Implementation head before this progress record: 6d34116f40a01a65c4bee989d40525bd1acc16f9
```

This checkpoint extends Observaire from a Markdown-first research observer into a connected research workspace with durable PDF annotations and a project-scoped LaTeX authoring/compile surface. The architecture deliberately preserves the existing research compiler, evidence model, Codex review model, and PDF.js reader instead of introducing a parallel database or replacing working subsystems.

## Status summary

### Implemented — PDF annotator foundation

- Added a durable project-scoped PDF annotation sidecar model in `lib/research/pdf-annotations.mjs` with TypeScript declarations.
- Annotation targets must resolve to an existing indexed local PDF; arbitrary filesystem paths are rejected.
- Added structured annotation types: highlight, comment, evidence, claim, question, limitation, method, definition, important.
- Selection anchors store exact quote context plus normalized PDF-page rectangles so overlays survive zoom/responsive layout changes.
- Sidecars use optimistic revision checks to reject stale browser writes.
- Sidecar writes are atomic and use a short-lived filesystem lock.
- Added create/update/hide/restore API behavior under `/api/papers/annotations` with same-origin/write gating.
- Normal annotation deletion is soft deletion only: `deletedAt` is set and the record remains recoverable.
- Added `PdfAnnotationBridge` on top of the existing PDF reader instead of replacing `PdfReaderInner`.
- Added selection toolbar, quick highlight/evidence actions, structured comment composer, rendered page overlays, annotation drawer, Show hidden, Hide, and Restore.
- Kept reading annotations separate from durable scientific evidence/graph truth; annotation labels do not automatically create `supports`, `contradicts`, or other semantic research relationships.

### Implemented — LaTeX IDE foundation

- Added `/ide?research=<project-id>` and integrated IDE into the shared workspace navigation/project context.
- Added durable project-scoped manuscript roots under `manuscripts/<project-id>/` (or configured `manuscriptsDir`).
- Added editable `.tex`, `.bib`, `.sty`, `.cls`, and `.bst` source support.
- Added `.observaire-ide.json` state for main file, engine, hidden-file list, and timestamp.
- Added source creation and stale-safe SHA-256 saves; stale files return a conflict rather than being overwritten.
- Added reversible file Hide/Restore; the physical source file is not deleted.
- Added main-file auto-detection and selectable pdfLaTeX/XeLaTeX/LuaLaTeX engines.
- Added local `latexmk` compiler provider with bounded process/log handling, file-line errors, SyncTeX, halt-on-error, generated output directory, and unrestricted shell escape disabled.
- Added structured compiler diagnostic parsing and source-line jumps from the Log panel.
- Added compiled PDF preview through the existing local React-PDF/PDF.js runtime.
- Added forward SyncTeX (source cursor → PDF location).
- Added reverse SyncTeX (PDF double-click → source file/line), including project-boundary validation.
- Added responsive file rail/editor/preview behavior for desktop and tablet/mobile layouts.
- Deliberately kept the first editor dependency-free/touch-compatible. The editor API surface is designed so CodeMirror 6 and later TexLab/LSP support can be layered on without changing storage/build contracts.

### Implemented — persistence and agent contracts

- Added `annotationDir` and `manuscriptsDir` configuration roots.
- Added `annotations/AGENTS.md` describing durable annotation schema/soft-delete/concurrency rules.
- Added `manuscripts/AGENTS.md` describing project source, stale saves, soft hiding, build separation, and SyncTeX rules.
- Added manuscript `.gitignore` rules for ordinary TeX intermediate files.
- Updated `app/AGENTS.md` with PDF annotation, LaTeX IDE, mobile, execution-boundary, soft-delete, and persistence contracts.
- Added `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` with architecture and integration roadmap.
- Updated the workspace header so project context explicitly scopes manuscripts as well as notes/papers/evidence.

### Implemented — Docker/toolchain integration

- Extended the Docker image with `latexmk`, Biber, Ghostscript, TeX Live base/recommended/extra/science/pictures/fonts, XeTeX, and LuaTeX packages.
- Added `/app/annotations` and `/app/manuscripts` writable roots to the image.
- Compose now persists all durable data domains:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

- Compose explicitly enables the local LaTeX provider with `RESEARCH_OBSERVER_LATEX=1`.
- `.research-observer/` remains on the named Observaire state volume because build/cache/integration state is transient.
- Added `scripts/prepare-observaire-dirs.mjs`.
- `npm run observaire:start` and `npm run observaire:start:build` now create the host research/annotation/manuscript directories before starting Compose, reducing bind-mount ownership surprises.

## Tests added in code

The branch includes new Node tests for:

### `tests/pdf-annotations.test.mjs`

- durable annotation creation;
- stale annotation revision rejection;
- soft Hide while retaining the record;
- Restore of the same annotation record.

### `tests/latex-ide.test.mjs`

- source creation;
- compiler/main-file workspace configuration;
- successful stale-safe source save;
- stale-save rejection;
- manuscript Hide without deleting bytes;
- Restore of the same source;
- manuscript source remains outside the Markdown research compiler.

These tests are **present in the branch**, but the current GitHub connector session does not provide a repository runtime shell, so they have not been executed in this checkpoint.

## Verification status

### Confirmed by repository inspection

- Feature branch is based directly on current `main` at the checkpoint base above.
- The new annotation and manuscript stores are path-scoped and separate from `progress/`.
- Normal annotation/file removal paths are soft-delete/Hide operations rather than filesystem deletion.
- PDF reader integration reuses the existing local PDF.js/React-PDF runtime.
- LaTeX compile APIs are Node-only and use same-origin/environment gates.
- Docker persistence now covers `progress/`, `annotations/`, and `manuscripts/`.

### Not yet runtime-verified in this checkpoint

Do **not** treat the following as passed until they are executed from a real checkout/container:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run check
npm run check:full
```

Also still requiring browser/toolchain verification:

- PDF selection → highlight/comment → page navigation/reload → overlay still aligns;
- Hide annotation → Show hidden → Restore;
- touch selection and annotation composer on iPad/tablet widths;
- create/edit/hide/restore `.tex` and `.bib` files;
- successful pdfLaTeX smoke compile;
- successful XeLaTeX smoke compile;
- successful LuaLaTeX smoke compile;
- bibliography/Biber smoke compile;
- compiler error → structured diagnostic → source line jump;
- source cursor → forward SyncTeX marker;
- PDF double-click → reverse SyncTeX source jump;
- missing TeX toolchain produces graceful disabled state rather than breaking Observaire;
- container recreation preserves research, annotations, and manuscripts;
- generated build artifacts remain rebuildable and are not mistaken for source.

## Architecture decisions to preserve

1. **Markdown research remains canonical research knowledge.** `progress/` and the research compiler are not replaced by annotation/manuscript state.
2. **Annotations remain structured sidecars, not PDF mutations.** Do not burn normal user annotations into source PDFs.
3. **Soft delete means reversible state, not filesystem removal.** Use Hide/Restore for annotations and manuscript files.
4. **Manuscript source is durable; build output is transient.** Never use `public/_research/latex/` or `.research-observer/latex-builds/` as the only manuscript copy.
5. **SyncTeX is the source↔PDF positioning contract.** Do not implement separate fragile line/page heuristics when SyncTeX is available.
6. **Compilation is execution.** Keep toolchain/process boundaries explicit, shell escape disabled, paths scoped, and resource/time controls reviewable.
7. **Mobile/tablet remains a first-class requirement.** A future richer editor must retain functional touch/mobile behavior.
8. **Reading labels are not scientific truth.** Annotation `evidence`/`claim` types require explicit promotion/review before becoming durable research evidence/relationships.

## Next implementation checkpoints

### Checkpoint A — close and verify the current foundation

- Run `npm run check` and repair any test/type/lint failures.
- Run `npm run check:full` with the TeX-enabled Docker image.
- Perform the browser/toolchain matrix listed above.
- Add focused regression tests for any defects discovered by real TeX/PDF.js execution.
- Review LaTeX input/output restrictions under the actual TeX Live build and tighten process isolation if needed.
- Add bounded build-retention/cleanup so repeated compiles do not grow `.research-observer/latex-builds` and `public/_research/latex` indefinitely.

### Checkpoint B — connect annotations to research evidence

- Add explicit **Promote to evidence** from a saved PDF annotation.
- Preserve annotation ID, PDF path, page, quote, and anchor metadata as provenance when promoted.
- Reuse the existing evidence writer and relationship-review UI instead of inventing a second evidence store.
- Show whether an annotation has already been promoted so duplicate evidence is not created accidentally.

### Checkpoint C — citation bridge between research and manuscript

- Add project evidence/paper search inside the IDE.
- Add BibTeX citation-key management and `.bib` insert/update with duplicate detection.
- Allow selected reviewed Consensus/local paper evidence to become a citation record explicitly.
- Add **Insert citation** at the editor cursor.
- Add citation → Papers/Evidence navigation.
- Preserve DOI/provider/local-PDF provenance and never fabricate missing bibliography metadata.

### Checkpoint D — richer editor without sacrificing mobile

- Add a CodeMirror 6 adapter for desktop/tablet-friendly syntax highlighting, folding, bracket/environment matching, search, and completions.
- Keep a reliable textarea/mobile fallback if the richer editor is unsuitable for a device.
- Add TexLab/LSP as an optional local provider for diagnostics, document symbols, hover, references, and completion.
- Keep compiler diagnostics authoritative for build success/failure.

### Checkpoint E — deeper unified research IDE

- Add Codex context for current manuscript file/selection, compiler diagnostics, related PDF annotations, evidence, and citations.
- Keep Codex Ask/Draft/Act review boundaries; do not let agent editing bypass stale-write/review safeguards.
- Map comments/annotations on a compiled manuscript PDF back to TeX positions through SyncTeX.
- Surface manuscript/evidence/citation events in Insights/Timeline/Graph without treating generated build files as durable graph objects.
- Add interoperable annotation export/import (for example XFDF/W3C-inspired mappings) only after the internal model is stable.

## Resume instructions for the next agent/session

1. Read `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, and `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md`.
3. Work from `feature/pdf-annotations-latex-ide` unless the branch has already been merged.
4. Compare the branch against `main` before editing so concurrent changes are not overwritten.
5. Run the quality gate from a real checkout before claiming the branch is merge-ready.
6. Continue with Checkpoint A first; do not skip runtime verification merely to add more features.

## Definition of merge-ready for this feature branch

The branch is ready to merge only when all of the following are true:

- `npm run check` passes;
- `npm run check:full` passes in the supported environment;
- PDF annotation create/Hide/Restore survives reload and page/zoom changes;
- manuscript stale-write and Hide/Restore behavior is confirmed in-browser;
- at least one real `latexmk` build produces a rendered PDF preview;
- forward and reverse SyncTeX are confirmed against a real build;
- TeX absence is graceful;
- Compose recreation preserves all three durable data roots;
- no browser action physically deletes annotation/manuscript source for the normal Hide flow;
- docs/agent instructions remain consistent with implementation.
