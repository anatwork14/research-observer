# Research Observer implementation progress

Last updated: 2026-09-28

## Active checkpoint

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this checkpoint record: 97 commits ahead of main, 0 behind
```

Observaire now connects PDF reading/annotation, explicit annotation → evidence promotion, revision-aware text/visual anchors, project-scoped LaTeX authoring/compilation, source ↔ PDF SyncTeX, research-aware citations/BibTeX, bibliography setup, a dependency-free LaTeX editor-assistance layer, and read-only Codex manuscript Ask/Draft context.

The implementation continues to preserve the Markdown research compiler, evidence writer, PDF.js reader, existing Codex Act review boundary, and filesystem-first project model. No parallel research database has been introduced.

## Implemented — PDF annotation system

### Durable sidecars and editing

- Project-scoped annotation sidecars under configured `annotationDir`.
- Annotation targets must resolve to existing indexed local PDFs.
- Sidecar writes are atomic and protected by optimistic revision checks plus a short-lived filesystem lock.
- Normal delete is Hide/Restore via `deletedAt`; browser actions do not physically remove records.
- Metadata editing changes type/comment/tags/color without silently moving the source anchor.
- Annotation drawer remains responsive on desktop/tablet/mobile.

### Text annotations

Supported semantic types:

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

Text anchors retain:

- page;
- normalized page rectangles;
- exact quote;
- prefix/suffix context;
- optional normalized page-text SHA-256;
- optional page-text character index;
- source PDF SHA-256.

### Visual-region annotations — implemented in this checkpoint

Added first-class types:

```text
area
figure
table
```

The PDF reader now provides **Select area**. The user can drag directly over:

- figures;
- tables;
- equations;
- charts;
- diagrams;
- scanned/image-only PDF regions;
- any area without selectable text.

Region coordinates are normalized to the current PDF page, so zoom/responsive changes do not alter the stored geometry.

Region annotations deliberately allow an empty quote. A visual rectangle is not converted into fake textual evidence.

### Document fingerprints and annotation schema v2 — implemented in this checkpoint

- Annotation schema is now v2.
- Existing schema-v1 sidecars remain readable.
- Reading a v1 sidecar does not destructively rewrite it; its old annotations surface as `legacy` anchors until an explicit mutation/re-anchor persists v2 state.
- New anchors store the actual PDF SHA-256.
- Current PDF bytes are fingerprinted and compared with each saved anchor.
- Public anchor status is one of:

```text
current
stale
legacy
```

- `current`: anchor was created/re-anchored against the current PDF bytes.
- `stale`: the PDF bytes changed after the anchor was saved.
- `legacy`: an older sidecar lacks a source-document fingerprint.
- The annotation drawer summarizes stale/legacy counts and marks stale geometry visually.

This prevents an updated/replaced PDF from silently making old coordinates look verified.

### Explicit re-anchoring — implemented in this checkpoint

Text annotations expose **Re-anchor text**:

1. choose re-anchor;
2. select replacement text in the PDF;
3. explicitly confirm **Re-anchor here**.

Region annotations expose **Re-anchor area**:

1. choose re-anchor;
2. drag the replacement region;
3. the new region becomes the active anchor.

Re-anchoring:

- uses the current PDF SHA-256;
- preserves previous page/quote/rectangles/fingerprint in `anchorHistory`;
- keeps a bounded history rather than growing indefinitely;
- increments the sidecar revision;
- never deletes the old anchor silently.

Future fuzzy matching may propose possible targets, but it must not auto-write guessed anchors without review.

### Annotation → durable evidence

- Explicit **Promote to evidence** remains the only promotion path.
- Promotion reuses the existing Markdown evidence writer.
- Text evidence preserves PDF path, page, selected quote, annotation comment/type/tags, annotation ID, anchor kind, and document SHA-256 provenance.
- Promotion remains idempotent.
- Annotation types never auto-create `supports`, `contradicts`, `answers`, or other scientific graph relationships.
- Region-only annotations with no verified quote/OCR/caption text are refused by evidence promotion; a comment is never reused as a fake source quote.
- Hiding/editing/re-anchoring an annotation does not silently rewrite already-promoted evidence. Promoted evidence remains a provenance snapshot.

## Implemented — LaTeX IDE

### Workspace and source safety

- `/ide?research=<project-id>` shares normal Observaire project context.
- Durable source lives under configured `manuscriptsDir`.
- Editable source types: `.tex`, `.bib`, `.sty`, `.cls`, `.bst`.
- `.observaire-ide.json` stores main file, engine, hidden files, and workspace timestamp.
- Source saves use SHA-256 stale-write protection.
- Hide/Restore never deletes manuscript bytes.

### Compilation

- pdfLaTeX, XeLaTeX, LuaLaTeX selection.
- `latexmk` orchestration.
- unrestricted shell escape disabled.
- bounded process/log handling.
- parsed file/line compiler diagnostics.
- local React-PDF/PDF.js compiled-PDF preview.
- forward SyncTeX: source cursor → PDF position.
- reverse SyncTeX: PDF double-click → source file/line.
- reverse paths are validated inside the selected manuscript project.

### Build retention

- Generated build IDs are pruned from both `.research-observer/latex-builds/<project>/` and `public/_research/latex/<project>/`.
- Default retention: 12.
- `OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100.
- Cleanup failures are warnings, not false build failures.
- Durable manuscript source is never pruned.

## Implemented — research citation/BibTeX bridge

- Project-scoped search over canonical `literature` and `evidence` research objects.
- Search uses title, summary, author, year, DOI, URL, and tags.
- Results link to source note, local PDF, and external source where available.
- Missing bibliography metadata is never fabricated.
- Incomplete candidates remain visible but non-insertable.
- Evidence may inherit verified bibliography metadata from the most complete literature note resolving to the same local PDF.
- `.bib` creation/update uses normal manuscript path and stale-write guards.
- Deduplication order:
  1. DOI
  2. source URL
  3. local PDF
  4. title + year
- Existing keys are reused.
- New keys are deterministic author/year/title keys with collision suffixes.
- Generated entries use conservative `@misc` until richer publication metadata exists in the canonical research schema.
- **Insert citation** writes/reuses the BibTeX record and inserts `\cite{key}` at the current TeX cursor.
- Server-side bibliography mutation is not performed unless a valid `.tex` insertion target exists.

## Implemented — bibliography setup

- Browser-safe source transform supports classic BibTeX and `biblatex`.
- Existing bibliography style is preserved.
- Missing classic style can be repaired conservatively with `plain`.
- Existing bibliography library is not silently switched to a different library.
- `biblatex` gets `\addbibresource`/`\printbibliography` only when needed.
- Unsafe/escaping `.bib` paths are rejected.
- Cursor offsets are preserved across source insertions.

## Implemented — LaTeX editor assistance

Dependency-independent editor assistance currently includes:

- `Ctrl/⌘ + Shift + P` command palette;
- `Ctrl/⌘ + /` line comment toggle;
- bold/italic/emphasis wrappers;
- section/subsection insertion;
- equation/align/itemize/enumerate/figure/table environment insertion;
- section + label outline;
- source navigation from outline/problems;
- mismatched/unclosed environment detection;
- brace diagnostics;
- duplicate-label diagnostics.

These client diagnostics are advisory. `latexmk` remains authoritative.

### CodeMirror status

The repository commits `package-lock.json`. This environment cannot reach npm/GitHub to generate and verify a valid CodeMirror dependency/lockfile update. CodeMirror is therefore intentionally deferred rather than committing a broken `npm ci` state.

When a networked checkout is available, add CodeMirror in one lockfile-safe change and keep the existing textarea/editor-assistant layer as the mobile/safe fallback.

## Implemented — Codex manuscript Ask/Draft

- Dedicated IDE manuscript assistant.
- Ask and Draft only.
- Context may include:
  - selected project;
  - active `.tex` file;
  - current unsaved selection/source snapshot;
  - latest compiler diagnostics.
- Manuscript source and diagnostics are explicitly wrapped as untrusted source material.
- Ask/Draft use read-only Codex sandboxing.
- Draft output is a proposal/copyable text only; it is not silently inserted into manuscript source.
- Existing Codex Act remains restricted to reviewed `progress/` changes.
- Manuscript Act is not implemented by weakening that restriction.

A future manuscript Act needs its own stale-safe review/apply path with project path guards, source hashes, visible diffs, and explicit approval.

## Persistence/toolchain

Docker/Compose persists:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains transient/rebuildable state.

Docker toolchain includes `latexmk`, Biber, Ghostscript, TeX Live base/recommended/extra/science/pictures/fonts, XeTeX, and LuaTeX.

## Tests present in the branch

### `tests/pdf-annotations.test.mjs`

Covers:

- text annotation creation;
- PDF SHA-bound anchors;
- stale revision rejection;
- metadata edit without anchor movement;
- Hide/Restore;
- area/figure/table region creation without fake quote text;
- refusal to promote a region lacking verified textual source;
- changed PDF bytes → stale anchor status;
- explicit region re-anchor;
- preserved previous anchor in history;
- schema-v1 sidecar → legacy anchor compatibility;
- evidence promotion/provenance/idempotency.

### Other test files

- `tests/latex-ide.test.mjs`
- `tests/latex-retention.test.mjs`
- `tests/latex-citations.test.mjs`
- `tests/latex-bibliography.test.mjs`
- `tests/latex-editor-tools.test.mjs`

The pure `latex-editor-tools` test set was exercised separately in an isolated Node run during the previous checkpoint. This does **not** substitute for the repository quality gate.

## Verification status

### Confirmed by repository inspection

- Feature branch remained directly based on `main`; it was 97 commits ahead / 0 behind before the latest contract/progress commits.
- Durable annotation/manuscript stores remain separate from Markdown research.
- Annotation schema v2 accepts schema v1.
- New annotation anchors store current PDF SHA-256.
- Stale status is based on source-document fingerprint mismatch, not UI coordinates.
- Explicit re-anchor preserves history.
- Region annotation does not require selectable text.
- Region-only evidence promotion is blocked without verified source text.
- Hide flows remain non-destructive.
- Citation discovery reuses canonical research metadata.
- Manuscript source/BibTeX writes reuse path and stale-write protections.
- Manuscript Codex Ask/Draft remains read-only.
- Existing Codex Act path restriction remains intact.

### Still requiring real checkout/browser/toolchain verification

Do not claim the following passed yet:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run check
npm run check:full
```

Browser/toolchain matrix still needs to exercise:

- text annotation create/edit/Hide/Restore across reload and zoom;
- desktop mouse region drag;
- tablet/touch region drag;
- figure/table/area overlay alignment after zoom/page navigation/reload;
- replacing a real PDF marks old anchors stale;
- text re-anchor against real PDF.js text-layer spans;
- region re-anchor against a changed real PDF;
- v1 real sidecar migration behavior;
- promotion refusal/acceptance behavior with region annotations;
- real classic BibTeX and `biblatex` compile flows;
- citation insertion/dedup in browser;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- diagnostics → source navigation;
- forward/reverse SyncTeX;
- build retention after repeated real builds;
- manuscript Codex Ask/Draft context;
- mobile/tablet IDE panels;
- Compose recreation persistence.

## Architecture rules to preserve

1. Markdown research remains canonical research knowledge.
2. PDF annotations remain structured sidecars, never burned into source PDFs for normal operation.
3. Hide/Restore is non-destructive.
4. Text and visual-region anchors are separate valid source-target modes.
5. New anchors are bound to the source PDF SHA-256.
6. A stale anchor is a warning/review state, not permission to auto-move it.
7. Re-anchor is explicit and preserves old anchor history.
8. Region comments are not source quotes.
9. Evidence promotion is explicit, neutral, provenance-preserving, and idempotent.
10. Promoted evidence is a snapshot rather than a live mirror of mutable annotations.
11. Manuscript source is durable; build output is transient.
12. SyncTeX is the source ↔ compiled-PDF positioning contract.
13. Compilation is execution: preserve path/process/time/security boundaries and shell-escape restrictions.
14. Bibliography metadata is never invented.
15. `.bib` files are normal stale-safe manuscript files, not a hidden database.
16. Editor-specific adapters remain replaceable.
17. Mobile/tablet is a first-class requirement.
18. Existing research Codex Act restrictions must not be weakened to add manuscript writing.

## Next implementation targets

### 1. Region source-text bridge

Add an explicit optional field for region annotations where the user can attach verified:

- figure/table caption;
- OCR result they reviewed;
- manually transcribed source text.

Store the provenance kind separately from the comment. Only this verified source text may unlock region → evidence promotion.

### 2. Re-anchor candidate assistance

Add a non-destructive proposal layer for stale text anchors:

- exact quote search first;
- prefix/suffix matching;
- page-text fingerprint hints;
- candidate page/location + confidence;
- user confirmation before applying.

Do not auto-write candidates.

### 3. Citation token navigation

From a `\cite{key}` token in the editor:

- resolve the key in visible project `.bib` files;
- resolve DOI/URL/PDF identity back to canonical literature/evidence;
- open the research note/PDF directly.

### 4. Manuscript Act/review architecture

Design a separate manuscript proposal flow with:

- project-scoped manuscript snapshot;
- source hashes;
- visible diff;
- stale-source detection;
- explicit apply;
- no reuse of the existing research-only Act path guard.

### 5. Runtime verification

As soon as a full checkout/browser/toolchain is available, run the quality gate and repair real integration defects before merge.

## Resume instructions

1. Read root `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless merged.
4. Compare with `main` before editing.
5. If a full runtime is available, prioritize verification before adding another large subsystem.
6. Otherwise continue with the region source-text bridge, re-anchor candidate assistance, or citation-token navigation in that order.

## Merge-ready definition

This branch is not merge-ready until:

- `npm run check` passes;
- `npm run check:full` passes;
- real text and region annotation flows survive reload/zoom/page changes;
- changed PDFs correctly surface stale anchors;
- text/region re-anchor is browser-confirmed and preserves history;
- annotation promotion is duplicate-safe;
- manuscript stale-write + Hide/Restore is browser-confirmed;
- citation/BibTeX insertion/dedup is browser-confirmed;
- at least one real bibliography citation renders in compiled PDF;
- real `latexmk` and SyncTeX flows pass;
- build retention works after repeated compiles;
- TeX absence degrades gracefully;
- Compose recreation preserves all durable roots;
- docs/contracts remain aligned with implementation.
