# Research Observer implementation progress

Last updated: 2026-09-28

## Active branch

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this progress commit: 105 commits ahead of main, 0 behind
```

Observaire now connects PDF reading and annotation, revision-aware evidence provenance, project-scoped LaTeX authoring/compilation, SyncTeX, research-aware citations/BibTeX, bibliography setup, dependency-free LaTeX editor assistance, and read-only Codex manuscript Ask/Draft context.

The implementation deliberately preserves the canonical Markdown research compiler, evidence writer, PDF.js/React-PDF runtime, filesystem-first project model, and the existing research-only Codex Act review boundary. No parallel research database has been introduced.

---

## 1. PDF annotation system

### Durable sidecars

Implemented under configured `annotationDir`:

- project-scoped JSON sidecars;
- optimistic revision checks;
- atomic writes behind a short-lived lock;
- stable annotation IDs;
- soft Hide/Restore through `deletedAt`;
- no normal browser action physically deletes an annotation record;
- annotation metadata edit without destructive anchor movement.

### Supported semantic types

Text-oriented:

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

Visual-region:

```text
area
figure
table
```

### Text anchors

New text annotations retain:

- page number;
- normalized page rectangles;
- exact quote;
- prefix/suffix context;
- optional page-text SHA-256;
- optional page-text character index;
- source PDF SHA-256;
- anchor timestamp/confidence metadata.

### Visual-region annotations

The reader exposes **Select area** and supports mouse/touch drag over:

- figures;
- tables;
- equations;
- charts;
- diagrams;
- scanned pages;
- other image-only areas.

Region coordinates are normalized, so zoom/responsive rendering does not alter stored geometry.

A visual region may intentionally have an empty textual quote. The application never fabricates quote text from the user's comment.

---

## 2. PDF revision integrity and schema v2

### Schema compatibility

- Annotation schema is v2.
- Schema-v1 sidecars remain readable.
- V1 records surface as `legacy` anchors until an explicit re-anchor/mutation persists modern data.
- Reads do not destructively migrate old sidecars merely by opening a PDF.

### Document fingerprinting

New anchors bind to the actual PDF SHA-256.

Public anchor state is:

```text
current
stale
legacy
```

- `current`: bound to current PDF bytes.
- `stale`: PDF bytes changed after the anchor was saved.
- `legacy`: no original document fingerprint is available.

The annotation drawer surfaces stale/legacy counts and visually distinguishes old geometry.

A replaced PDF therefore cannot silently make historical coordinates look verified.

### Explicit re-anchoring

Text annotations provide **Re-anchor text**.
Region annotations provide **Re-anchor area**.

Re-anchor behavior:

- explicitly initiated by the user;
- binds to the current PDF SHA-256;
- preserves old page/quote/rectangles/fingerprint in bounded `anchorHistory`;
- increments the sidecar revision;
- never silently overwrites history.

Automatic/fuzzy matching is not allowed to mutate an anchor. A future matcher may only propose candidates until the user confirms one.

---

## 3. Verified visual source text

Implemented in this checkpoint.

Region source text is stored separately from interpretation/comments in a dedicated `sourceText` provenance object.

Supported provenance kinds:

```text
caption
ocr
transcription
```

Saving reviewed visual source text records:

- provenance kind;
- exact reviewed text;
- text SHA-256;
- verification timestamp;
- PDF SHA-256 at review time;
- page at review time;
- review state.

`sourceTextHistory` preserves superseded/invalidated versions.

### Re-anchor invalidation

If a visual annotation moves to another region:

- the prior source text is retained in history;
- current source text becomes `reviewRequired: true`;
- evidence promotion remains unavailable;
- saving/reviewing the text again explicitly verifies it against the new region.

This prevents an old table caption/OCR result from silently following new geometry.

Raw OCR is not considered verified merely because it exists. The user must explicitly review/save it.

---

## 4. Annotation → durable evidence

Promotion remains explicit and idempotent.

### Text evidence

A new promotion requires:

- visible annotation;
- `current` anchor;
- real selected text.

Promotion preserves:

- source PDF;
- page;
- source quote;
- annotation ID;
- annotation type/tags/comment;
- anchor kind;
- document SHA-256.

### Region evidence

A visual region may be promoted only when:

- its anchor is `current`;
- reviewed `sourceText` exists;
- `reviewRequired` is false.

The evidence quote is the reviewed caption/OCR/transcription text, never the user's interpretation comment.

Region promotion additionally records:

- source-text provenance kind;
- source-text SHA-256;
- source-text verification timestamp.

### Snapshot semantics

Already-promoted evidence remains a provenance snapshot.

Later annotation edits, hiding, PDF changes, or re-anchoring do **not** silently mutate/delete the historical evidence note.

Annotation semantic labels never automatically create `supports`, `contradicts`, `answers`, or other scientific graph relationships.

---

## 5. LaTeX IDE

### Durable project source

Implemented:

- `/ide?research=<project-id>`;
- project source under configured `manuscriptsDir`;
- `.tex`, `.bib`, `.sty`, `.cls`, `.bst` editing;
- `.observaire-ide.json` state;
- SHA-256 stale-write protection;
- non-destructive Hide/Restore;
- main-file selection;
- pdfLaTeX / XeLaTeX / LuaLaTeX engine selection.

### Compilation and preview

Implemented:

- local `latexmk` orchestration;
- unrestricted shell escape disabled;
- bounded process/log handling;
- parsed file/line diagnostics;
- local React-PDF/PDF.js preview;
- forward SyncTeX source → PDF;
- reverse SyncTeX PDF → source;
- project-boundary validation for reverse-resolved paths.

### Build retention

Generated build/preview IDs are bounded in:

```text
.research-observer/latex-builds/<project>/
public/_research/latex/<project>/
```

Default retention: 12.
`OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100.
Durable manuscript source is never eligible for pruning.

---

## 6. Research citation and bibliography bridge

Implemented:

- project-scoped search over canonical `literature` and `evidence` notes;
- title/summary/author/year/DOI/URL/tag search;
- links back to note/PDF/external source;
- no invented bibliography metadata;
- incomplete source remains visible but non-insertable;
- evidence may inherit verified bibliography metadata from the strongest literature record for the same local PDF;
- `.bib` create/update using manuscript path/stale-write guards;
- deterministic citation keys;
- deduplication priority:
  1. DOI
  2. source URL
  3. local PDF
  4. title + year
- conservative `@misc` generation until canonical publication-type metadata exists;
- `\cite{key}` insertion at current editor cursor.

### Bibliography setup

Implemented source transforms for:

- classic BibTeX;
- existing bibliography styles;
- conservative missing-style repair;
- `biblatex` `\addbibresource`;
- `\printbibliography`;
- unsafe path rejection;
- cursor preservation.

---

## 7. LaTeX editor assistance

Dependency-independent fallback editor provides:

- `Ctrl/⌘ + Shift + P` command palette;
- `Ctrl/⌘ + /` comment toggle;
- bold/italic/emphasis wrappers;
- section/subsection insertion;
- equation/align/itemize/enumerate/figure/table snippets;
- section + label outline;
- navigation from outline/problems;
- environment mismatch/unclosed checks;
- brace checks;
- duplicate-label checks.

These diagnostics are advisory only. `latexmk` remains authoritative for build success/failure.

### CodeMirror status

CodeMirror has intentionally not been added yet because this environment cannot reach npm to produce and verify a matching `package-lock.json` update.

Do not add CodeMirror only to `package.json`: that would break `npm ci`.

When a networked checkout is available, add CodeMirror in one lockfile-safe change and keep the current textarea assistant as mobile/safe fallback.

---

## 8. Codex manuscript Ask/Draft

Implemented:

- manuscript-specific Codex surface in the IDE;
- Ask and Draft only;
- optional current unsaved TeX selection/source;
- latest compiler diagnostics;
- project/file context;
- explicit untrusted-source prompt boundaries;
- read-only Codex sandbox;
- copyable Draft output without automatic source insertion.

Existing Codex Act remains restricted to reviewed `progress/` changes.

Manuscript writing must eventually use a separate stale-safe review/apply architecture. Do not weaken the existing research-only Act path restriction.

---

## 9. Persistence and Docker

Durable mounts:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` is transient/rebuildable state.

Container toolchain includes `latexmk`, Biber, Ghostscript, TeX Live base/recommended/extra/science/pictures/fonts, XeTeX, and LuaTeX.

---

## 10. Tests present in code

### `tests/pdf-annotations.test.mjs`

Now covers:

- text creation and PDF SHA-bound anchors;
- stale revision rejection;
- metadata edits preserving source anchor;
- soft Hide/Restore;
- visual region creation without fabricated quotes;
- region promotion refusal without reviewed source text;
- reviewed caption → evidence promotion;
- separation of evidence quote from interpretation comment;
- source-text hash/provenance;
- PDF-byte replacement → stale anchor;
- refusal to promote stale anchors;
- explicit re-anchor → current anchor;
- anchor-history preservation;
- region re-anchor → source-text review invalidation;
- explicit source-text re-review;
- source-text history;
- v1 legacy-sidecar compatibility;
- refusal to promote legacy anchors before re-anchoring;
- text evidence promotion provenance/idempotency.

Other test files:

- `tests/latex-ide.test.mjs`
- `tests/latex-retention.test.mjs`
- `tests/latex-citations.test.mjs`
- `tests/latex-bibliography.test.mjs`
- `tests/latex-editor-tools.test.mjs`

The pure `latex-editor-tools` test file was run separately in an isolated Node context during an earlier checkpoint. That does **not** substitute for the repository quality gate.

---

## 11. Verification status

### Confirmed by repository inspection

- Branch was 105 commits ahead of `main`, 0 behind before this progress commit.
- Durable annotation/manuscript stores remain separate from Markdown research.
- Schema v2 is backward-readable from v1.
- New anchors bind to source PDF SHA-256.
- Stale state comes from document fingerprint mismatch, not UI geometry.
- Re-anchor preserves prior anchor history.
- Visual regions work without selectable text.
- Region source text is separate from comments.
- Region source-text verification is invalidated on re-anchor.
- New evidence promotion requires a current anchor.
- Visual evidence requires reviewed source text.
- Hide flows remain non-destructive.
- Citation metadata comes from canonical research records.
- Manuscript/BibTeX writes retain stale/path guards.
- Manuscript Codex Ask/Draft remains read-only.
- Existing research Codex Act restrictions remain intact.

### Not yet full-runtime verified

Do **not** claim these passed until executed from a real checkout/container:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run check
npm run check:full
```

Still requiring browser/toolchain verification:

- text annotation create/edit/Hide/Restore after reload/zoom;
- mouse + touch region drag;
- region overlay alignment after zoom/page/reload;
- real PDF replacement → stale state;
- real text and region re-anchor;
- reviewed caption/OCR/transcription UX;
- re-anchor source-text invalidation/re-review UX;
- v1 sidecar behavior against real existing data;
- text/region evidence promotion in browser;
- real BibTeX and `biblatex` compilation;
- citation browser insertion/dedup;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- compiler diagnostic navigation;
- forward/reverse SyncTeX;
- repeated-build retention;
- Codex manuscript Ask/Draft context;
- mobile/tablet IDE layouts;
- Compose recreation persistence.

---

## 12. Architecture rules to preserve

1. Markdown research remains canonical research knowledge.
2. PDF annotations remain structured sidecars rather than mutations burned into source PDFs.
3. Normal deletion remains reversible Hide/Restore.
4. Text and visual-region anchors are both valid source targets.
5. New anchors bind to the source PDF SHA-256.
6. Stale/legacy anchors are review states, not permission to guess/move them automatically.
7. Re-anchor is explicit and preserves old anchor history.
8. Annotation comments are interpretation, not source quotation.
9. Visual source text must use separate reviewed provenance (`caption` / `ocr` / `transcription`).
10. Re-anchoring visual geometry invalidates prior source-text verification until explicitly reviewed again.
11. New evidence promotion requires a current anchor.
12. Evidence promotion remains explicit, neutral, provenance-preserving, and idempotent.
13. Promoted evidence is a snapshot, not a mutable live mirror.
14. Manuscript source is durable; build output is transient.
15. SyncTeX is the source ↔ compiled-PDF positioning contract.
16. Compilation is execution; preserve path/process/time/security boundaries and disabled unrestricted shell escape.
17. Bibliography metadata is never invented.
18. `.bib` is normal stale-safe manuscript source, not a hidden citation database.
19. Editor-specific adapters remain replaceable.
20. Mobile/tablet remains first-class.
21. Existing research Codex Act restrictions must not be weakened for manuscript writing.

---

## 13. Next implementation targets

### A. Re-anchor candidate assistance

Build a non-destructive suggestion layer for stale text anchors:

- exact quote matching first;
- prefix/suffix context ranking;
- page-text fingerprint/index hints;
- candidate page/snippet/location;
- confidence score;
- explicit user selection/confirmation before `reanchor` is called.

Candidate search must never mutate annotation state automatically.

### B. Citation-token navigation

From a `\cite{key}` token in the editor:

- resolve key from visible project `.bib` files;
- map DOI/URL/PDF identity back to canonical literature/evidence;
- open the research note or source PDF directly.

### C. Manuscript Act/review architecture

Design a separate manuscript proposal/apply flow with:

- project-scoped manuscript snapshot;
- source hashes;
- visible diff;
- stale-source rejection;
- explicit approval/apply;
- no weakening of the existing research-only Act path guard.

### D. CodeMirror + optional TexLab

When npm/network access is available:

- update `package.json` + `package-lock.json` together;
- run the full quality gate;
- keep mobile textarea fallback;
- preserve current editor/citation/bibliography interfaces;
- later add optional TexLab/LSP diagnostics/completion/symbols.

### E. Runtime verification

As soon as a full checkout/browser/toolchain is available, prioritize integration verification and repair before merge.

---

## Resume instructions

1. Read root `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, and `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless already merged.
4. Compare with `main` before editing.
5. If a full runtime becomes available, run the quality gate before adding another large subsystem.
6. Otherwise continue with re-anchor candidate assistance, then citation-token navigation.

## Merge-ready definition

This branch is not merge-ready until:

- `npm run check` passes;
- `npm run check:full` passes;
- real text and region annotations survive reload/zoom/page changes;
- changed PDFs correctly surface stale anchors;
- text/region re-anchor is browser-confirmed and preserves history;
- visual source-text review/re-review is browser-confirmed;
- annotation promotion is browser-confirmed and duplicate-safe;
- manuscript stale-write + Hide/Restore is browser-confirmed;
- citation/BibTeX insertion/dedup is browser-confirmed;
- at least one real bibliography citation renders in compiled PDF;
- real `latexmk` and SyncTeX flows pass;
- build retention works after repeated real compiles;
- TeX absence degrades gracefully;
- Compose recreation preserves all durable roots;
- documentation/contracts remain aligned with implementation.
