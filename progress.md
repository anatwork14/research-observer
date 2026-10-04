# Observaire local-first v1 progress

Last updated from `main` merge commit:

```text
86e1ce47cb48833980c06195738b988d46d930e1
```

Release-stabilization branch:

```text
release/local-first-v1-stabilization
```

This file is the **current status**, not a historical feature-branch diary. Earlier implementation checkpoints remain available in Git history and merged pull requests.

## Product status

The planned local-first v1 feature set is implemented. Remaining work is release verification, documentation consistency, and fixes only if final sign-off finds a defect.

No new subsystem should be added during this phase.

## Canonical architecture

Durable source of truth:

```text
progress/                     research Markdown + assets
annotations/                  PDF annotation sidecars
manuscripts/                  LaTeX/BibTeX/manuscript source
research-observer.config.json workspace configuration
```

Derived/transient state:

```text
public/_research/**            generated search/graph/health/media/build output
.research-observer/**          local integration/review/cache state
```

Core invariant:

> Generated indexes, caches, AI context, Git review state, and UI state never replace durable research source.

## Implemented v1 capability map

### Research compiler and content model

Implemented and previously verified:

- folder-backed project discovery;
- legacy/root project compatibility;
- stable research IDs and aliases;
- per-project ordering;
- Markdown references and backlinks;
- explicit typed relationships;
- compiler diagnostics and Health conditions;
- search, graph, health, manifest, and project statistics;
- incremental generated-media mirroring;
- linear reverse relationship indexes for large workspaces.

### Projects and multi-research orchestration

Implemented and previously verified:

- folder project import and direct host copy;
- transactional import rollback/collision protection;
- explicit `queued / active / blocked / done / untracked` states;
- explicit `dependsOn / next / note` metadata;
- derived Waiting/Clear dependency context without rewriting authored status;
- orchestration editor with Preview → Save;
- config hash/stale protection;
- review digest binding;
- atomic config writes and compiler rollback.

### Insights, timeline, versions, and analytics

Implemented and previously verified:

- graph-heavy project/multi-project analytics;
- pipeline/type/status/relationship/activity visualizations;
- health and cross-project matrices;
- URL-backed Analytics V2 drill-down;
- semantic research evolution;
- timeline revision summaries;
- explicit `supersedes` lineages;
- Markdown version comparison.

### Local Workspace Health

Implemented and previously verified:

- runtime/research integrity overview;
- safe rebuild-research action;
- safe PDF runtime preparation;
- generated-artifact repair;
- no durable-root repair mutation;
- production-local maintenance opt-in separated from research write enablement.

### Research Assist V2

Implemented and previously verified:

- canonical current-note resolution;
- explicit incoming/outgoing relationships;
- Evidence-authored `supports / contradicts / answers` signals;
- compiler health context;
- orchestration/waiting context;
- recent dated work;
- deterministic context-aware questions and literature queries;
- bounded current-note source snapshot for Codex;
- public inspector without raw note-body exposure;
- server-authoritative metadata precedence;
- fail-soft behavior when context/Codex/provider paths are unavailable.

### Consensus and reviewed Evidence

Implemented and previously verified:

- Consensus search integration;
- explicit review-first Evidence promotion;
- exact Markdown preview;
- optional authored `supports / contradicts / answers` relation;
- `answers` limited to canonical Question targets;
- no semantic inference from rank/abstract/takeaway/citation count;
- stale/proposal-hash/collision/same-origin/write-policy guards;
- compiler rollback on failed apply;
- Workspace Context refresh from compiler after successful Evidence save.

### New Research

Implemented and previously verified:

```text
Define
→ Consensus screening
→ read-only Codex plan
→ target project selection
→ exact scaffold review
→ explicit Apply
```

Scaffold boundary:

- Question;
- Plan/source-trace;
- Hypotheses;
- Experiments;
- zero Evidence objects;
- zero semantic Evidence edges from literature discovery context.

Apply is stale-safe, collision-safe, compiler-validated, and transactional.

### PDF research and provenance

Implemented and previously verified:

- local PDF reader;
- text search/selection and page-deep-links;
- text annotations;
- Area/Figure/Table region annotations;
- PDF fingerprint-bound anchors;
- stale/legacy anchor states;
- explicit re-anchor + history;
- reviewed caption/OCR/transcription source text;
- reviewed PDF Evidence flow;
- exact Markdown + normalized geometry preview;
- immutable `observaire-pdf-annotation-v1` provenance snapshot;
- sidecar-independent Spatial provenance rendering;
- no inferred semantic Evidence relationships or quality/confidence scores.

### Codex and Direct Edit

Implemented and previously verified:

- Codex Ask and Draft read-only modes;
- research-aware canonical context;
- isolated Act proposal worktree;
- network-disabled/path-scoped Act;
- exact diff + Doctor review;
- stale touched-file rejection;
- explicit Apply/Discard;
- browser Direct Edit draft recovery;
- stale-safe exact review + rollback.

### LaTeX / manuscript research

Implemented:

- project-scoped manuscript source;
- `.tex / .bib / .sty / .cls / .bst` editing;
- CodeMirror desktop editor + narrow/mobile textarea fallback;
- `latexmk` integration and diagnostics;
- PDF preview;
- forward/reverse SyncTeX;
- research-aware citations/BibTeX;
- manuscript review flows;
- optional TexLab unsaved-buffer diagnostics/symbols/completion.

TexLab remains advisory. The compiler/`latexmk` result is authoritative.

## Recent verified checkpoints

The following late-stage checkpoints were individually verified before merge:

```text
#19 Multi-research orchestration
#20 Local orchestration editor
#21 Research Assistant Context V2
#22 New Research reviewable scaffold
#23 Reviewed Consensus Evidence promotion
#24 PDF Region Evidence V2
#26 Browser baseline hydration/favicon fix
#25 Large-workspace performance hardening
```

Latest verified PR #25 final gate reported:

```text
Tests: 349/349 PASS
Compiler: 9/9 PASS
Compiler performance: 3/3 PASS
Markdown media: 3/3 PASS
Typecheck: PASS
Lint: PASS (0 errors; 3 warnings)
Build: PASS
check:full: PASS
Runtime errors: 0
Hydration errors: 0
Unexpected browser requests: 0
```

Default large-workspace benchmark in that verification:

```text
20,000 synthetic notes
12 assets
unchanged second media sync: copied 0 / skipped 12 / removed 0 / fullRebuild false
```

These results describe the verified PR heads. The final release candidate still needs the release-wide sign-off contract in `docs/MERGE_READINESS.md`.

## Known non-blocking warnings

Recent clean verification runs consistently reported:

- npm audit: 5 high-severity findings in the locked dependency tree;
- ESLint: 3 warnings, 0 errors;
- Next/Turbopack filesystem-tracing warnings during successful builds.

These remain visible release notes. Do not run broad dependency upgrades during sign-off merely to silence the audit output; upgrades should be a separately scoped, fully verified change.

Optional provider/toolchain checks must be reported as unavailable when the environment cannot exercise them.

## Release-stabilization work

Current branch scope:

1. refresh `README.md` to match shipped v1 behavior;
2. replace feature-specific merge-readiness text with a whole-product release gate;
3. reset this file to current release status;
4. document local-first v1 scope, optional dependencies, safety boundaries, and known warnings;
5. align `.env.example` write-policy comments with current reviewed write workflows;
6. run one final release-wide verification on the exact stabilization head;
7. fix only defects discovered by that verification.

## Release-ready definition

Do not call local-first v1 complete until the exact stabilization candidate satisfies `docs/MERGE_READINESS.md` and the report ends with:

```text
LOCAL-FIRST V1 RELEASE VERIFIED
```

If the final report is blocked, keep the release PR open and fix only the identified release defect before rerunning the affected gates.
