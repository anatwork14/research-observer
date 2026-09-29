# Research Observer implementation progress

Last updated: 2026-09-28

## Active branch

```text
Repository: anatwork14/research-observer
Base branch: main
Base commit: f1ed442d4a9c914d02014df731fae4b0cb1ad472
Feature branch: feature/pdf-annotations-latex-ide
Branch state before this progress commit: 112 commits ahead of main, 0 behind
```

Observaire now connects PDF reading/annotation, PDF-revision-aware evidence provenance, visual figure/table regions, proposal-only re-anchor assistance, project-scoped LaTeX authoring/compilation, SyncTeX, research-aware citations/BibTeX, bibliography setup, LaTeX editor assistance, and read-only Codex manuscript Ask/Draft context.

The architecture continues to preserve the canonical Markdown research compiler, evidence writer, local PDF.js/React-PDF runtime, filesystem-first project model, and existing research-only Codex Act review boundary. No parallel research database has been introduced.

---

## PDF annotation system

### Durable sidecars

Implemented:

- configured project-scoped `annotationDir`;
- stable annotation IDs;
- optimistic revision checks;
- atomic writes behind a short-lived lock;
- soft Hide/Restore using `deletedAt`;
- metadata editing without destructive anchor movement;
- responsive annotation drawer.

### Annotation types

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

Visual-region types:

```text
area
figure
table
```

### Text anchors

Text annotations preserve:

- page;
- normalized rectangles;
- exact quote;
- prefix/suffix context;
- optional page-text SHA-256;
- optional page-text index;
- source PDF SHA-256;
- anchor timestamp/confidence metadata.

### Area / figure / table annotations

The PDF reader exposes **Select area** for mouse and touch region capture.

Regions work over:

- figures;
- tables;
- equations;
- charts/diagrams;
- scanned/image-only PDFs;
- arbitrary visual areas.

Geometry is normalized to the page and remains independent from current zoom/layout.

A visual region may intentionally contain no quote. User comments are never converted into fake source quotations.

---

## PDF revision integrity — schema v2

### Document fingerprints

New annotation anchors bind to the actual source PDF SHA-256.

Public anchor state:

```text
current
stale
legacy
```

- `current`: anchor matches the current PDF bytes.
- `stale`: PDF bytes changed after the anchor was saved.
- `legacy`: older sidecar has no source-document fingerprint.

The drawer surfaces stale/legacy counts and visually distinguishes those anchors.

### Backward compatibility

- Schema v2 reads schema-v1 sidecars.
- V1 anchors appear as `legacy` until explicitly re-anchored.
- Opening a PDF does not destructively rewrite old sidecars.

### Explicit re-anchor

Text annotations expose **Re-anchor text**.
Region annotations expose **Re-anchor area**.

Re-anchor:

- is explicitly user initiated;
- binds to current PDF SHA-256;
- preserves the old page/quote/rectangles/fingerprint in bounded `anchorHistory`;
- increments the sidecar revision;
- never silently moves historical geometry.

---

## Verified visual source text

Region annotations now store reviewed source text separately from comments.

Supported provenance kinds:

```text
caption
ocr
transcription
```

`sourceText` records:

- provenance kind;
- exact reviewed text;
- source-text SHA-256;
- verification timestamp;
- anchor PDF SHA-256;
- anchor page;
- review status.

`sourceTextHistory` preserves superseded/invalidated versions.

### Re-anchor safety

Moving a visual annotation:

- preserves previous source-text state in history;
- marks current source text `reviewRequired: true`;
- disables new evidence promotion;
- requires explicit review/save against the new visual region.

Raw OCR is not automatically trusted. It becomes reviewed source text only after explicit user confirmation.

---

## Annotation → durable evidence

Promotion remains explicit, neutral, provenance-preserving, and idempotent.

### Text annotations

New promotion requires:

- visible annotation;
- `current` anchor;
- real selected quote.

### Visual regions

New promotion requires:

- `current` region anchor;
- reviewed `sourceText`;
- `reviewRequired === false`.

The evidence quote is the reviewed caption/OCR/transcription—not the user comment.

Promotion provenance records include annotation ID, type, anchor kind, document SHA-256, tags, and for regions source-text kind/hash/verification timestamp.

Already-promoted evidence remains a historical snapshot; later annotation changes do not silently rewrite it.

---

## Proposal-only stale-anchor assistance

Implemented in this checkpoint.

### Pure matcher

Added:

```text
lib/research/pdf-reanchor-candidates.mjs
lib/research/pdf-reanchor-candidates.d.mts
tests/pdf-reanchor-candidates.test.mjs
```

Candidate ranking uses:

1. exact quote matches;
2. prefix/suffix context;
3. prior page hint;
4. prior page-text index hint;
5. conservative token/bigram fuzzy matching when exact text changed.

Returned candidates contain:

- page;
- text start/end offsets;
- matched text;
- surrounding snippet;
- `exact` / `fuzzy` match type;
- confidence;
- context score.

Candidate count and scanned page/text size are bounded.

### PDF reader UI

Added **Anchor suggestions** for stale/legacy text annotations.

On explicit **Find candidates**:

- current PDF text is extracted through the existing local PDF.js runtime;
- matching runs client-side;
- likely pages/snippets/confidence are displayed;
- **Open page** navigates to the candidate page.

Important safety boundary:

> Anchor suggestions are read-only proposals.

The suggestions component has no annotation mutation action. The user must inspect the source and then use the existing explicit **Re-anchor text** flow to choose actual source text.

This avoids silently accepting fuzzy matches.

---

## LaTeX IDE

### Source workspace

Implemented:

- `/ide?research=<project-id>`;
- project-scoped `manuscriptsDir`;
- `.tex`, `.bib`, `.sty`, `.cls`, `.bst` editing;
- `.observaire-ide.json` state;
- SHA-256 stale-save protection;
- non-destructive Hide/Restore;
- main file selection;
- pdfLaTeX / XeLaTeX / LuaLaTeX selection.

### Compilation / PDF preview

Implemented:

- `latexmk` orchestration;
- unrestricted shell escape disabled;
- bounded process/log handling;
- parsed diagnostics;
- local React-PDF/PDF.js preview;
- forward SyncTeX;
- reverse SyncTeX;
- project-boundary validation.

### Build retention

Generated build IDs are pruned from:

```text
.research-observer/latex-builds/<project>/
public/_research/latex/<project>/
```

Default retention is 12; `OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100.

Durable source is never pruned.

---

## Research citation / BibTeX bridge

Implemented:

- project-scoped literature/evidence search;
- title/summary/author/year/DOI/URL/tag search;
- note/PDF/source navigation;
- no fabricated metadata;
- explicit incomplete-metadata state;
- evidence → verified literature metadata inheritance for the same local PDF;
- `.bib` creation/update with stale guards;
- deterministic citation keys;
- deduplication by DOI → URL → local PDF → title/year;
- conservative `@misc` output;
- `\cite{key}` insertion at the editor cursor.

### Bibliography configuration

Implemented:

- classic BibTeX setup;
- custom style preservation;
- conservative missing-style repair;
- `biblatex` resource + print setup;
- unsafe path rejection;
- cursor preservation.

---

## LaTeX editor assistance

Dependency-independent fallback currently provides:

- `Ctrl/⌘ + Shift + P` command palette;
- `Ctrl/⌘ + /` comment toggle;
- formatting wrappers;
- section/environment snippets;
- section/label outline;
- source navigation;
- environment/braces/duplicate-label diagnostics.

Client diagnostics are advisory. `latexmk` remains authoritative.

### CodeMirror status

CodeMirror is deferred because this environment cannot access npm to create/verify the matching `package-lock.json` update.

Do not add editor packages only to `package.json`; that would break `npm ci`.

When a networked checkout exists, update package + lockfile together and retain the textarea/mobile fallback.

---

## Codex manuscript Ask/Draft

Implemented:

- manuscript-specific assistant;
- Ask and Draft only;
- active `.tex` file/project context;
- current unsaved source/selection;
- latest compiler diagnostics;
- explicit untrusted-source boundaries;
- read-only Codex sandbox;
- draft text is copyable but not automatically applied.

Existing Codex Act remains restricted to reviewed `progress/` changes.

A future manuscript Act must use a separate stale-safe review/apply architecture rather than weakening the research Act path guard.

---

## Persistence

Docker/Compose durable mounts:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains transient/rebuildable.

Container TeX stack includes `latexmk`, Biber, Ghostscript, TeX Live packages, XeTeX, and LuaTeX.

---

## Tests present

### PDF annotations

`tests/pdf-annotations.test.mjs` covers:

- text creation / SHA-bound anchors;
- stale revisions;
- non-destructive metadata edit;
- Hide/Restore;
- region creation without fake quote;
- region promotion refusal without reviewed source text;
- reviewed caption → evidence;
- source-text hash/provenance;
- PDF replacement → stale status;
- stale promotion refusal;
- region re-anchor + history;
- source-text re-review invalidation;
- explicit re-review;
- source-text history;
- v1 legacy compatibility;
- legacy promotion refusal;
- text evidence promotion/idempotency.

### Re-anchor candidate matcher

`tests/pdf-reanchor-candidates.test.mjs` covers:

- exact quote/context ranking;
- fuzzy changed-wording proposal;
- page/index tie hints;
- unrelated/too-short rejection;
- candidate result bounds.

### Other tests

- `tests/latex-ide.test.mjs`
- `tests/latex-retention.test.mjs`
- `tests/latex-citations.test.mjs`
- `tests/latex-bibliography.test.mjs`
- `tests/latex-editor-tools.test.mjs`

The pure editor-tools test set was previously exercised in an isolated Node run. This does not replace the full repository quality gate.

---

## Verification status

### Confirmed through repository inspection

- Branch was 112 commits ahead of `main`, 0 behind before this progress commit.
- Annotation/manuscript durable roots remain separate from Markdown research.
- Schema v2 remains backward-readable from v1.
- New anchors bind to source PDF SHA-256.
- Stale detection uses document fingerprint mismatch.
- Re-anchor preserves history.
- Visual region comments and verified source text are distinct.
- Region source-text review invalidates after anchor movement.
- New evidence promotion requires a current anchor.
- Visual evidence requires reviewed source text.
- Candidate matching is proposal-only and does not mutate annotations.
- Hide flows remain non-destructive.
- Citation metadata is canonical/research-derived.
- Manuscript/BibTeX writes retain path + stale-write guards.
- Manuscript Codex remains Ask/Draft read-only.
- Existing research Codex Act restrictions remain intact.

### Full runtime is still unverified

Do not claim these passed yet:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run check
npm run check:full
```

Browser/toolchain verification still needs:

- text annotations after reload/zoom;
- mouse + touch area drag;
- area overlay alignment after page/zoom/reload;
- real PDF replacement stale detection;
- real text/region re-anchor;
- visual source-text review/re-review;
- stale-anchor candidate extraction/ranking on real papers;
- v1 sidecars against real user data;
- browser evidence promotion;
- browser citation insertion/dedup;
- classic BibTeX + `biblatex` builds;
- pdfLaTeX/XeLaTeX/LuaLaTeX builds;
- diagnostic navigation;
- forward/reverse SyncTeX;
- build retention;
- Codex manuscript context;
- mobile/tablet IDE layouts;
- Compose recreation persistence.

---

## Architecture rules

1. Markdown research remains canonical research knowledge.
2. PDF annotations remain sidecars, not ordinary PDF mutations.
3. Hide/Restore is non-destructive.
4. Text and visual-region anchors are first-class.
5. New anchors bind to source PDF SHA-256.
6. Stale/legacy anchors are review states, not permission to auto-move them.
7. Re-anchor is explicit and history-preserving.
8. Comments are interpretation, not quotation.
9. Visual source text uses separate reviewed provenance.
10. Re-anchoring visual geometry invalidates source-text verification.
11. New evidence promotion requires current anchors.
12. Candidate matching is advisory only; it never applies an anchor.
13. Evidence promotion is explicit, neutral, provenance-preserving, idempotent.
14. Promoted evidence is a historical snapshot.
15. Manuscript source is durable; builds are transient.
16. SyncTeX is the source ↔ compiled-PDF navigation contract.
17. Compilation is execution and remains bounded/path-scoped with unrestricted shell escape disabled.
18. Bibliography metadata is never invented.
19. `.bib` is normal stale-safe manuscript source.
20. Editor adapters remain replaceable.
21. Tablet/mobile support is first-class.
22. Research Codex Act restrictions must not be weakened to add manuscript writing.

---

## Next implementation targets

### 1. Citation-token navigation

From a `\cite{key}` token in the editor:

- resolve the key in visible project `.bib` files;
- map DOI/URL/PDF identity to canonical literature/evidence;
- open source note/PDF directly;
- never infer an identity from an ambiguous key alone.

### 2. Manuscript Act/review architecture

Create a separate manuscript proposal/apply mechanism with:

- project-scoped snapshot;
- source hashes;
- visible diff;
- stale-source rejection;
- explicit human approval/apply;
- no reuse/weakening of the research-only Act path guard.

### 3. Rich editor / TexLab

When npm/network access is available:

- package + lockfile update together;
- CodeMirror adapter;
- keep touch/mobile textarea fallback;
- optional TexLab/LSP completion/symbols/diagnostics;
- compiler diagnostics remain authoritative.

### 4. Runtime verification

As soon as a real checkout/browser/toolchain is available, prioritize the full quality gate and integration fixes before merge.

---

## Resume instructions

1. Read root `AGENTS.md`, `app/AGENTS.md`, `annotations/AGENTS.md`, `manuscripts/AGENTS.md`.
2. Read `docs/PDF_ANNOTATIONS_AND_LATEX_IDE.md` and this file.
3. Continue on `feature/pdf-annotations-latex-ide` unless merged.
4. Compare with `main` before editing.
5. If a runnable checkout is available, run the quality gate before adding another large subsystem.
6. Otherwise continue with citation-token navigation, then manuscript Act/review architecture.

## Merge-ready definition

This branch is not merge-ready until:

- `npm run check` passes;
- `npm run check:full` passes;
- real text/region annotations survive reload/zoom/page changes;
- changed PDFs surface stale anchors correctly;
- text/region re-anchor is browser-confirmed with history;
- visual source-text review/re-review is browser-confirmed;
- anchor suggestions work on real papers without mutating state;
- evidence promotion is browser-confirmed and duplicate-safe;
- manuscript stale-save + Hide/Restore is browser-confirmed;
- citation/BibTeX insertion/dedup is browser-confirmed;
- real bibliography citation renders in compiled PDF;
- real `latexmk` + SyncTeX flows pass;
- build retention works after repeated compiles;
- missing TeX toolchain remains graceful;
- Compose recreation preserves durable roots;
- docs/contracts remain aligned with implementation.

---

## 2026-09-29 verification checkpoint — repository quality gate

Revision at inspection: `feature/pdf-annotations-latex-ide` at `0959cd4f3f8317123f5f620ee3a150227ebb88e6`, tracking the matching origin branch; 114 commits ahead of `main` at `f1ed442d4a9c914d02014df731fae4b0cb1ad472`, 0 behind. No source changes were present before this checkpoint. Work is in a separate worktree so unrelated Thesis checkout files are untouched. No merge to `main` was performed.

Environment and dependency installation:

- Node `v22.23.3`; npm `10.9.9` (package declares npm `10.9.2`).
- `npm ci` passed: 493 packages installed, 0 vulnerabilities. npm emitted the existing deprecation warning for `eslint@9.39.5`. The committed lockfile was not changed.
- npm/network access works in this checkout; the optional CodeMirror phase is therefore available for a later checkpoint, with the textarea fallback retained.

Initial failures and fixes:

- The first full `npm test` run had 2 failures in `tests/latex-citations.test.mjs`. The evidence fixture's YAML title contained an unquoted colon, so the compiler correctly rejected its frontmatter and citation promotion could not resolve the evidence. Quoted the fixture title; the three citation tests and the complete 102-test suite then passed.
- Initial typecheck failed because the annotations API supplied `{}` when create/re-anchor payloads were missing, although both library inputs require a positive page and rectangle list. The route now returns HTTP 400 for malformed create/re-anchor shapes before calling the typed mutation services.
- Initial ESLint reported 6 `react-hooks/set-state-in-effect` errors in citation, Codex, LaTeX editor/workbench, PDF annotation, and suggestion components. Moved open-time snapshot/context refreshes to UI events and made initial fetch effects consume async results without calling stateful loaders synchronously. No lint rules were suppressed.

Executed results:

- `npm run doctor`: PASS, 0 errors and 1 warning (`AGENTS.md` ignored because it is not an ordered research note).
- `npm test`: PASS, 102 tests, 0 failures.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors and 2 pre-existing unused-variable warnings (`app/api/codex/ask/route.ts`, `lib/research/latex-editor-tools.mjs`).
- `npm run check`: PASS.
- `npm run check:full`: PASS, including optimized Next.js build. Next reports 20 dynamic-filesystem-tracing warnings across existing and new runtime filesystem modules; these are warnings, not build failures, and still need deployment/runtime assessment.
- The build regenerated local `next-env.d.ts` and `tsconfig.json`; these generated edits are not part of the fix and must not be committed.

Still not verified at this checkpoint: browser interaction, real-PDF annotation/revision/re-anchor flows, evidence promotion in-browser, real TeX engines/latexmk/SyncTeX, citations in compiled PDF, responsive tablet/touch behavior, production smoke, and Docker recreation persistence. No claim of merge readiness is made.

Follow-up on 2026-09-29: the annotation route also rejects a non-object JSON body with HTTP 400, and its service inputs now use declared TypeScript parameter types instead of unchecked `never` casts. Citation insert failures no longer update a closed drawer. A repeated full test command initially hit the host's global SSH commit-signing configuration and stalled a fixture commit; rerunning once with `GIT_CONFIG_GLOBAL=/dev/null` passed all 102 tests, typecheck, and lint. This environment-only override was scoped to the check process and did not change repository or global configuration. Docker Compose configuration validation passed. An existing Compose stack from the original checkout is running and binds that checkout's folders, so it was left untouched; branch-isolated container persistence remains untested. Local tool discovery found pdfLaTeX, XeLaTeX, LuaLaTeX, BibTeX, Biber, and SyncTeX, but no `latexmk`; direct feature-path compilation is therefore blocked until an isolated latexmk environment is available.

## 2026-09-29 checkpoint — citation navigation, CodeMirror, and browser hardening

This update supersedes the earlier “Next implementation targets” status for citation-token navigation and the rich editor: both are now implemented on `feature/pdf-annotations-latex-ide`. Current source checkpoint before the commits below was `8a897c01d56c78efbe92f74efe7906271004ae16`, 115 commits ahead of `main` (`f1ed442d4a9c914d02014df731fae4b0cb1ad472`), 0 behind. The work remains in the isolated worktree. No merge to `main` was performed.

### Implemented and hardened

- Added reusable citation-token resolution for unsaved TeX snapshots, searching all visible project BibTeX files and resolving verified DOI, URL, local-PDF, or title/year identity to canonical literature/evidence objects. Ambiguous results offer choices; missing matches remain visible without a guessed destination. The endpoint is read-only.
- Added citation-token UI navigation to the canonical note or source PDF. Added tests for nested/multiple BibTeX files, unique PDF identity, ambiguity, missing keys, and unsaved source snapshots.
- Added CodeMirror 6 with LaTeX `stex` and BibTeX modes, line numbers, folding, and bracket matching. The shared editor adapter preserves citation insertion, editor helpers, Codex source snapshots, and SyncTeX cursor/navigation. The plain textarea remains available and is selected at narrow viewport widths.
- Made the React-PDF preview client-only after browser runtime exposed `document is not defined` during server rendering.
- Fixed annotation soft-delete default-root handling after the browser Hide action returned a 422 for an absent configured root. This source fix is pending its own commit.
- Updated the PDF/LaTeX architecture document and `app/AGENTS.md` to describe the shipped citation resolver/editor adapter contracts.

### Verification executed

- Node `v22.23.2` / npm `10.9.8`: `npm ci` passed (513 packages added, 514 audited, 0 vulnerabilities; existing ESLint deprecation notice).
- `npm run check:full` passed: doctor reported 0 errors and the existing ignored-`AGENTS.md` warning; all 103 tests passed; typecheck and lint passed; optimized production build passed. Lint retained 2 existing unused-variable warnings. Next emitted 20 dynamic-filesystem tracing warnings; deployment size/runtime implications remain unverified.
- `git diff --check` passed. Build-generated changes to `next-env.d.ts` and `tsconfig.json` were restored.
- Browser IDE smoke: CodeMirror loaded, source edits tracked/saved, command-palette helper targeted CodeMirror, and switching to the textarea preserved content. The citation panel showed a missing token gracefully. Token resolution edge cases were verified by unit tests; a real citation insert-and-compile flow was not verified.
- With a temporary synthetic two-page PDF only, browser checks covered text annotation create/edit/tag/reload, zoom anchoring, region creation, reviewed caption and promotion, PDF replacement/stale marking, explicit text and region re-anchor with history/re-review, and Hide/Show hidden/Restore after the root fix. Temporary PDF, notes, sidecars, and manuscript fixtures were removed. This does not verify behavior on real research PDFs, touch/tablet, resize/page-navigation alignment, or OCR/transcription.
- Compose configuration validation passed. The already-running Compose app was bound to the original checkout and was left untouched; isolated container recreation/persistence remains untested.
- Installed host tools include pdfLaTeX, XeLaTeX, LuaLaTeX, BibTeX, Biber, and SyncTeX. `latexmk` is absent, so IDE compilation, bibliography rendering, diagnostics, and actual forward/reverse SyncTeX remain unverified. Direct pdfLaTeX was used only to create the temporary browser fixture.

### Remaining verification and merge status

This branch is **not merge-ready**. Tablet/touch and narrow responsive layouts need browser verification; real-PDF annotation behavior, all three TeX engine paths, `latexmk`, BibTeX and Biber output, compiled citation navigation, SyncTeX, build retention, production runtime, and Compose recreation need isolated integration checks. Manuscript stale-save/Hide/Restore browser coverage also remains outstanding. The existing Codex Act boundary remains scoped to `progress/`.

## 2026-09-29 checkpoint — annotation Hide/Restore default root

Commit `9e6a9d6` contains the citation-navigation and CodeMirror implementation documented above. The separate `lib/research/pdf-annotations.mjs` fix now defaults the soft-delete/restore service root to the current working directory, matching the other annotation service entry points. This fixes the browser Hide/Restore request that previously failed with a 422 when no explicit root was passed.

Browser validation on the temporary synthetic PDF confirmed Hide, Show hidden, and Restore after this change, with the sidecar revision advancing and active/hidden counts updating. The temporary fixture was removed. The final `npm run check:full` run above included this one-line service fix and passed. Full real-PDF and Compose persistence coverage remains outstanding as described above. The feature branch remains unmerged from `main`.
