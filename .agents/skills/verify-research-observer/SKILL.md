---
name: verify-research-observer
description: End-to-end verification protocol for Research Observer when an agent has npm/network access and a browser or deployment sandbox. Use before marking a feature PR ready or merging a release candidate.
---

# Verify Research Observer

Use this skill when asked to verify Research Observer, validate a PR/branch, close a build gap, test the PDF reader, or confirm Codex integration.

This repository intentionally does **not** rely on GitHub Actions. Verification is local or performed in an available deployment/browser sandbox.

## Goal

Produce evidence for all of these layers:

1. dependency resolution and reproducibility,
2. research compiler / doctor,
3. unit tests,
4. TypeScript,
5. ESLint,
6. Next.js production build,
7. browser/runtime smoke tests,
8. PDF reader behavior when a PDF fixture/source exists,
9. Codex availability boundaries without unsafe workspace mutation.

Do not claim a layer passed unless you actually executed it.

## 0. Establish the exact revision

Before installing anything:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
node --version
npm --version
```

Expected project baseline:

- Node: `>=22.13 <25`
- npm: package manager version declared in `package.json`
- feature/release branch: the branch requested by the task

If the worktree already contains unrelated user changes, do not discard them. Record them and avoid destructive cleanup.

## 1. Install dependencies

If `package-lock.json` exists:

```bash
npm ci
```

If no lockfile exists:

```bash
npm install
```

Then immediately run:

```bash
npm install --package-lock-only
git diff -- package.json package-lock.json
```

Rules:

- Do not use `--legacy-peer-deps`, `--force`, or `--ignore-scripts` just to make installation pass unless the task specifically requires investigating those modes.
- Do not downgrade pinned packages to hide an incompatibility.
- If the repository had no lockfile and installation succeeds, the generated `package-lock.json` is a legitimate reproducibility artifact. Report it and commit it only when working on the requested feature branch.
- A second clean install from the generated lockfile should succeed with `npm ci` before calling dependency resolution verified.

Record:

- install command,
- exit code,
- npm warnings/errors,
- whether optional Codex platform packages installed,
- whether `npm ci` succeeds from the resulting lockfile.

## 2. Run the repository quality gate

Run individually first so failures are attributable:

```bash
npm run doctor
npm test
npm run typecheck
npm run lint
npm run build
```

Then run the composite gate:

```bash
npm run check:full
```

Every command must exit 0 for a full PASS.

Do not edit generated files under `public/_research/` by hand. They are compiler output.

If `npm run doctor` reports errors, fix source research/configuration rather than weakening doctor behavior.

If `npm run typecheck` or `npm run lint` fails, fix source code rather than adding broad suppressions.

If `npm run build` fails, capture the complete relevant Next.js error and route/module involved.

## 3. Verify generated research artifacts

After a successful build/compile, confirm:

```bash
test -f public/_research/manifest.json
test -f public/_research/search.json
test -f public/_research/pdfjs/pdf.worker.min.mjs
test -d public/_research/pdfjs/cmaps
test -d public/_research/pdfjs/standard_fonts
test -d public/_research/pdfjs/wasm
```

Inspect the manifest/search output enough to confirm:

- entries exist,
- no compiler errors are recorded,
- note slugs/IDs are stable,
- referenced assets are copied.

Do not commit `public/_research/`.

## 4. Start the development server

Start Research Observer with Codex disabled first so the ordinary reader is tested independently:

```bash
RESEARCH_OBSERVER_CODEX=0 npm run dev -- --hostname 127.0.0.1
```

Use a real browser automation tool when available. Do not treat “server started” as browser verification.

At minimum visit:

- `/`
- `/progress`
- one real `/progress/<slug>`
- `/papers`
- `/evidence`
- `/graph`
- `/collections`
- `/health`
- `/instruction`

For the new research-system routes also confirm:

- Graph renders typed edges and a relation filter without browser-console errors.
- Collections query syntax filters deterministic fields and saved collection links work.
- Health counts/lists are factual and link back to affected notes.
- Instruction displays `AGENTS.md`, `progress/AGENTS.md`, and the create-note skill; both copy actions work.

For each route confirm:

- HTTP/page load succeeds,
- page body contains meaningful content,
- no Next.js error overlay,
- no uncaught browser-console errors,
- global navigation works,
- theme/keyboard controls do not throw,
- mobile-width layout remains usable.

Record screenshots for at least Overview, a note reader, and Papers.

## 5. Browser smoke-test the note reader

On a real note:

- open the note,
- use next/previous navigation when available,
- verify the outline anchors scroll/navigate,
- open the command palette with Cmd/Ctrl+K,
- search for a known note,
- navigate to a result,
- test focus/rail controls,
- reload and verify no hydration/error overlay appears.

Confirm a first H1 is only hidden when it duplicates the note title; a different meaningful H1 must remain visible.

## 6. PDF reader verification

If the repository already contains a real PDF under `progress/`, use it.

If there is no PDF, create a **temporary, uncommitted verification fixture** under `progress/papers/` plus a temporary literature note that references it. Use a valid small PDF generated locally. Never fabricate bibliographic metadata; label the fixture clearly as a verification fixture.

Run the compiler/doctor after adding the fixture.

Open the paper through `/papers/<path>` and verify:

- PDF renders through React-PDF/PDF.js,
- local worker loads from `/_research/pdfjs/pdf.worker.min.mjs`,
- no public CDN dependency is required,
- previous/next page works,
- page-number input works,
- zoom works,
- rotation works,
- thumbnails render lazily,
- text layer is selectable,
- Text inspector extracts current-page text,
- Search finds known fixture text and navigates to the hit page,
- page deep link `?page=N` opens the expected page,
- “open original PDF” works,
- selecting text exposes **Add evidence**,
- Add evidence creates a real ordered `type: evidence` Markdown note in local development,
- the created note records source PDF/page and appears in Evidence/Graph/Health as appropriate,
- invalid/missing relationship targets are rejected,
- production evidence writes are disabled unless explicitly enabled,
- Agent tab opens without crashing even when Codex is disabled,
- related-note link appears for the companion literature note.

Check browser network/console for 404s involving:

- worker,
- cMaps,
- standard fonts,
- WASM,
- generated media.

After the test, remove the temporary source fixture and rerun the compiler so the worktree returns to its prior state.

## 7. Codex boundary verification

### 7.1 Runtime presence

With dependencies installed, confirm both packages exist at matching versions:

```bash
node -e "console.log(require('@openai/codex/package.json').version)"
node -e "console.log(require('@openai/codex-sdk/package.json').version)"
```

They must match the versions pinned in `package.json`.

Start the dev server normally. Visit a note and inspect Codex status.

If Codex authentication is not configured, “offline/unavailable” is acceptable **only if the ordinary app remains fully functional**.

### 7.2 Ask / Draft

When local Codex authentication is available:

- Ask must answer without changing the working tree.
- Draft must propose text without changing the working tree.

Before and after each test:

```bash
git status --short
```

No new source changes should appear.

Attempting a cross-origin POST to the Codex API should be rejected.

### 7.3 Act

Act is intentionally stricter.

Before Act:

```bash
git status --short progress
```

The research tree must be clean.

Test with a harmless disposable research-note change. Verify:

- proposal is generated in a detached worktree,
- only `progress/**` paths are accepted,
- any `AGENTS.md` change is rejected,
- non-research file change is rejected,
- binary proposal is non-applicable,
- >120 KB proposal is non-applicable,
- doctor result is visible,
- exact text diff is visible before Apply,
- Apply requires explicit user action,
- proposal patch hash is checked before apply,
- overlapping live edits cause Apply rejection,
- post-apply doctor failure rolls the patch back.

Do not test Act on valuable uncommitted research.

## 8. Production-mode smoke test

After `npm run build` passes:

```bash
npm start
```

Visit the same core routes in a browser.

Expected Codex behavior in production currently:

- embedded Codex reports disabled/unavailable,
- Overview / Notes / Papers / Evidence / PDF reading continue to function.

Check for production-only hydration, asset, and route errors.

## 9. Do not “fix” tests by weakening guarantees

Forbidden verification shortcuts include:

- disabling strict TypeScript,
- adding broad `any` casts solely to silence unknown failures,
- skipping ESLint categories,
- suppressing compiler diagnostics globally,
- removing same-origin checks,
- loosening Codex path policy,
- allowing Codex to edit `AGENTS.md`,
- removing proposal hash verification,
- bypassing the research doctor,
- changing Act to edit the live tree first,
- switching PDF.js worker to a public CDN merely because local assets failed,
- marking a failed browser route as “not important.”

Diagnose the actual failure.

## 10. Required report format

Return this exact structure:

```text
Research Observer verification
Revision: <branch> @ <full SHA>
Node: <version>
npm: <version>

Dependency install: PASS | FAIL
npm ci reproducibility: PASS | FAIL | NOT APPLICABLE
Research doctor: PASS | FAIL
Unit tests: PASS | FAIL
TypeScript: PASS | FAIL
ESLint: PASS | FAIL
Next production build: PASS | FAIL
Generated PDF.js runtime: PASS | FAIL
Browser overview: PASS | FAIL
Browser note reader: PASS | FAIL
Browser papers collection: PASS | FAIL
PDF reader: PASS | FAIL | SKIP (reason)
Evidence capture: PASS | FAIL | SKIP (reason)
Typed graph: PASS | FAIL
Smart collections: PASS | FAIL
Research health: PASS | FAIL
Instruction tab: PASS | FAIL
Codex Ask/Draft boundary: PASS | FAIL | SKIP (reason)
Codex Act boundary: PASS | FAIL | SKIP (reason)
Production smoke test: PASS | FAIL

Commands run:
- <exact command>
- ...

Failures found:
- <failure, exact error, affected file/route>

Fixes made:
- <commit SHA> <description>

Browser evidence:
- <route> — <result> — <screenshot path/link if available>

Remaining uncertainty:
- <only things not actually executed>
```

Never convert a SKIP into PASS.

## 11. Completion criterion

A feature PR may be called **fully verified** only when:

- dependency install succeeds,
- a clean `npm ci` succeeds when a lockfile exists/was generated,
- `npm run check:full` succeeds,
- core routes pass browser smoke testing,
- PDF integration is tested if the PR changes PDF code,
- Codex safety boundaries are tested if the PR changes Codex code.

If some environment-specific test cannot run, report **PARTIAL**, name the exact missing capability, and still execute every other available layer.
