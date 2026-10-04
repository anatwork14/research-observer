# Observaire local-first v1 release readiness

This is the release verification contract for the **whole local-first product**, not a single feature branch.

A release/sign-off claim must distinguish what was actually exercised from what is unavailable in the verifier's environment. Optional integrations may be reported unavailable; they must never be reported as passed without execution.

## 1. Exact target and clean checkout

Record:

```text
Branch / commit under verification
Origin commit
Node version
npm version
Working tree clean/dirty state
```

Prefer an isolated worktree so verification fixtures cannot damage an existing user checkout.

Never force-push as part of verification.

## 2. Core local gate

Run:

```bash
npm ci
npm run doctor
npm test
npm run typecheck
npm run lint
npm run build
npm run check:full
```

Expected release behavior:

- `doctor`: zero integrity errors in the restored repository fixture;
- all tests pass;
- typecheck passes;
- lint has zero errors;
- build passes;
- `check:full` passes.

Report warnings separately. Do not hide npm audit findings, lint warnings, or Turbopack tracing warnings, but do not automatically upgrade dependencies during release verification.

Global Git signing/configuration on a verifier machine is not part of Observaire. If a temporary Git fixture stalls only because of global signing configuration, it is acceptable to rerun that verification command with `GIT_CONFIG_GLOBAL=/dev/null`; record that fact and do not mutate the user's global config.

## 3. Canonical source-of-truth boundary

The release must preserve:

```text
progress/                    durable research + assets
annotations/                 durable PDF annotation sidecars
manuscripts/                 durable manuscript source
research-observer.config.json durable workspace configuration
```

Generated/transient state:

```text
public/_research/**           rebuildable artifacts
.research-observer/**         local integration/review/cache state
```

Verification fixtures must be removed. After cleanup, durable source/config hashes should match their starting values unless the test intentionally reviewed and applied a durable change.

No generated/transient state may become authoritative research knowledge.

## 4. Project and orchestration gate

Verify:

- folder-project discovery and stable project manifests;
- project import rollback/collision safety;
- project links and per-project ordering;
- explicit orchestration lanes: queued / active / blocked / done / untracked;
- explicit dependencies, next step, and coordination note;
- `Waiting` / `Clear` remain derived context rather than authored status rewrites;
- orchestration editor Preview → Save review boundary;
- stale config rejection and reload;
- invalid self/missing/cyclic dependencies rejected;
- unrelated config fields preserved.

Cross-project research relationships must not silently become orchestration dependencies.

## 5. Research compiler, graph, analytics, and performance

Verify canonical behavior for:

- stable IDs and aliases;
- Markdown references/backlinks;
- typed outgoing/incoming relationships;
- Evidence-signal semantics;
- project stats and health conditions;
- graph/search/manifest/health artifacts;
- semantic revision/version comparison;
- Analytics V2 URL-backed drill-down.

Large-workspace checks:

```bash
node --test tests/compiler-performance.test.mjs
node scripts/benchmark-large-workspace.mjs
```

Timing is diagnostic, not an SLA. Correctness requirements are:

- reverse indexes preserve canonical ordering;
- unchanged generated media is not recopied;
- changed/new assets update;
- removed/rogue generated assets are pruned;
- missing/corrupt transient media state safely rebuilds;
- source symlinks remain rejected;
- transient fingerprints never leak into canonical research artifacts.

## 6. PDF and Evidence gate

Verify representative text and visual-region PDF workflows:

```text
PDF
→ text selection OR area/figure/table annotation
→ reviewed source text when required
→ exact Evidence preview
→ explicit Apply
→ canonical Evidence
```

Required boundaries:

- PDF replacement produces stale anchors rather than silent movement;
- re-anchor is explicit and history preserving;
- comments are not converted into quotations;
- reviewed OCR/caption/transcription remains explicit user-reviewed provenance;
- default PDF durable promotion is review-first;
- normalized geometry/document/source-text fingerprints are frozen in canonical Evidence Markdown;
- later sidecar edits do not rewrite historical Evidence;
- Spatial provenance renders from canonical Evidence without requiring the sidecar;
- no `supports` / `contradicts` / `answers` or quality/confidence score is inferred by PDF promotion.

Legacy compatible evidence routes may remain; the default UI must not bypass review-first workflows.

## 7. Consensus, Research Assist, and New Research gate

When Consensus is configured, verify search/result handling. If it is unavailable, report provider-backed checks as unavailable and rely only on tests/synthetic local fixtures for the application behavior.

Reviewed scholarly Evidence must require:

```text
Review evidence
→ explicit relation choice or none
→ exact Markdown preview
→ explicit Apply
```

Only explicitly authored `supports`, `contradicts`, or question-targeted `answers` may be created by this workflow.

Research Assist context must remain server-authoritative and derived from canonical compiler facts. Public context APIs must not expose raw note bodies or secrets.

New Research must preserve the planning/evidence boundary:

```text
Define
→ Consensus selection
→ read-only Codex plan
→ exact scaffold preview
→ explicit Apply
```

The scaffold may create planning objects but must create zero Evidence objects and zero semantic Evidence edges from discovery context.

## 8. Codex / Direct Edit gate

Codex may be unavailable on a verifier without existing local authorization. Never create new authorization just to manufacture a pass.

When available, verify:

- Ask/Draft remain read-only;
- server-authoritative research context wins over conflicting browser metadata;
- Act runs in isolated review state with network disabled/path scoping;
- proposal diff/doctor review happens before Apply;
- touched-file stale drift rejects Apply;
- live repository index is not staged/committed by Act/Apply.

Direct Edit must retain browser draft recovery, exact diff review, stale source rejection, Doctor validation, and rollback.

## 9. LaTeX / manuscript gate

Local repository regression is covered by the normal test suite. When the actual TeX/Docker toolchain is available, run:

```bash
npm run verify:latex:container
npm run verify:latex:project-toolchain
npm run verify:latex:project-app
```

Verify:

- project-scoped manuscript source;
- stale-safe saves and non-destructive Hide/Restore;
- pdfLaTeX / XeLaTeX / LuaLaTeX behavior where available;
- BibTeX/biblatex source handling;
- forward/reverse SyncTeX;
- compiler diagnostics;
- CodeMirror desktop editor and narrow/mobile textarea fallback;
- optional TexLab remains advisory, not authoritative.

Toolchain absence must be reported honestly rather than treated as a product success.

## 10. Docker persistence gate

When Docker is available, run:

```bash
npm run verify:persistence
```

The verifier must use isolated temporary host directories/volume names and must not delete normal user state.

Confirm durable research, annotation, and manuscript mounts survive service recreation. `.research-observer/` remains transient/app state even when persisted by the local named volume.

## 11. Browser matrix

Final release QA should cover, at minimum:

```text
1440×900
1024×1366
820×1180
430×932
390×844
```

Use light and dark modes on representative product surfaces.

Required areas:

- Projects + orchestration/editor;
- progress note + Markdown media;
- Insights/Analytics/Timeline/Versions;
- Research Assist + reviewed Consensus Evidence;
- New Research scaffold review;
- Papers/PDF reader/annotations/reviewed PDF Evidence;
- promoted Evidence spatial provenance;
- Health/Local Workspace;
- LaTeX IDE where the toolchain is available.

Acceptance:

```text
Runtime errors: 0
Hydration errors: 0
validateDOMNesting errors: 0
Unexpected failed requests: 0
No unintended page-level horizontal overflow
/favicon.ico: 200
Generated PDF/image assets: 200
```

Intentional/handled negative-test responses such as `403`, `409`, `422`, or `503` are not unexpected failures when they are the asserted outcome.

## 12. Production-local safety modes

A production build started locally should remain read-only for research mutation unless:

```text
RESEARCH_OBSERVER_WRITES=1
```

Preview/read flows must remain available where designed even when Apply is disabled.

Settings credential writes and local-maintenance actions have separate opt-ins. Verify write-disabled UI guidance rather than silently enabling mutation for QA.

## 13. Known non-blocking items

Do not promote these to release blockers unless they produce an actual correctness/security/runtime failure:

- npm audit findings that are not changed in the release branch;
- existing lint warnings with zero lint errors;
- Next/Turbopack filesystem-tracing warnings with a successful production build;
- optional provider/toolchain integrations unavailable in the verifier environment.

They must still be reported.

## 14. Release-ready rule

Local-first v1 is ready to sign off only when:

1. the exact release candidate passes the core local gate;
2. no known data-loss, source-corruption, stale-write bypass, provenance, hydration, or path-confinement defect remains;
3. browser QA covers desktop/tablet/mobile representative surfaces;
4. durable source hashes are restored after disposable verification fixtures;
5. optional integrations are clearly marked PASS / unavailable rather than guessed;
6. `README.md`, `docs/LOCAL_FIRST_V1_RELEASE.md`, `docs/MERGE_READINESS.md`, and `progress.md` agree on current behavior;
7. no new subsystem is added during sign-off unless a verification defect requires a scoped fix.

A release verification report should finish with exactly one of:

```text
LOCAL-FIRST V1 RELEASE VERIFIED
```

or:

```text
LOCAL-FIRST V1 RELEASE BLOCKED
```
