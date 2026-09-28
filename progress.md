# Research Observer implementation progress

Last updated: 2026-09-28

## Active checkpoint

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this progress commit: 82 commits ahead of main, 0 behind
```

Observaire now connects PDF reading/annotation, annotation → evidence promotion, project-scoped LaTeX authoring/compilation, source ↔ PDF SyncTeX, research-aware citations/BibTeX, bibliography setup, and a dependency-free LaTeX editor-assistance layer.

The implementation continues to preserve the existing Markdown research compiler, evidence writer, PDF.js reader, Direct Edit/Codex review boundaries, and filesystem-first project model. No parallel research database has been introduced.

## Implemented — PDF annotator

- Durable project-scoped annotation sidecars under configured `annotationDir`.
- Annotation targets must resolve to existing indexed local PDFs.
- Structured types: highlight, comment, evidence, claim, question, limitation, method, definition, important.
- Exact quote + prefix/suffix context + normalized page rectangles.
- Zoom/responsive-safe overlays.
- Optimistic revision checks and atomic sidecar writes behind a short-lived lock.
- Same-origin/write-gated annotation API.
- Text-selection toolbar and structured annotation drawer.
- In-place metadata editing for type, comment, tags, and color while preserving source anchors.
- Hide/Restore soft deletion via `deletedAt`; normal browser actions never physically delete annotation records.
- Responsive tablet/mobile composer and drawer.

## Implemented — annotation → durable evidence

- Explicit **Promote to evidence** action.
- Reuses the existing Markdown evidence writer.
- Preserves PDF path, page, selected excerpt, annotation comment/type/tags, and annotation ID provenance.
- Promoted evidence is rediscovered from annotation listing after reload.
- Repeated promotion is idempotent and resolves to the same evidence object.
- Annotation labels never automatically create scientific graph relationships.
- Hiding/editing a source annotation does not silently rewrite already-promoted evidence.

## Implemented — LaTeX IDE foundation

- `/ide?research=<project-id>` shares normal Observaire project context.
- Durable project source under configured `manuscriptsDir`.
- Editable `.tex`, `.bib`, `.sty`, `.cls`, `.bst` source.
- `.observaire-ide.json` stores main file, engine, hidden files, timestamp.
- Source creation and SHA-256 stale-write protection.
- Hide/Restore file behavior without deleting bytes.
- pdfLaTeX, XeLaTeX, LuaLaTeX selection.
- Local `latexmk` orchestration with bounded process/log handling, file-line errors, SyncTeX, halt-on-error, and unrestricted shell escape disabled.
- Parsed build diagnostics with source-line navigation.
- Compiled PDF preview through local React-PDF/PDF.js assets.
- Forward SyncTeX: source cursor → PDF position.
- Reverse SyncTeX: PDF double-click → source file/line with project-boundary checks.
- Responsive desktop/tablet/mobile file/editor/preview panels.

## Implemented — bounded build retention

- `lib/research/latex-retention.mjs` + declarations/tests.
- Prunes matching generated build IDs from `.research-observer/latex-builds/<project>/` and `public/_research/latex/<project>/`.
- Default retention: 12 builds per project.
- `OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100.
- Cleanup errors are warnings rather than build failures.
- Durable manuscript source is never eligible for pruning.

## Implemented — research citation bridge

### Discovery and provenance

- `lib/research/latex-citations.mjs` + declarations.
- `/api/ide/citations` with same-origin/write protections.
- Project-scoped search over canonical compiler `literature` and `evidence` objects.
- Search uses title, summary, author, year, DOI, URL, and tags.
- Results link back to research notes, local PDFs, and verified external sources.
- Missing author/year/source identity is never fabricated; incomplete sources remain visible but non-insertable.
- Local/promoted evidence may inherit bibliography metadata from the most complete literature object resolving to the same indexed PDF.
- Reviewed Consensus evidence uses metadata already persisted into canonical research objects.

### BibTeX creation and deduplication

- Creates `references.bib` or uses an existing visible `.bib` file.
- `.bib` writes reuse manuscript path guards and stale-write protection.
- One stale concurrent write is retried rather than overwritten.
- Deduplication identity order: DOI → source URL → local PDF path → title/year.
- Existing matching records reuse their citation key.
- New keys are deterministic author/year/title keys with collision suffixes.
- Generated records intentionally use conservative `@misc` rather than guessing publication classes absent from verified metadata.

### IDE citation UX

- Floating **Citations** launcher and responsive drawer.
- Search project literature/evidence without leaving the manuscript IDE.
- Select/create bibliography library.
- Missing/inherited metadata shown explicitly.
- Open source note/PDF/external source.
- **Insert citation** creates/reuses the BibTeX record and inserts `\cite{key}` at the active `.tex` cursor.
- Validates the insertion target before `.bib` mutation, avoiding orphan bibliography writes.
- Current textarea adapter dispatches the native input event so React dirty/save semantics remain intact.

## Implemented — explicit bibliography setup

- Browser-safe `lib/research/latex-bibliography.mjs` + declarations/tests.
- **Configure bibliography in current TeX file** action.
- Unsafe/escaping `.bib` paths rejected.
- Requires a normal `\begin{document}` / `\end{document}` document body.
- Classic BibTeX:
  - preserves existing `\bibliographystyle{...}`;
  - adds selected `\bibliography{...}` when missing;
  - adds `plain` only when a basic style is actually needed;
  - repairs a matching existing bibliography that has no style;
  - does not silently replace a different existing bibliography library.
- `biblatex`:
  - detects package/resource usage;
  - adds missing selected `\addbibresource{...}`;
  - adds `\printbibliography` only when missing;
  - never mixes classic BibTeX commands into detected `biblatex` setup.
- Cursor/selection offsets are mapped through inserted configuration text.

## Implemented — richer dependency-free LaTeX editor fallback

This checkpoint adds useful IDE behavior without introducing an invalid dependency/lockfile state.

- Added browser-safe `lib/research/latex-editor-tools.mjs` + declarations/tests.
- Added `LatexEditorAssistant` to the IDE.
- `Ctrl/⌘ + Shift + P` opens the editor command surface.
- `Ctrl/⌘ + /` toggles comments for the selected/current lines.
- Command palette supports:
  - bold / italic / emphasis wrapping;
  - section / subsection insertion;
  - equation / align environments;
  - itemize / enumerate;
  - figure / table environments.
- Live current-file outline extracts sections/subsections and labels.
- Clicking outline items jumps to the corresponding source position.
- Lightweight structural diagnostics detect:
  - unmatched/mismatched environments;
  - missing `\end{document}`;
  - unmatched braces;
  - duplicate labels.
- Clicking a structural diagnostic jumps to its source position.
- Structural hints are advisory only; `latexmk` diagnostics remain authoritative for build success/failure.
- Editor tools use the same temporary textarea/native-input adapter pattern as citation insertion so dirty/save semantics stay intact.
- Responsive bottom-sheet behavior is retained for tablet/mobile.

### Why CodeMirror itself is not committed yet

Current official CodeMirror packages are actively maintained, and the official legacy-mode package includes the `stex` LaTeX stream parser. However, this repository uses a committed npm lockfile and the current execution environment cannot reach GitHub/npm to generate and verify a matching `package-lock.json` update. Adding dependencies only to `package.json` would deliberately break `npm ci`, so that step is deferred rather than faked.

When a networked checkout is available, introduce CodeMirror as one isolated lockfile-safe change and retain this textarea assistant as the mobile/safe fallback.

## Persistence and agent contracts

- `annotationDir` and `manuscriptsDir` are explicit configured roots.
- `annotations/AGENTS.md` documents sidecar schema, locking, soft delete, promotion, provenance, idempotency.
- `manuscripts/AGENTS.md` documents manuscript state, compilation boundaries, SyncTeX, citations, bibliography behavior, and metadata non-fabrication.
- `app/AGENTS.md` documents PDF/IDE/mobile/server-client boundaries.
- Manuscript `.gitignore` excludes normal TeX intermediates.
- `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` documents the unified architecture.

## Docker/toolchain persistence

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
- non-destructive metadata editing;
- Hide/Restore;
- evidence promotion + annotation-ID provenance;
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
- synchronized build/preview pruning;
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
- existing-style preservation;
- missing-style repair;
- duplicate-setup avoidance;
- `biblatex` resource/print setup;
- cursor mapping;
- unsafe-path/non-document rejection.

### `tests/latex-editor-tools.test.mjs`

- section/label outline extraction;
- commented-command exclusion;
- environment mismatch/unclosed detection;
- brace and duplicate-label diagnostics;
- reversible line commenting;
- selection wrapping;
- environment/section insertion ranges;
- rejection of unsupported transforms.

These tests are present in the branch but the current connector environment still cannot execute the repository quality gate.

## Verification status

### Confirmed by repository inspection

- Branch remained directly based on `main`: 82 commits ahead / 0 behind before this progress commit.
- Annotation/manuscript stores remain path-scoped and separate from Markdown research.
- Browser Hide flows remain non-destructive.
- Annotation promotion reuses canonical evidence writing.
- Citation discovery reuses canonical research compiler metadata.
- Citation/BibTeX writes reuse manuscript path/stale-write guards.
- Bibliography/editor transforms are browser-safe and import no Node/process/filesystem modules.
- Compile/citation mutation APIs remain server-side/same-origin gated.
- `latexmk` remains authoritative; client structural diagnostics do not change build status.
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
- editor command palette/comment toggle/outline/problem jumps;
- editor assistant on tablet/mobile;
- citation search and incomplete-metadata refusal;
- first citation creates `.bib` and inserts `\cite{...}` at the correct cursor;
- repeated citation reuses one BibTeX record/key;
- bibliography setup marks editor dirty and survives Save/reload;
- classic BibTeX citation renders in a real generated PDF;
- `biblatex`/Biber citation renders in a real generated PDF;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- diagnostics → source line;
- forward/reverse SyncTeX;
- build pruning after repeated real compiles;
- missing TeX toolchain graceful degradation;
- Compose recreation persistence.

## Architecture decisions to preserve

1. Markdown research remains canonical research knowledge.
2. Annotations remain structured sidecars, not paint burned into source PDFs.
3. Normal delete actions remain reversible Hide/Restore operations.
4. Annotation promotion is explicit and neutral.
5. Promoted evidence is a provenance snapshot, not a live mirror.
6. Manuscript source is durable; build output is transient.
7. SyncTeX is the source↔PDF positioning contract.
8. Compilation is execution; preserve path/process/time/security boundaries and keep shell escape disabled.
9. Citation metadata comes only from verified research records; missing bibliography fields are never guessed.
10. `.bib` files are stale-safe manuscript source, not a hidden citation database.
11. Bibliography configuration is explicit and preserves existing user choices.
12. Mobile/tablet support remains first-class.
13. Editor-specific adapters remain replaceable; research/citation/build contracts do not depend on textarea/CodeMirror internals.
14. Client structural diagnostics are hints; compiler diagnostics remain authoritative.
15. Do not introduce package dependencies without a matching valid lockfile update and quality-gate run.

## Next implementation checkpoints

### Checkpoint A — runtime verification/hardening

Blocked in this connector-only environment:

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

Implemented: project research search, verified metadata readiness, `.bib` create/update/dedup, deterministic keys, `\cite{...}` insertion, provenance navigation, classic BibTeX/`biblatex` setup, responsive citation UX.

Optional refinements:

- citation-command preference (`\cite`, `\citep`, `\parencite`, etc.);
- verified publication-type fields only after the canonical research schema stores them explicitly.

### Checkpoint D — richer editor without sacrificing mobile

Implemented in this continuation:

- dependency-free command palette;
- comment toggle;
- safe snippets/environments;
- outline navigation;
- lightweight structural diagnostics;
- responsive textarea fallback.

Remaining:

- generate a real CodeMirror dependency + lockfile update from a networked checkout;
- use official CodeMirror packages and `stex` LaTeX language support;
- keep current textarea assistant as safe/mobile fallback;
- optional TexLab/LSP provider for symbols/hover/references/completion;
- compiler diagnostics remain authoritative.

### Checkpoint E — deeper unified research IDE

- Codex context for manuscript selection, diagnostics, annotations, evidence, citations;
- preserve Ask/Draft/Act review boundaries;
- map compiled-PDF annotations back to TeX using SyncTeX;
- expose manuscript/evidence/citation events in Insights/Timeline/Graph without treating build artifacts as durable graph nodes;
- annotation import/export (XFDF/W3C-inspired) after internal model stabilization.

## Resume instructions

1. Read `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless already merged.
4. Compare against `main` before editing.
5. If a networked shell/browser becomes available, run Checkpoint A first and generate the CodeMirror lockfile change legitimately.
6. Otherwise continue with PDF region/re-anchoring or deeper IDE/Codex integration.

## Definition of merge-ready

The branch is merge-ready only when:

- `npm run check` passes;
- `npm run check:full` passes;
- annotation create/edit/Hide/Restore survives real reload/page/zoom;
- promotion is browser-confirmed and duplicate-safe;
- manuscript stale-write + Hide/Restore is browser-confirmed;
- editor assistant is browser/tablet-confirmed;
- citation search/BibTeX dedup/cursor insertion is browser-confirmed;
- a real classic BibTeX or `biblatex` citation renders in the generated PDF;
- real `latexmk` build succeeds;
- forward/reverse SyncTeX succeeds;
- build retention succeeds across repeated real builds;
- missing TeX toolchain remains graceful;
- Compose recreation preserves all durable roots;
- docs/contracts remain aligned with implementation.
