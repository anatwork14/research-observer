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

## 2026-09-29 checkpoint — verified manuscript Codex Act and stale-safe apply

Starting branch head after `git fetch origin` and `git pull --ff-only`: `0aa639680975894126ac8aff04cb928a0ceb35f3` on `feature/pdf-annotations-latex-ide`. The implementation fixes are in `676fa86cfc7454b5e2cf250a7163b0380a91e304` and `cc63a4cdb4e1b15dcf75ceeecba56aa4ae8d71f0`; the documentation/checkpoint commit follows those code commits. No merge to `main` was performed.

### Fixes in this checkpoint

- Matched the worktree TypeScript declarations to manuscript proposal metadata and diff results.
- Made live file-state checks reject symlinked repository roots and parent directories, and added a symlink regression test.
- Rechecked touched file hashes after `git apply --check` and immediately before applying a manuscript patch.
- Rejected malformed JSON bodies that are null, arrays, or non-objects on both manuscript Act routes.
- Excluded hidden sources from reviewable proposal and Apply paths, including proposals that try to recreate a hidden source.
- Changed the manuscript review drawer to a flex layout so proposal actions remain clickable when an error or long review is present.

### Commands and results

- `npm ci`: PASS, 513 packages added, 514 audited, 0 vulnerabilities; existing ESLint deprecation notice. No lockfile change.
- `npm run doctor`: PASS, 0 errors and the existing ignored-`AGENTS.md` warning.
- `npm test`: PASS, 108 tests, 0 failures.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors and 2 existing unused-variable warnings in `app/api/codex/ask/route.ts` and `lib/research/latex-editor-tools.mjs`.
- `npm run check`: PASS.
- `npm run check:full`: PASS, including the optimized production build. Next emitted dynamic-filesystem tracing warnings; no deployment-runtime claim is made from the build.
- `git diff --check`: PASS.
- Node `v22.23.2` was used. `GIT_CONFIG_GLOBAL=/dev/null` was scoped to test/check commands to avoid the host's global SSH signing configuration interfering with temporary fixture commits.

### Browser and API scenarios

- Authenticated local Codex was available at `/ide?research=default`; Ask, Draft, and Act were visible, with Act described as isolated diff → human review → explicit apply.
- Happy path: Act proposed a one-line `.tex` edit. The source stayed unchanged until Apply; the UI showed the touched path, summary, and exact patch. Apply returned 200, updated the source, refreshed the IDE baseline, and a subsequent normal editor save succeeded without an immediate stale-write error.
- Discard: clicked Discard on a second proposal. Proposal state was removed and source stayed unchanged. A drawer layout overlap found during this scenario was fixed; the action then worked through the UI.
- Unsaved protection: CodeMirror and plain textarea each retained unsaved content and Act returned HTTP 409 with the save-or-reload message; no proposal or disk write occurred.
- Stale conflict: generated a proposal against source A, externally wrote source B, and clicked Apply. Apply returned HTTP 409; source B remained byte-for-byte intact and the proposal was not merged automatically.
- New source file: Act proposed `sections/methods.tex`; the file appeared only after explicit Apply and contained the requested planned-content placeholder.
- BibTeX: Act proposed a four-space indentation change to an existing `.bib` title field. The reviewed patch preserved the entry key/value and introduced no author, year, DOI, URL, or other metadata; Apply succeeded.
- Empty source: with an empty project source folder, the manuscript Act API proposed a new `main.tex`; explicit Apply returned HTTP 200 and created it.
- Advisory diagnostics: a TeX fixture with unclosed `itemize`/document structure still produced a reviewable proposal, and the UI displayed the structural diagnostics as advisory. The proposal was discarded; the source remained unchanged.
- Hidden source: a request to modify a hidden `main.tex` returned HTTP 422 without a proposal or source change. The hidden-source policy is now also enforced at proposal and Apply validation boundaries; the source was restored to visible afterward.
- Combined adversarial request for README/app/package/config/AGENTS/sibling-project/IDE-state/resource changes and physical deletion returned HTTP 422 without a diff or durable changes. Automated path tests reject sibling/config/AGENTS/resource/traversal paths; automated diff tests mark physical deletion destructive and non-reviewable and invalidate outside-project changes. A direct runtime proposal containing each forbidden path was not produced because the authenticated agent refused the request.
- Existing research Codex path-policy test still accepts only `progress/`; the research `/api/codex/act` and `/api/codex/apply` routes were not widened or merged with the manuscript routes.

### Remaining verification gaps and merge status

- `latexmk` is unavailable in this environment. Real pdfLaTeX/XeLaTeX/LuaLaTeX build output, BibTeX/Biber rendering, and SyncTeX compilation flows remain unverified here; structural checks are advisory only.
- Production Codex service behavior, narrow/touch layouts, custom `manuscriptsDir`, post-apply rollback failure injection, and maximum-size/truncated patch handling were not exercised in the browser.
- The branch is not marked merge-ready: those verification gaps remain. This checkpoint does not merge to `main`.


## 2026-09-29 checkpoint — recovery snapshots, custom manuscript root, Docker verification

Repository: `https://github.com/anatwork14/research-observer.git`
Branch: `feature/pdf-annotations-latex-ide`
Starting remote SHA: `3b6f450641ba4b29a8cc0111675a2c450fec3926`
Final implementation SHA for this verification: `e1b0895` (`fix: retain manuscript recovery snapshots on failure`). The follow-up checkpoint commit changes only this log. No merge to `main` was performed.

### Recovery changes and checks

- Apply source order remains live hash checks → `git apply --check` → second live hash check → exact source snapshot → `git apply` → source validation. On validation failure the route first tries reverse patch, then exact snapshot restore if reverse patch fails.
- Snapshot creation now refuses to overwrite an existing snapshot. Apply success, discard, and reverse-patch rollback check snapshot cleanup and report cleanup errors; failed restoration reports manual recovery and leaves the snapshot available when restore is blocked by an unsafe parent.
- `npm test`: PASS, **115 tests**, 0 failures. Recovery cases cover exact bytes for existing files, removal of newly created and nested files, symlinked-parent rejection, retained snapshots, and no overwrite of retained recovery state.
- The HTTP scenario “validation failure → reverse patch failure → snapshot restore” remains integration-unverified. The route has no safe injection seam, and no production failure switch was added; helper restoration/retention behavior is covered independently.

### Repository checks

Executed with Node `v22.23.2` / npm `10.9.8`; test commands used `GIT_CONFIG_GLOBAL=/dev/null` to avoid the host global SSH-signing fixture hang.

- `npm ci`: PASS, 513 packages added, 514 audited, 0 vulnerabilities.
- `npm run doctor`: PASS, 0 errors and the existing ignored `AGENTS.md` warning.
- `npm test`: PASS, 115 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors and 2 existing unused-variable warnings (`app/api/codex/ask/route.ts`, `lib/research/latex-editor-tools.mjs`).
- `npm run check`: PASS.
- `npm run check:full`: PASS, including optimized production build. Next emitted the existing dynamic-filesystem tracing warnings; build passed.
- `git diff --check`: PASS.

### Custom `manuscriptsDir`

Temporarily set `manuscriptsDir` to `workspace/authored-manuscripts` and restored `research-observer.config.json` byte-for-byte afterward (restored SHA-256: `ac3ce64d3bb94b24396f0a9705a8d2712b8bf43118f9b5024c21f7438041f7d0`). The custom root was absent before the fixture and removed afterward. Default `manuscripts/default/main.tex` was confirmed absent.

- Actual `/api/ide/files` create, save, Hide, Restore, Act proposal, and Apply flows passed under `workspace/authored-manuscripts/default/`.
- An Act edit proposal and a second Act-created `chapters/act-created.tex` proposal both returned HTTP 200 and applied under the custom root. No proposal fell back to `manuscripts/`.
- Traversal paths and resource-file creation were rejected. Automated path-policy tests cover sibling-project scope and disallowed binary/resource paths. The only configured research project in this isolated run was `default`.

### LaTeX, shell escape, Docker preflight, and persistence

- Host `npm run verify:latex`: expected exit 1 with the clear message `latexmk is unavailable. Run this command inside the project Docker image or install latexmk.` No host packages were installed.
- Host shell inspection confirms generated latexmk args retain `-interaction=nonstopmode -file-line-error -synctex=1 -halt-on-error -no-shell-escape`.
- Host has TeX Live 2026 pdfTeX, XeTeX, LuaHBTeX, BibTeX, Biber 2.22, and SyncTeX CLI available; this is not a compile or round-trip result.
- `npm run observaire:prepare` passed using only temporary `/tmp` research, annotations, and manuscript directories.
- `npm run observaire:prepare-volume` created `observaire-profile-verification`; the second run passed idempotently. `docker volume inspect` confirmed the disposable volume. `docker compose config` resolved the temporary host mounts and that exact state volume. The normal `observaire-profile` volume was only inspected and not used or deleted.
- `docker compose build observaire` was attempted twice under isolated project `observaire-verification-20260929`. Both attempts stalled in the Docker apt install at the Debian bookworm arm64 package index (`8,689 kB`) without layer completion or further output and were canceled. Thus no current-branch image was produced.
- Docker `npm run verify:latex`, engine versions/results inside the image, BibTeX/Biber rendered output, SyncTeX forward/reverse, and isolated Compose recreation persistence were **NOT TESTED** because the current image build did not complete. No claim is made for PDF citation rendering or bibliography warning-free output.
- Tablet, portrait, and narrow-touch UI smoke was not run in this pass.

### Merge readiness

**Not merge-ready.** Unit/full repository checks and custom-root HTTP flows pass, but real Docker LaTeX verification, actual bibliography rendering, SyncTeX round-trip, Compose recreation persistence, and route-level rollback fallback remain unverified. Disposable host directories and the isolated state volume are cleaned after this checkpoint. The feature branch remains unmerged from `main`.


## 2026-09-29 checkpoint — PDF annotations and LaTeX IDE verification

Repository: `https://github.com/anatwork14/research-observer.git`
Branch: `feature/pdf-annotations-latex-ide`
Starting SHA: `82c1f1cb3470a8a8e862e77134c73a94967c6da9`
Implementation commit: `7875dd6` (`fix: verify latex bibliography sync and persistence`). A documentation-only checkpoint commit follows. Nothing was merged to `main`.

### Fixes committed

- Added the missing Debian TeX Live package for `biblatex` to the app image.
- Reverse SyncTeX now maps generated `.bbl` paths inside the current build directory to the main TeX bibliography directive. Paths outside the manuscript project remain rejected. Unit coverage exercises both absolute and relative `.bbl` paths.
- Strengthened the TeX verifiers to inspect actual BibTeX/Biber `.bbl` and PDF text output, unresolved reference logs, and validated SyncTeX parser output.
- Compose persistence verification now compares SHA-256 bytes for research, annotation, and manuscript bind mounts before and after recreation.
- Auxiliary IDE launchers now sit above active drawers; at narrow widths they sit in the clear strip above the bottom sheet. This fixes the observed case where a drawer covered the controls for switching to another auxiliary panel.

### Local and TeX verification

Node `v22.23.2` / npm `10.9.8` were used. Git fixture operations used `GIT_CONFIG_GLOBAL=/dev/null` to avoid the host SSH signing configuration. The latest `npm run verify:merge-local` passed, including `check:full` and the workflow checks. Its unit suite reported 125 passed, 0 failed; the workflow suite reported 2 passed, 0 failed. `git diff --check` passed.

The latest `npm run verify:merge-full` completed the local gate and these external stages successfully:

- `verify:latex:container`: PASS on the digest-pinned TeX Live image. pdfLaTeX, XeLaTeX, LuaLaTeX, BibTeX, and Biber fixtures passed; bibliography text appeared in generated PDFs; forward and reverse SyncTeX mapped `main.tex:5` on page 1.
- `verify:latex:project-toolchain`: PASS.
- `verify:latex:project-app`: PASS. The app image compiled with all three engines, BibTeX, and Biber, then completed a forward/reverse SyncTeX round trip to `main.tex:5`.
- `verify:persistence`: did not pass. After the disposable Compose service started and all three bind-mount hash checks ran, writing the state-volume marker failed with `printf: I/O error`. Docker's VM had previously reported no free space; no unrelated images, containers, or volumes were removed. The full gate therefore exited 1 at persistence.

### Browser checks

- The real-PDF reader regression passed in the earlier browser run: PDF.js rendered the real paper, text/search and page navigation worked, an annotation survived reload with source hashes and `verifiedAt`, promotion created durable evidence, and the citation drawer found and linked the literature PDF.
- Citation insertion/navigation and normal forward/reverse SyncTeX worked in the real manuscript browser flow. The newly fixed reverse bibliography `.bbl` case was regression-tested in unit tests, but its actual browser click was not repeated after the fix because the updated browser image could not be rebuilt while Docker reported a full VM.
- IDE auxiliary drawer switching was exercised in Chromium at 1024×768, 768×1024, and 390×844. Editor, Codex, Citations, and Ctrl/Cmd+Shift+P switching worked; launchers were hit-testable outside the open sheet's content area. These are responsive viewport checks, not physical iPad/Safari runs.
- At 390×844, the browser reported `documentElement.scrollWidth` of 398px. Launcher switching still worked, but this 8px document overflow needs investigation before claiming the narrow layout is fully clean. A final rescan was blocked because the host filesystem had 375 MiB available and Next failed to write `.next/dev/package.json` with `ENOSPC`.
- The manuscript Codex service was disabled in this browser (`RESEARCH_OBSERVER_CODEX=0`); the drawer and modes were visible, but live Codex responses were not tested in this browser session.

### Merge status

**Not merge-ready.** The browser drawer-layering defect is fixed and required local/TeX checks passed, but the final `verify:merge-full` did not pass because Compose persistence could not write its marker in the full Docker VM. The real-browser bibliography reverse-click retest and narrow-layout overflow investigation also remain outstanding. The branch is pushed without merging to `main`.

## 2026-09-29 final verification checkpoint — mobile layout and generated bibliography SyncTeX

Repository: `https://github.com/anatwork14/research-observer.git`

Branch: `feature/pdf-annotations-latex-ide`

Starting SHA: `4a50ecb4fc2a450a72c73b2b64f96b1da6980598`
Verified source commit: `5afe9d233cb38daafaa9773a88c3ebaddf9197be` (`fix: prevent mobile IDE statusbar overflow`). A follow-on checkpoint commit updates this file. Nothing was merged to `main`.

### Defect found and fixed

At 390×844, the IDE statusbar's toolchain labels retained their intrinsic width after the status row shrank, producing `scrollWidth: 397` while `clientWidth: 390`. The mobile statusbar now wraps. A regression assertion was added to `tests/latex-mobile-layout.test.mjs`; the post-fix browser measurement is `390/390`.

Next.js 16's development server also inserted its generated agent-rules block into `AGENTS.md`; that generated block is included with the source fix so `next dev` does not leave it as an uncommitted change.

### Storage and cleanup

- Host free space: 28 GiB before cleanup; 40 GiB after the full verification run.
- Docker before cleanup: 45.46 GB of images (40.69 GB reported reclaimable), 5.198 GB builder cache, 4.921 GB volumes. The disposable persistence container reported its overlay filesystem at 100% with 0 bytes available, confirming the earlier state-volume `printf: I/O error` was Docker VM storage exhaustion.
- Cleanup: pruned 5.198 GB of unused build cache and dangling unused images (17.73 GB actual reclaimed). The digest-pinned TeX image was pulled again for verification. Docker Desktop was restarted to restore the VM. No containers or volumes were deleted; `observaire-profile` remains present. Temporary verifier volumes were removed by the verifier.
- After verification: Docker images 32.09 GB, build cache 3.089 GB, volumes 4.921 GB; Docker VM overlay had 15 GB available. No `observaire-profile-verification-*` volumes or `observaire-persistence-*` containers remain. The pre-existing `teobun-db-1` and `teobun-litellm-1` containers are exited after the Docker Desktop restart and were left untouched.
- Temporary browser manuscript files and state, copied PDF/note, test annotation sidecar, and generated `.bbl`/PDF/SyncTeX artifacts were removed.

### Local and container gates

- Node `v22.23.2`, npm `10.9.8`, Docker `28.0.1`, Compose `v2.33.1-desktop.1`; `npm ci` passed with 0 vulnerabilities.
- `npm run verify:merge-local`: PASS; `check:full` and workflow suite passed. Unit tests: 128 passed, 0 failed; workflow tests: 2 passed, 0 failed. `git diff --check`: PASS.
- Standalone `npm run verify:persistence`: PASS. Disposable state-volume write/fsync/readback, research/annotation/manuscript bind-mount hashes, recreation, and state-marker survival all passed.
- `npm run verify:latex:container`: PASS on the digest-pinned Linux/amd64 TeX Live image. pdfLaTeX, XeLaTeX, LuaLaTeX, BibTeX, Biber, shell-escape restriction, and SyncTeX checks passed.
- `npm run verify:latex:project-toolchain`: PASS.
- `npm run verify:latex:project-app`: PASS; app image compilation and service-level checks completed.
- Final `npm run verify:merge-full`: PASS through all stages, including persistence.

### Browser verification

- Chromium responsive emulation at 390×844: closed IDE, Editor open, Codex open, and Citations open each measured `scrollWidth/clientWidth = 390/390`.
- At 1024×768 and 768×1024: document overflow was `1024/1024` and `768/768`. Files and Preview controls and Editor/Codex/Citations launchers were visible within the viewport. Codex Apply and Discard were available in the review UI; a tablet-sized Discard completed without changing source. These are Chromium viewport checks, not physical iPad hardware.
- A real local SemTrust FCL method-figure PDF was copied temporarily into the worktree. PDF.js rendered it at 390×844. The annotation drawer, `Select area` figure/table controls, and a stale-anchor suggestion drawer each measured `390/390`; candidate search found an exact 94% match. The copied PDF, note, and annotation sidecar were removed afterward.
- A temporary `main.tex`/`references.bib` manuscript compiled with BibTeX in the verified project TeX toolchain and produced `main.bbl`, `main.pdf`, and SyncTeX output. In the browser, double-clicking the rendered bibliography entry returned the editor to `main.tex` line 14, the `\bibliography{references}` directive; the generated `.bbl` remained under the temporary build directory and was removed afterward.
- The authenticated live Codex backend passed Ask and Draft with `main.tex` context; the source SHA-256 remained unchanged. Act displayed the exact proposed diff without modifying the source, Apply made only the requested test-sentence edit, and a second proposal was discarded with the source SHA-256 unchanged.
- One development-only Turbopack internal error appeared in the server log while temporary fixtures were being removed; surrounding requests returned HTTP 200 and the production build/full gate passed. No application or data-integrity failure was observed from it.

### Merge decision

**Merge-ready: yes.** The local and full merge gates, isolated persistence verification, all three TeX engines, BibTeX/Biber, forward/reverse SyncTeX, 390 px layouts, both tablet viewport orientations, generated-`.bbl` browser click, live Codex Ask/Draft/Act Apply/Discard, and the real-PDF narrow regression passed. Remaining warnings are the non-reproduced development-only Turbopack message, existing lint/build warnings, and the two user containers left exited after Docker Desktop restarted. Branch remains unmerged from `main`.

## 2026-09-29 runtime verification checkpoint — research graph and timeline

Repository: `https://github.com/anatwork14/research-observer.git`

Branch: `feature/research-graph-timeline`

Starting SHA: `004592239e881c8bca79c5917e9b10cee9db4247` (clean; 0 behind `origin/main`). Implementation SHA before this documentation checkpoint: `9cc89dc12bb8b7c3aa5ec05c68b9de1957448387`. The documentation checkpoint is committed separately. Nothing was merged to `main`.

### Fixes committed

- `86a8176` — `fix: type research evolution projections`; replaced unsafe declaration types with concrete projection types.
- `06c31be` — `fix: mark absent manuscript layers unavailable`; a project without manuscripts no longer reports a zero citation scan or zero Git history as available.
- `13e15d3` — `fix: stabilize research graph hydration layout`; deterministic layout coordinates now avoid server/client hydration drift.
- `9cc89dc` — `fix: select graph nodes with Enter`; Enter and Space select focused graph nodes while double-click opens them; the accessible label reflects the behavior.

### Automated verification

- Node `v22.23.2`, npm `10.9.8`; `npm ci` passed (0 vulnerabilities).
- All eight focused evolution test files passed, 23 tests total. Additional graph/layout/evolution focused checks passed, 14 tests total.
- Final `npm run verify:merge-local` passed after this checkpoint was written, including 151 unit tests, typecheck, lint, production build, and workflow acceptance (2/2). `git diff --check` passed. Next.js generated edits to `next-env.d.ts` and `tsconfig.json` were restored because they were not part of the fix.
- Lint had 0 errors and 2 pre-existing warnings (`app/api/codex/ask/route.ts:63`, `lib/research/latex-editor-tools.mjs:30`). The production build emitted existing Turbopack dynamic filesystem tracing warnings.
- `npm run check:full` was not run.

### Runtime and browser verification

- Research graph loaded in browser; drag, pin/unpin, pan, toolbar zoom, local neighborhood, typed/reference filters, relation query, and project switching worked. The research view issued project-list requests but did not perform manuscript citation or Git-history scans. Header showed typed/reference/node counts without false citation/revision zeros.
- Keyboard Enter and Space selected graph nodes and updated the inspector without navigating. The direct inspector/trace distinction, citation-layer trace boundary, visible citation restore, full local PDF chain, and version comparison were exercised.
- Disposable Alpha/Beta projects with the same `papers/source.pdf` path remained distinct. Synthetic local PDF provenance traversed Paper → Annotation → Evidence → Citation → Manuscript → Revision. These are disposable software fixtures, not research claims.
- A unique citation resolved; ambiguous and missing keys remained visible in health with no guessed research edge. Consensus was not run: there was no verified saved Consensus evidence in the fixture and no provider credential was available.
- Hiding a TeX source removed its live citation occurrences while the source hash remained unchanged; Restore brought the occurrences back. Committed edits, bibliography update, a path containing spaces, and rename were represented in history. A dirty `paper draft.tex` was reported as working changes rather than a revision. No-HEAD behavior passed its focused service regression test.
- Timeline Research, Runs, and Manuscript filters each removed their corresponding events. Date-only `2026-09-01` remained Sep 01 in the available browser timezone; west-of-UTC timezone emulation was unavailable. Explicit `supersedes` topology ordered v1 → v2 → v3 despite misleading dates; a cycle was visibly detected. Version compare displayed titles, status/date where available, word delta, heading and bounded line changes, canonical links, and truncation context.
- Large disposable projection contained 203 matching/connected nodes; the UI reported 181 shown and the implementation keeps a 90-node-per-lane budget. Search and per-lane bounded rendering were available. Selected-trace displacement/priority in an over-budget lane was not verified to completion because the large dev-browser render stalled during the final interaction. No claim is made that trace priority passed in the browser.
- Responsive browser checks at 390×844, 768×1024, 1024×768, and 1280px desktop showed document `scrollWidth === clientWidth` in all three graph views. A separate west timezone context and physical tablet hardware were not available. Clear-selection button was not independently exercised.
- After the layout fix, a fresh browser tab showed no new console errors or hydration warnings. Research view transition requests were ~0.16–0.87 s in the local dev server; provenance/timeline requests were ~0.67–2.9 s on the large synthetic fixture. This is local fixture timing, not production performance evidence.
- Optional manuscript layers were absent in Alpha Study: Research graph remained available and UI reported citation scan and Git history unavailable rather than zero. No server crash occurred.

### Merge status

**Not merge-ready.** Selected-trace priority under the >90-node visual budget, west-of-UTC browser date emulation, provider-backed Consensus provenance, and a dedicated clear-selection browser action remain unverified. `check:full` was not run. The feature branch is to be pushed without merging to `main`.

## 2026-09-30 verification checkpoint — manuscript Passage provenance and IDE navigation

Repository: `https://github.com/anatwork14/research-observer.git`

Branch: `feature/research-graph-timeline`

Starting SHA: `cb674d47a205f4051382ce378092c039e0fe65f8` (clean and aligned with the feature remote). Final implementation SHA: `c072c99efb2dc16ded395eb2d6efaec554836b6a`. The follow-on documentation checkpoint is committed separately. Nothing was merged to `main`.

### Defect fixed

- `c072c99` — `fix: key unresolved citations by occurrence`. The Provenance health list used file/key/status as its React key, which collided when the same unresolved key appeared more than once. Unresolved citation projections now retain the citation's source offset, and the UI key includes that occurrence identity. A disposable fixture reproduced the warning before the change; refreshing after the fix produced no new duplicate-key warning.

### Local gates

- Node `v22.23.2`, npm `10.9.8`; `npm ci` passed with 0 vulnerabilities.
- The 11 evolution-focused test files passed: 33 tests, 0 failures. The three new focused files passed 10 tests total (4 passage extraction, 3 citation projection, 3 IDE navigation).
- `npm run verify:merge-local`: PASS. Its `check:full` passed with 161 unit tests, typecheck, lint, and production build; the workflow suite passed 2/2.
- Standalone `npm run check:full`: PASS, including 161/161 unit tests, typecheck, lint, and production build. `git diff --check`: PASS.
- Lint: 0 errors, 2 warnings (`app/api/codex/ask/route.ts:63` and `lib/research/latex-editor-tools.mjs:30`). Build: compiled successfully; Turbopack reported 22 dynamic-filesystem tracing warnings. Doctor reported its existing ignored-`AGENTS.md` note warning. `npm ci` also printed the pinned ESLint deprecation notice.
- Build-generated changes to `next-env.d.ts` and `tsconfig.json` were restored; they are not part of the implementation.

### Passage and provenance checks

- A disposable saved-source fixture produced an Introduction passage at line 4 and an Evaluation passage at line 8. The preceding section command was omitted from the first excerpt, the comment-only heading was ignored, and the next paragraph was excluded. A paragraph containing three citation tokens produced three Citation nodes, one shared Passage node, and one Passage-to-Manuscript membership edge.
- The Provenance health panel reported citation scan availability, passages, resolved, ambiguous, missing, committed revisions, and working changes. The header included its Passage count. The Passage inspector showed file, section level/title, line, and the bounded literal excerpt.
- A uniquely resolved citation created its source-to-Citation edge. Ambiguous and missing citations retained their literal Passage location without a guessed research edge. No relationship was inferred from surrounding prose.
- The focused trace test passed the complete Paper → Annotation → Evidence → Citation → Passage → Manuscript → Revision chain: 7 nodes and 6 edges at depth six; depth five did not reach Revision.
- Search surfaced the Evaluation Passage by heading and a synthetic Passage by excerpt text. Filename-only search was not separately exercised.
- A saved-source edit expanded the fixture from 3 to 103 passages. Reloaded provenance showed the new paragraph at line 208 and returned it in search, demonstrating that Passage lines and excerpts are rebuilt from saved source.
- Large fixture result: 107 citations and 103 passages; the UI rendered 90/107 Citation nodes and 90/103 Passage nodes, with 190 of 220 matching/connected nodes shown. Search surfaced paragraph 100 outside the initial node set. Selected-trace priority under an over-budget lane was not independently verified.

### IDE and browser checks

- Cold Passage-to-IDE navigation opened `/ide?research=passage-qa&file=main.tex&line=4`; CodeMirror focused line 4. The plain editor opened Project B's same-named `main.tex` at line 4 and showed Project B source, not Project A source.
- Invalid inputs `../outside.tex`, `../../package.json`, `missing.tex`, and `image.png` all fell back to `main.tex`. Hiding `hidden.tex` in the UI made a manual deep link fall back to `main.tex`; the hidden file SHA-256 stayed `e0d7067e79c88809deb6b64bba09dfda1267dd596c8bdec07a25f929e643d31c`. The file was restored afterward.
- At 390×844, 768×1024, 1024×768, and 1280×800, the document had no horizontal overflow. At 390×844, the selected Passage excerpt fit its 308 px inspector width without overflow.
- The canonical Research Graph loaded without a Passage lane and had no document overflow. Drag, pin, pan, zoom, and graph-filter interactions were not re-exercised in this pass.
- Browser console captured the duplicate-key warning before the fix; hot refresh after the change produced no new duplicate-key warning. Source loading, citation reference rendering, and forward Passage-to-IDE navigation worked. Citation insertion and an actual forward/reverse SyncTeX round trip were not run. Unsaved-editor isolation was not completed because the large fixture editor did not yield a textarea within the browser action timeout. Provider-backed Codex behavior was disabled in the disposable browser.

### Remaining boundary

**Merge-ready: no for this verification pass.** Local quality gates pass and the feature-only checkpoint is ready to review. Unsaved-source isolation, selected-trace priority under the large-graph budget, full Research Graph interactions, citation insertion, and actual browser SyncTeX remain unverified. These limits do not change the saved-source-only implementation contract. The feature branch remains unmerged from `main`.

## 2026-09-30 verification checkpoint — explicit manuscript Claim anchors

Repository: `https://github.com/anatwork14/research-observer`

Branch: `feature/research-graph-timeline` (no merge to `main`).

Starting SHA: `74b0c6018b5710b79eac9d172117d9a159f4e59b` (clean). Final verified implementation SHA: `08b46be109d964539e6100ab8b9515892a294617`. The documentation-only checkpoint commit follows the implementation commit. `origin/main...HEAD` before these commits was `0 118`; the branch was `31` commits ahead of the prior checkpoint `c5de5f3df46714f3a480cf9c8fdd9c634e8e8543`.

### Fix

- `08b46be` — `Fix orphan manuscript claim detection`. Claim passage lookup now skips standalone LaTeX structural commands (document/environment boundaries and common title, contents, page-break, and bibliography commands) after an anchor. If no substantive passage follows, the anchor remains an orphan issue instead of becoming a Claim attached to a structural command.
- Added a regression covering comment/heading/environment/document structure between an anchor and prose, plus an anchor immediately before `\end{document}`. No Claim↔Evidence semantic relationships were added.

### Automated gates

- Node `v22.23.3`, npm `10.9.9`; `npm ci` passed earlier in this pass on Node 22 (513 packages, 0 vulnerabilities; ESLint deprecation notice only).
- Claim-focused suites: 26/26 passed across six requested files. Passage/provenance suites: 14/14 passed across five requested files. Combined: 40/40.
- `GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local`: PASS after the fix; 181/181 unit tests, typecheck, lint, production build, and 2/2 workflow tests.
- Standalone `GIT_CONFIG_GLOBAL=/dev/null npm run check:full`: PASS after the fix; 181/181 unit tests, typecheck, lint, and production build.
- `git diff --check`: PASS. TypeScript generated edits in `next-env.d.ts` and `tsconfig.json` were restored after builds.
- Lint: 0 errors, 2 existing warnings (`app/api/codex/ask/route.ts:63` and `lib/research/latex-editor-tools.mjs:32`). Each production build succeeded and emitted 22 existing Turbopack dynamic-filesystem tracing warnings. Doctor reports the existing ignored `AGENTS.md` note warning.

### Browser and runtime evidence

- CodeMirror command inserted `% observaire:claim claim-id` above the active line, selected only `claim-id`, left the editor dirty/unsaved, and surfaced the placeholder advisory. Replacing it with `robust-under-shift` cleared that issue. Plain textarea command showed the same insertion/selection/dirty behavior. The comment was absent from compiled PDF text.
- Saved valid unique Claim `primary-generalization-result` appeared after reloading Provenance. Inspector showed file, marker line, prose line, section, and literal excerpt. After moving and saving the same Claim, its identity stayed stable and its anchor/prose lines rebuilt to 14/15. Opening Claim and Passage locations targeted marker and prose lines respectively in CodeMirror and plain editor.
- A saved `claim-id` placeholder, uppercase/underscore/space IDs, duplicate same-file IDs, duplicate cross-file IDs, and orphan anchors appeared as invalid/duplicate/orphan health diagnostics; invalid, duplicate, and orphan occurrences did not create Claim nodes. Same-file and cross-file duplicate locations were both reported. The structure-only orphan case discovered during browser testing was fixed and its regression passed.
- Heading/comment gaps resolved the following prose and `Evaluation` section. Two stacked IDs shared one Passage. An uncited Claim remained visible without a fabricated Research/Evidence edge. A Claim passage with an unresolved `missingKey` retained Citation→Passage→Claim context without a guessed research edge; one Passage identity was shared by citation and Claim projection in automated tests.
- Automated trace coverage verifies the seven-hop Claim-aware structural path capability; the full eight-node/seven-edge Paper→Annotation→Evidence→Citation→Passage→Claim→Manuscript→Revision trace was not assembled in one browser fixture. Claim-layer disable/re-enable and the absence of inferred Claim semantic edges were verified in browser/projection tests.
- Health listed Claim totals/issues with file, line, and issue kinds alongside citation and revision state. Search surfaced by Claim ID, filename, heading, and excerpt. The 111-valid-Claim fixture initially rendered 90 in the Claim lane; searching for `qa-bulk-105` surfaced an item beyond the initial set. Selected trace prioritization under the cap and bounded page-height behavior were not fully verified together.
- Claim scans were present in Provenance only; Research Graph displayed its ordinary typed/reference/node summary and Timeline did not include Claim nodes. Hiding the synthetic TeX file removed its Claims while its SHA-256 stayed identical; restoring it returned the file. Two projects containing the same Claim ID remained separately scoped through project URLs and IDE deep links.
- Unsaved-vs-saved isolation passed: a separate Provenance tab did not show editor-only unsaved Claim text; after save/reload the Claim appeared. Filename-only Provenance search surfaced the file's nodes.
- CSS viewports 390×844, 768×1024, 1024×768, and 1280×800 each had document `scrollWidth <= clientWidth`; wide graph content scrolled inside its own graph scroller. The selected mobile Claim inspector fit its width and wrapped metadata/excerpt.
- Research Graph drag, pin/unpin, pan, and zoom worked with the one-node canonical fixture. Local neighborhood, relation query, semantic/reference filter effects, and project switching were not meaningfully exercised because the fixture had no typed relationships and only the default research project.
- No verified scholarly candidate was available for a browser citation insertion/save/reload check; no source was fabricated. Actual Docker LaTeX build passed. Browser SyncTeX forward editor→PDF and reverse PDF→editor to `main.tex:14` succeeded. Browser console inspection in the isolated Chrome session returned no warnings/errors. The disabled Codex endpoint returned an expected 503 during QA; this is not evidence for Codex-provider behavior.

### 52-point report status

The attached 52-point report is recorded as follows: 1 starting branch/SHA confirmed; 2 contracts read; 3 dependency install/runtime passed; 4 focused suites 26+14 passed; 5 merge-local/check:full/diff gates passed; 6 compile-safe syntax passed; 7 CodeMirror command passed; 8 plain editor transform and responsive widths passed; 9 placeholder diagnostic passed; 10 valid Claim passed; 11 Claim/Passage deep links passed in both editor modes; 12 uncited Claim passed; 13 convergence passed at projection/test level; 14 unresolved citation behavior passed; 15 same-file duplicate passed; 16 cross-file duplicate passed; 17 invalid/valid ID rules passed; 18 orphan detection passed after fix; 19 heading/comment gap passed; 20 stacked Claim projection passed; 21 full trace verified by automated trace coverage, not assembled in the browser; 22 Claim layer toggle passed; 23 no inferred semantic Claim edges passed; 24 health panel passed; 25 search and initial 90-node bound passed; 26 Provenance-only Claim scan passed; 27 hide/restore passed with identical source hash; 28 project URL/data isolation passed; 29 saved-vs-unsaved passed; 30 freshness passed; 31 filename search passed; 32 >100 Claim rendering/search passed, selected-trace priority not fully verified; 33 all four viewport overflow checks passed; 34 drag/pin/pan/zoom passed, local neighborhood/filter/query/project-switch behaviors incomplete; 35 citation insertion not verified; 36 actual compile and SyncTeX forward/reverse passed; 37 isolated browser console clear; 38 structural orphan defect fixed; 39 no Claim↔Evidence semantics added; 40 this checkpoint appended; 41–48 are enumerated in the final report; 49 remaining warnings/gaps are documented; 50 merge-ready: no; 51 this file updated; 52 nothing merged to `main`.

### Remaining boundary

**Merge-ready: no for this verification pass.** The local gates pass and the narrow parser defect is fixed. Browser citation insertion, a single live eight-node/seven-edge trace, selected-trace priority at the 90-node cap, and Research Graph relation/filter/project-switch behaviors remain incomplete or only test-covered. The feature branch is pushed without merging to `main`.

## 2026-09-30 final focused acceptance — provenance graph, citations, and browser regression

Repository: `https://github.com/anatwork14/research-observer`

Branch: `feature/research-graph-timeline` (pushed only to this branch; no merge to `main`).

Starting SHA: `64735456f81c4fbdab75762d4cebb167c1a6df5e` (clean). Starting `origin/main...HEAD`: `0 120`; `origin/feature/research-graph-timeline` matched the starting SHA. Final implementation SHA: `ed44096073dcf6ad2344ee63de2c7da5b3526562`. The checkpoint documentation commit follows this implementation commit.

### Fixes

- `ed44096` — preserve the selected `research` and other query parameters when changing PDF pages; only the `page` value changes. Added two direct regression tests.
- The browser pass found a Timeline hydration mismatch: server and browser formatted the same commit instant in UTC and Asia/Ho_Chi_Minh. Timeline instants now format deterministically in UTC with an explicit UTC label; date-only values remain date-only. Added a timezone-formatting regression test.

### Disposable browser fixture and interactions

- Created two `[TEST ONLY]` projects in an independent temporary clone; neither replaced nor modified real research. Project A had 7 Research Graph nodes, 4 typed relationships, 1 Markdown reference edge, a `supersedes` pair, Literature and promoted PDF Evidence. Project B reused `main.tex` and Claim ID `final-qa-claim` to check project isolation and included 112 Claim/Passage pairs for the graph cap.
- Research Graph interactions passed: drag, pin, drag a second node while the pinned node stayed fixed, unpin, pan, zoom in/out, reset, and local-neighborhood depth. Typed-link and Markdown-reference toggles filtered independently; the `investigates` relation query narrowed the graph; switching A→B→A restored each project's nodes. The research view displayed only research nodes/typed/reference edges and did not run manuscript citation or Claim scans.
- Citation drawer found the canonical test Literature candidate with title, author, year, and DOI. Insertion and bibliography configuration used the UI. It wrote `references.bib`; citation references resolved to that bibliography and its Literature source. A promoted PDF Evidence candidate was also inserted from the UI and resolved to the promoted Evidence note and local PDF.
- Built the saved test manuscript from a real local test PDF annotation. Provenance selected Paper trace reached 8 nodes across the seven-hop chain: Paper → Annotation → Evidence → Citation → Passage → Claim → Manuscript → Revision. The graph reports 13 visible edges because the fixture also has direct citation/manuscript and passage/manuscript links; the source-to-revision spine itself has seven transitions. A Revision came from one committed A manuscript source revision.
- Claim layer off removed Claim nodes/edges and reduced the Paper trace from 8 to 7 nodes; re-enabling restored it. Citation layer off reduced the Paper trace to its 3-node Paper/Annotation/Evidence source branch, while a separately selected Claim retained its Passage and Manuscript direct links. Re-enabling Citations restored the eight-node trace.
- Direct-only inspector connections were checked for Evidence (annotation and citation), Claim (passage and manuscript), and Passage (citation, Claim, and manuscript). Claim deep link opened `main.tex` at marker line 4; Passage deep link opened the prose at line 5.
- Large graph displayed 188 of 232 total nodes, including 90 of 112 per Claim and Passage lane, with a fixed 560px SVG viewport and 1,930px document height. Searching `qa-bulk-105` (outside the initial 90) retained that Claim plus adjacent Passage and `large-claims.tex`; its inspector listed only the two direct Claim links. This verifies selected-trace priority within the lane cap.
- Clear-selection removed the selected trace and returned normal emphasis without navigation. Keyboard Tab moved focus between graph nodes; Enter selected and Space cleared the selected Claim.
- Unsaved Claim remained absent from a separate Provenance view; after UI save/reload it appeared. Test source was restored to the committed state before cleanup.
- A/B project switch isolated graph nodes, Claims, citations, manuscripts, and revisions despite matching file and Claim IDs.
- Browser SyncTeX passed after the QA manuscript change: forward source line 5 → PDF page 1 and reverse PDF text → `main.tex:5`. The app service verifier also passed all three TeX engines, BibTeX, Biber, and a SyncTeX round trip.
- No stored reviewed Consensus provider fixture was available; Consensus provenance was not browser-tested. Deterministic Consensus evidence/provenance tests passed; provider credentials were not fabricated.
- Final browser console checks across Research Graph, Provenance, Timeline, and IDE showed no hydration, React key, SVG, rerender, editor-loop, or unexpected request errors. The disabled Codex endpoint produced the expected 503 during the disposable session.

### Cleanup, gates, and decision

- Removed the temporary QA clone, its two test projects, the copied PDF/annotation/manuscripts, the owned QA container, and the QA image tag. Real research folders were untouched.
- `GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local`: PASS — 184/184 unit tests, typecheck, lint, production build, and 2/2 workflow tests.
- `GIT_CONFIG_GLOBAL=/dev/null npm run check:full`: PASS — 184/184 unit tests, typecheck, lint, and production build.
- `npm run verify:latex:project-app`: PASS — pdfLaTeX, XeLaTeX, LuaLaTeX, BibTeX, Biber, and SyncTeX.
- `git diff --check`: PASS. Build-generated edits to `next-env.d.ts` and `tsconfig.json` were restored.
- Existing warnings: two ESLint warnings, 22 Turbopack dynamic-filesystem tracing warnings, and the Doctor warning for ignored root `AGENTS.md`; no new lint or build errors.
- **Merge-ready: yes.** The requested branch is pushed for review, and remains unmerged to `main`.

## 2026-09-30 explicit Claim↔Evidence acceptance pass

Repository: `https://github.com/anatwork14/research-observer`
Branch: `feature/claim-evidence-relations` (push target only; no merge to `main`).

- Starting SHA: `d58d70e6ce03ee06b9ac5a89bb0f79fb2d261379`; initial worktree clean. `origin/main` was `48801218a77c4d91e160939518a0dc34de0fdde4`, and `origin/main...HEAD` was `0 28`. The feature remote matched the starting SHA before checkpoint work and still matched at the pre-push fetch.
- No source-code fix was needed or made. This pass creates a documentation-only checkpoint commit; its resulting SHA is reported in the final task report. The verified implementation/source SHA remains `d58d70e6ce03ee06b9ac5a89bb0f79fb2d261379`.
- Runtime/install: Node `v22.23.3`, npm `10.9.9`; `GIT_CONFIG_GLOBAL=/dev/null npm ci` passed (513 packages, 0 vulnerabilities). Existing npm output included the ESLint 9.39.5 deprecation notice.
- Focused suites: 14 files, 58/58 tests passed. Counts: claim relations 4; relation collision 1; claim-evidence projection 6; claims 6; claim projection 5; evolution claims 3; claim loading 2; LaTeX editor tools 11; claim-anchor UI 2; evolution 7; evolution trace 2; evolution passages 3; evolution Consensus 2; manuscript passages 4.
- `GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local`: PASS, including `check:full` and 2/2 workflow tests. Standalone `GIT_CONFIG_GLOBAL=/dev/null npm run check:full`: PASS, 198/198 unit tests, typecheck, lint, and production build. Lint had 0 errors and 2 existing warnings (`_T`, `offsetAtLine`). Build succeeded with 22 existing Turbopack dynamic-filesystem tracing warnings. Doctor reports the existing ignored-root-`AGENTS.md` warning. Build-generated `next-env.d.ts` and `tsconfig.json` changes were restored.
- `git diff --check`: PASS after checkpoint authoring. No application files changed.

### Parser, projection, UI, and provenance evidence

A disposable isolated QA worktree and synthetic QA project were used; test-only files and the QA worktree were removed after restoring the manuscript and hidden-file state. No real research source was edited. The browser dev server was stopped. The contract remained the exact author directive `% observaire:claim-evidence <claim-id> <relation> <evidence-slug>` and the only accepted relations were `supports`, `contradicts`, `contextualizes`, and `qualifies`.

- Strict directive parsing and the collision regression passed: a Claim↔Evidence marker is not misread as a Claim anchor. Natural-language wording and citation proximity alone did not create authored Claim↔Evidence edges.
- All four allowed relations projected as distinct explicit `layer=claim-evidence` Evidence→Claim edges. Unsupported `proves`, `confirms`, `refutes`, and `answers` each produced `unsupported-relation` and no edge. A numeric-leading canonical ID (`010-evidence-result`) resolved successfully.
- Literature targets were rejected with `evidence-type`, including a cited Literature object; missing Evidence produced `evidence-missing`; cross-project Evidence produced `evidence-cross-project`. Missing and duplicate Claim endpoints produced `claim-unresolved` and no semantic edge; duplicate Claim occurrences did not resolve arbitrarily.
- An exact duplicate directive yielded one graph edge and two duplicate-relation health occurrences. Two different authored relations for one Claim/Evidence pair remained two edges. Citation→Passage→Claim context coexisted with explicit Evidence→Claim semantics; removing the directive left the citation route without a semantic edge.
- IDE command-palette helper inserted the placeholder in CodeMirror and plain textarea modes, selected `claim-id`, marked the editor dirty, and did not save automatically. Placeholder endpoints appeared in advisory/Trace health diagnostics. Selecting an existing Claim ID reused only that selected ID and selected `evidence-slug`; no Evidence was inferred. The plain editor and CodeMirror checks were done at desktop viewport size; narrow-screen editor behavior remains unverified.
- Claim↔Evidence layer disable/enable removed/restored only authored semantic edges while retaining nodes and citation paths. Disabling canonical Research semantics left Claim↔Evidence edges intact. Trace health showed separate Claim and Evidence-link issue rows with source file/line, Claim, relation, Evidence slug, and issue type where available.
- Unsaved editor text did not enter the saved projection. Hiding the manuscript removed its live Claims/semantic edges without changing the source SHA; restoring it returned the source. Saving `supports`→`qualifies` replaced the prior edge. Deleting the Evidence object or changing it to Literature removed affected edges and surfaced `evidence-missing` or `evidence-type`. Two project fixtures remained isolated.
- Research Graph contained no manuscript Claim nodes/Claim↔Evidence edges; Timeline contained no Claim nodes/events. Both regressions passed in the browser.
- Desktop document dimensions were `clientWidth=1633`, `scrollWidth=1633`; graph content overflow stayed inside its graph scroller. The browser viewport override did not change the actual viewport, so 390×844, 768×1024, and 1024×768 document-overflow checks are **NOT VERIFIED**.
- In a synthetic disposable fixture, the complete eight-node/seven-transition provenance path Paper→Annotation→Evidence→Citation→Passage→Claim→Manuscript→Revision coexisted with a direct Evidence→supports→Claim shortcut. This proves the fixture projection/browser path, not any real paper claim.
- Citation/BibTeX resolution and compile smoke passed on the synthetic manuscript. Direct pdfLaTeX, BibTeX, and SyncTeX checks passed: forward source line 19→PDF page 1; reverse PDF→`main.tex` line 37. `latexmk` was unavailable on the host, and the full container app verifier was not run.
- Browser console warning/error collection across Research Graph, Provenance, Timeline, and IDE returned no entries. The dev server logged the expected disabled Codex manuscript endpoint 503; it is not counted as a defect.

### 59-point acceptance status

1. Starting SHA — PASS, `d58d70e6ce03ee06b9ac5a89bb0f79fb2d261379`.
2. Final verified source SHA — PASS, unchanged source SHA; documentation checkpoint commit SHA is in the final report.
3. Commits created — one documentation-only progress checkpoint; no code commit.
4. Worktree clean — PASS after commit (build-generated edits restored).
5. Claim-evidence parser tests — PASS, 4/4.
6. Parser collision test — PASS, 1/1.
7. Claim-evidence projection tests — PASS, 6/6.
8. Total unit tests — PASS, 198/198.
9. Typecheck — PASS.
10. Lint — PASS, 0 errors, 2 existing warnings.
11. Production build — PASS, 22 existing Turbopack tracing warnings.
12. `verify:merge-local` — PASS; workflow tests 2/2.
13. `check:full` — PASS, 198/198.
14. `git diff --check` — PASS.
15. CodeMirror relation insertion — PASS at desktop size; dirty only, no autosave.
16. Plain-editor relation insertion — PASS at desktop size; dirty only, no autosave.
17. Placeholder diagnostics — PASS in editor advisory and Trace health.
18. Selected Claim-ID reuse — PASS; only selected Claim ID reused, Evidence placeholder selected.
19. `supports` — PASS.
20. `contradicts` — PASS.
21. `contextualizes` — PASS.
22. `qualifies` — PASS.
23. Unsupported relation — PASS; four arbitrary verbs rejected with no edge.
24. Numeric-leading canonical Evidence ID — PASS.
25. Literature target rejection — PASS, including cited Literature.
26. Missing Evidence target — PASS, `evidence-missing`.
27. Cross-project Evidence rejection — PASS, `evidence-cross-project`.
28. Missing Claim rejection — PASS, `claim-unresolved`.
29. Duplicate Claim rejection — PASS, unresolved and no edge.
30. Duplicate exact relationship — PASS, one edge plus two duplicate health occurrences.
31. Multiple distinct authored relations — PASS, two distinct edges.
32. Citation without directive — PASS, no semantic edge.
33. Strong prose without directive — PASS, no semantic edge.
34. Citation plus authored semantics — PASS, independent routes coexist.
35. Claim↔Evidence layer toggle — PASS.
36. Research semantic layer independence — PASS.
37. Trace-health display — PASS for separate rows and available source/endpoint details.
38. Unsaved relationship isolation — PASS.
39. Hidden source behavior — PASS; source hash unchanged and restore returned projection.
40. Relationship freshness — PASS; old relation removed, new relation present.
41. Evidence deletion/type-change — PASS; correct issue and no edge.
42. Project isolation — PASS in two-project fixture.
43. Research Graph regression — PASS; no manuscript Claim semantics.
44. Timeline regression — PASS; no Claim nodes/events.
45. 390×844 — NOT VERIFIED; viewport override did not apply.
46. 768×1024 — NOT VERIFIED; viewport override did not apply.
47. 1024×768 — NOT VERIFIED; viewport override did not apply.
48. Desktop — PASS at 1633×828.
49. Document overflow — PASS on desktop only; narrow viewports not verified.
50. Full provenance plus semantic shortcut — PASS in synthetic QA fixture, 8 nodes/7 transitions plus shortcut.
51. Citation regression — PASS for synthetic citation/BibTeX resolution and compile.
52. SyncTeX forward — PASS, source line 19 to PDF page 1.
53. SyncTeX reverse — PASS, PDF back to `main.tex:37`.
54. Browser console — PASS, no collected browser warnings/errors on four views.
55. Defects found/fixed — none in repository code; no speculative changes.
56. Remaining blockers/warnings — exact narrow viewport checks and narrow editor behavior not verified; `latexmk` and full container verifier unavailable/not run; existing lint/build/doctor warnings; expected disabled-Codex 503.
57. Merge-ready — **NO** for this pass because required narrow viewport behavior remains unverified.
58. `progress.md` updated — YES.
59. Nothing merged to `main` — CONFIRMED; push only to `feature/claim-evidence-relations`.

## 2026-09-30 responsive browser verification follow-up

Repository: `https://github.com/anatwork14/research-observer`

Branch: `feature/claim-evidence-relations`; push target only. No merge to `main`.

- Starting SHA: `1197501a37c7cda35ee3c35fb6d12e6602ccaa95`; `origin/main` remained `48801218a77c4d91e160939518a0dc34de0fdde4`. Final checkpoint SHA is recorded by the commit containing this entry.
- Used an isolated disposable QA worktree and synthetic-only Evidence, Literature, manuscript, and PDF fixtures. No real research was edited. Chromium was driven through Playwright with configured viewports and touch emulation; each page reported the requested `innerWidth`, `innerHeight`, document client dimensions, and `scrollWidth`.
- Actual viewport matrix: 390×844, 768×1024, and 1024×768. For Provenance and IDE, each document reported `scrollWidth/clientWidth` of 390/390, 768/768, and 1024/1024 respectively. Research Graph and Timeline at 390×844 also reported 390/390. Browser emulation only; no physical tablet was used.
- Provenance passed at all three sizes. The graph SVG remains inside its own horizontal scroller. At 390px, health rows stack and wrap long Claim/relation/Evidence IDs and issue types. At 768px and 1024px, the health grid fits the page. Claim and Evidence inspectors fit; the long Claim ID wraps. Touch targets for the Claim↔Evidence layer, clear selection, and connection/open-source controls are at least 44px high/tall where applicable.
- At all three sizes, Claim↔Evidence toggled off/on. Only the authored semantic edge disappeared and returned; Claim structural and citation paths remained. The internal graph content scrolls without document-level overflow.
- At 390×844, plain-editor relation insertion created `% observaire:claim-evidence claim-id supports evidence-slug`, selected `claim-id`, marked the editor dirty, and did not autosave. The placeholder warning remained available in editor Problems and Trace health. Selected-ID reuse inserted the selected Claim ID and selected `evidence-slug` for replacement. Before explicit save the separate Provenance projection still had one edge; after saving the valid test directive it had two. The synthetic manuscript was restored afterward.
- Trace Health displayed `evidence-missing`, `evidence-type`, `claim-unresolved`, and `duplicate-relation` with file/line, Claim ID, relation, Evidence slug, and issue type. No row widened the document.
- Research Graph loaded at 390×844 with its existing controls, no Claim↔Evidence layer control/Claim node, and no page overflow. Timeline had no Claim↔Evidence controls and no page overflow. Its long dated synthetic title originally clipped at one line; the small-screen title rule now wraps it to two lines (`clientWidth=259`, `scrollWidth=259`, height 24px) at 390×844.
- Browser console/page-error/HTTP collection across Provenance, IDE, Research Graph, and Timeline found no page exceptions or React/SVG/editor warnings. The only console error was the expected HTTP 503 from disabled `/api/codex/manuscript-act` in the IDE (`RESEARCH_OBSERVER_CODEX=0`).
- Responsive fixes: health-row grid uses constrained columns, wraps long endpoint/type text, and stacks on narrow screens; coarse-pointer graph controls have usable target sizes and the long-ID inspector header can shrink/wrap; Timeline card titles wrap at mobile widths. Relationship semantics were not changed.
- `GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local`: PASS; includes the full check/build and workflow suite (2/2).
- `GIT_CONFIG_GLOBAL=/dev/null npm run check:full`: PASS, 198/198 unit tests, typecheck, lint, and production build. Lint had 0 errors and 2 existing warnings (`_T`, `offsetAtLine`); build emitted 22 existing Turbopack dynamic-filesystem tracing warnings. Doctor retains the ignored root `AGENTS.md` warning.
- `git diff --check`: PASS. Build-generated changes to `next-env.d.ts` and `tsconfig.json` were restored.
- **Merge-ready: yes.** All requested responsive browser checks passed; push only to `feature/claim-evidence-relations`. Nothing was merged to `main`.

## 2026-09-30 Claim↔Evidence audit analytics checkpoint

Repository: `https://github.com/anatwork14/research-observer`

Branch: `feature/claim-evidence-audit`; push target only. No merge to `main`.

- Starting SHA: `146d4fb510216a923640dfa8c4d6228c43b67484`. `origin/main` was `b7e3c3f50b74f4737a20640083b43e789372a196`; branch was 20 commits ahead and 0 behind. Verified implementation SHA: `99cdb9e54b7b315f12693fdb167014ff297a3171`. This entry is a docs-only checkpoint after that tested implementation commit.
- Runtime/install: Node `v22.23.3`, npm `10.9.9`; `npm ci` passed with 513 packages and 0 vulnerabilities. No real research was edited. Six disposable QA projects and manuscript roots were removed after the browser/service checks.
- Focused tests: Claim audit 4/4; Claims loading/layout/bounds 6/6; related Claim↔Evidence semantics 25/25 across relations 4, collision 1, projection 6, anchors 6, Claim projection 5, and evolution Claims 3. Total focused checks: 35/35.
- Repository gates: `GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local` passed with 208/208 unit tests and 2/2 workflow tests. Standalone `check:full` passed with 208/208 tests, typecheck, lint, and production build. Lint had 0 errors and 2 existing unused-variable warnings (`_T`, `offsetAtLine`); Doctor retained the ignored root `AGENTS.md` warning; Turbopack emitted 22 existing dynamic-filesystem tracing warnings. `git diff --check` passed. Generated `next-env.d.ts` and `tsconfig.json` edits were restored.

### Synthetic audit results

- Alpha had 4 explicit Claims, 3 with authored Evidence, 1 without an authored Evidence link, 6 valid authored semantic links, 2 linked canonical Evidence objects, and 6 audit issues. Coverage was 0 targets: 1 Claim, 1 target: 2 Claims, 2+ targets: 1 Claim.
- Alpha relation mix: supports 3, contradicts 1, contextualizes 1, qualifies 1. Claim signals overlapped factually: supports 3 Claims, contradicts 1, both supports and contradicts 1, contextualizes 1, qualifies 1. The mixed Claim had one distinct Evidence target despite two relationship types. `evidence-a` reached 3 distinct Claims across 5 authored links.
- The valid unlinked Alpha Evidence appeared under `No authored Claim link`; it was not marked erroneous, bad, irrelevant, or weak. Missing Evidence, wrong-type Literature, unresolved Claim, and duplicate directives appeared as issues and did not inflate valid coverage. Duplicate exact directives remained one valid derived edge with duplicate issue rows.
- The prose-only Claim cited `someKey` and used supportive wording but remained at 0 authored Evidence targets and created no Claim↔Evidence semantic link.
- Beta's same `claim-one` ID remained project-isolated: Beta-only scope showed 1 Claim, 1 contextualizes link, and its own canonical Evidence. Alpha+Beta aggregated to 5 Claims, 7 authored links, 4 Claims with Evidence, 1 without, 3 linked Evidence objects, with Alpha's single unlinked Evidence and 6 Alpha issues. Toggling projects kept the Claims tab active and updated counts.
- Gamma had canonical Evidence and a hidden `.tex` source, so it was reported Unavailable and contributed no factual zero counts. In Gamma-only scope there were no audit KPI cards or coverage charts, and the Open Provenance link and canonical Evidence route worked. An Empty project with a visible `.tex` file and no Claims was available and correctly showed 0 Claims.
- The 105-Claim fixture returned all 105 Claims from the service, with 105 valid links, 58 canonical Evidence objects, 45 unlinked Evidence, 45 issues, and 13 linked Evidence-reach series. The UI rendered 80 Claim rows, 40 unlinked Evidence rows, 40 issue rows, and 12 bars with explicit `Showing N of M` disclosure for each truncated list/chart.
- Claim links opened `/ide?research=alpha-audit-qa&file=main.tex&line=3`; Evidence links opened `/progress/evidence-a` with the canonical note title. The audit surface rendered no buttons or automatic-link/inference actions.

### Source boundaries, existing views, and browser checks

- In the 390px plain IDE, inserting a directive enabled Save but left the on-disk source and separate Claims audit unchanged. Saving changed the audit from 6 to 7 links and from 3 to 4 Claims with Evidence; the original synthetic source was restored.
- Hiding Alpha's source removed its live audit and showed Unavailable; the source SHA-256 stayed unchanged. Restore returned the original counts. Editing one saved `supports` directive to `qualifies` changed those relation counts from 3/1 to 2/2; restoring the source returned them to 3/1.
- Static lazy-loading regression passed. `/insights`, Analytics, Timeline, and Versions loaded successfully without Claim audit KPIs for the unavailable Gamma scope. Claims loaded the audit. Existing overview, analytics, timeline, and versions content and project scope controls rendered.
- Browser viewport matrix: 390×844, 768×1024, 1024×768, and 1280×800. Every Claims page reported document `scrollWidth/clientWidth` equal to viewport width. At 390 and 768, the Claim table scrolled within its own container (820px table content); 1024 and desktop table content fit. Five tabs were visible: two-column layout at 390px and five columns at tablet/desktop widths. Alpha/Beta/Gamma coverage rows remained visible, including a distinct Gamma Unavailable badge.
- Long valid Claim/Evidence IDs and issue details wrapped at 390px; document width remained 390px, relation tags remained visible, and scrolling the table exposed the source and line column. Long Evidence titles stayed within their chips.
- Local browser DOM-ready timings were about 376–424 ms for the existing views on Gamma and 712 ms for the 105-Claim view, which rendered 80 bounded rows. These are local development smoke timings, not production performance claims.
- Browser console, page errors, and failed-request collection across responsive Claims pages and existing Insights tabs returned no entries. The unsupported-score check found no composite score; explanatory copy explicitly says authored coverage is not a quality score.
- Defects fixed: Claim audit grid intrinsic sizing widened the document to 866px at 390 and 876px at 768 before the fix; constrained the grid and its children so the table now scrolls internally. Evidence-reach previously truncated 13 series to 12 without disclosure; added a `Showing 12 of 13` notice and regression coverage. No relationship vocabulary or inference behavior changed.
- **Merge-ready: yes for this checkpoint.** Feature branch only; `main` was not merged or modified by this task. Existing lint/Doctor/Turbopack warnings above are non-blocking.
