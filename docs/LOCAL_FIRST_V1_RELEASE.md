# Observaire local-first v1 release contract

## What this release is

Observaire local-first v1 is a filesystem-first research workspace whose durable record remains usable without the application.

The release is intentionally optimized for a **local workstation / local Docker** workflow. It does not require a hosted backend, database, cloud queue, vector database, or CI service.

## Durable source of truth

The durable record is:

```text
progress/**
annotations/**
manuscripts/**
research-observer.config.json
```

Project-local `.observaire-project.json` files are durable project metadata.

Everything under these roots should remain meaningful if generated app state is deleted.

## Derived / disposable state

The following are rebuildable or transient:

```text
public/_research/**
.research-observer/**
```

Examples include search/graph/health JSON, mirrored research media, PDF.js runtime assets, local proposal/review state, Codex integration state, LaTeX build outputs, and incremental media fingerprints.

Deleting transient generated state may require a rebuild or local re-authentication, but must not delete research knowledge.

## Required local runtime

For the Node workflow:

```text
Node >=22.13 and <25
npm 10.9.2 (repository packageManager)
```

Install with:

```bash
npm ci
```

Run locally with:

```bash
npm run dev
```

Or use the supplied Docker Compose setup.

## Optional integrations

### Consensus

Consensus is optional. It powers scholarly discovery/search when `CONSENSUS_API_KEY` is configured.

Without Consensus:

- canonical research remains usable;
- Projects/Insights/Papers/Health/Direct Edit/manuscripts remain usable;
- synthetic/local tests still validate reviewed-Evidence workflow behavior;
- live provider search is simply unavailable.

### Codex

Codex is optional and uses the local installed CLI/authorization.

Without Codex:

- canonical research and manual editing remain usable;
- Research Assist context still renders;
- Ask/Draft/Act show their unavailable/offline state;
- no provider authorization should be created only to satisfy release QA.

### TexLab

TexLab is optional advisory language intelligence for the LaTeX editor.

The compiler/`latexmk` diagnostics remain authoritative.

### TeX toolchain

A local TeX toolchain is optional for ordinary research browsing/editing. It is required to exercise real manuscript compilation/SyncTeX gates.

Release verification must distinguish “toolchain unavailable” from “toolchain passed”.

## Research writes

Development enables supported local research/config writes.

A production build started locally remains read-only for research mutation unless:

```text
RESEARCH_OBSERVER_WRITES=1
```

That gate covers reviewed/local mutation flows including:

- project import;
- Direct Edit;
- local Evidence capture;
- reviewed Consensus Evidence Apply;
- reviewed PDF Evidence Apply;
- New Research scaffold Apply;
- local orchestration editor saves.

Read/preview paths should remain available when writes are disabled where the workflow contract says they are reviewable without mutation.

Settings credential writes use their own production opt-in. Local maintenance actions use `OBSERVAIRE_LOCAL_MAINTENANCE` rather than silently enabling research writes.

## Review-before-write principle

High-impact generated/research writes are human-reviewable by default.

Examples:

```text
Consensus result
→ Review evidence
→ exact Markdown
→ explicit Apply
```

```text
PDF annotation
→ Review exact Evidence
→ geometry/provenance snapshot
→ explicit Apply
```

```text
New Research plan
→ exact scaffold
→ explicit Apply
```

```text
Codex Act
→ exact patch + Doctor
→ explicit Apply
```

```text
Orchestration edit
→ Preview
→ Save reviewed change
```

Preview must not mutate durable source.

## AI / research-truth boundary

Observaire deliberately separates context, suggestion, and research truth.

The following do **not** automatically become semantic claims or Evidence relationships:

- Consensus rank;
- semantic/search scores;
- citation counts;
- abstracts/takeaways;
- Codex output;
- text similarity;
- graph proximity;
- project health conditions;
- research activity.

Strong relations such as `supports`, `contradicts`, and `answers` are explicit authored research semantics.

Compiler health is factual condition reporting, not a research-quality score.

## New Research boundary

New Research can use discovery literature to propose a planning scaffold, but the scaffold intentionally creates:

```text
0 Evidence objects
0 semantic Evidence edges
```

Discovery/source-trace context can be preserved in planning notes without pretending it has already been reviewed as Evidence.

## PDF provenance boundary

PDF Evidence promotion preserves source provenance as a frozen canonical snapshot.

For visual regions, the Evidence Markdown can retain:

- source PDF/page;
- annotation ID/type;
- normalized rectangle geometry;
- document SHA-256;
- reviewed caption/OCR/transcription metadata and SHA;
- verification timestamps/tags.

Private sidecar changes after promotion do not rewrite historical Evidence.

No automatic OCR engine or visual-classification model is required by this release.

## Multi-project orchestration boundary

Project status is explicit human-authored metadata:

```text
queued / active / blocked / done
```

`untracked` means no orchestration state is authored.

Dependency context such as Waiting/Clear is derived from explicit dependencies and explicit project states. Research graph edges, health, activity, Evidence, or AI do not silently change project status.

## Performance boundary

The release supports larger local workspaces without introducing a second index/database source of truth.

Performance hardening includes:

- linear backlink/incoming-relationship indexing;
- incremental mirroring of approved generated research media;
- safe rebuild when transient media fingerprint state is missing/corrupt/unsafe.

Transient performance state stores filesystem fingerprints only; it does not store research prose or semantic truth.

## Verified late-stage baseline

Before the final stabilization PR, merged checkpoints individually verified the following late-stage paths:

```text
multi-project orchestration
local orchestration editor
Research Assistant Context V2
New Research reviewed scaffold
reviewed Consensus Evidence promotion
PDF Region Evidence V2
Markdown-media hydration/favicon baseline
large-workspace performance hardening
```

The last performance acceptance run reported 349/349 tests passing plus successful typecheck/lint/build/check:full and clean desktop/mobile browser smoke.

These historical checkpoint results are evidence for their merged heads. They do not replace final verification of the exact release candidate.

## Known non-blocking warnings at stabilization start

Recent verified runs reported:

```text
npm audit: 5 high-severity findings
ESLint: 3 warnings, 0 errors
Next/Turbopack: filesystem-tracing warnings during successful builds
```

These are visible release notes. They are not permission to ignore a new security/runtime regression, and they are not a reason to perform an unscoped dependency upgrade during sign-off.

## Release gate

Use:

```text
docs/MERGE_READINESS.md
```

The exact release candidate must pass the core local gate and representative browser/source-safety checks. Optional integrations must be recorded as PASS or unavailable based on actual execution.

The final report ends with exactly one of:

```text
LOCAL-FIRST V1 RELEASE VERIFIED
```

or:

```text
LOCAL-FIRST V1 RELEASE BLOCKED
```

## After v1

Post-v1 work should be driven by real usage rather than expanding the architecture by default. Reasonable future work may include dependency-security upgrades, targeted UX improvements, larger real-world performance profiling, and additional research-domain modules.

None of those are required to call the current local-first product loop feature-complete once the release candidate passes sign-off.
