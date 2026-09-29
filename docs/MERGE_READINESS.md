# Observaire merge-readiness verification

This document defines the verification sequence for the PDF annotation + LaTeX IDE feature branch. It is a test contract, not a statement that the branch has passed every item.

## 1. Local repository gate

Run:

```bash
npm run verify:merge-local
```

This performs the normal deployment-quality repository gate and the focused cross-domain acceptance flow.

Equivalent commands:

```bash
npm run check:full
npm run verify:workflow
```

`verify:workflow` uses isolated temporary workspaces and exercises the real durable service chain for both selectable-text evidence and reviewed visual-region evidence:

```text
local PDF
→ text annotation OR Area/Figure/Table region
→ reviewed quote OR reviewed caption/OCR/transcription
→ durable evidence note
→ verified literature metadata
→ deduplicated BibTeX record
→ citation token
→ bibliography source configuration
→ stale-safe manuscript save
→ citation token back to canonical literature/evidence
```

The visual-region flow must never substitute a comment for source text; only explicitly reviewed caption/OCR/transcription text is eligible for evidence promotion.

The fixture does not compile TeX. Compilation belongs to the toolchain gates below.

## 2. Independent TeX contract

Run:

```bash
npm run verify:latex:container
```

This uses a digest-pinned prebuilt TeX Live image with the repository mounted read-only. It verifies the external compiler/toolchain contract independently of Observaire's Docker image:

- `latexmk`;
- pdfLaTeX;
- XeLaTeX;
- LuaLaTeX;
- classic BibTeX;
- biblatex + Biber;
- forward and reverse SyncTeX;
- unrestricted shell escape remains disabled.

Passing this command does **not** prove Observaire's own Docker image or Node service integration.

## 3. Observaire Docker toolchain layer

Run:

```bash
npm run verify:latex:project-toolchain
```

This builds only the `latex-toolchain` Docker target from the repository Dockerfile. The stage has bounded Debian APT retries/timeouts and cache mounts so TeX installation is isolated from npm/application layers.

Passing this proves the exact system/TeX layer used by the Observaire app image can be built.

## 4. Observaire application-level LaTeX service

Run:

```bash
npm run verify:latex:project-app
```

This builds the repository `app` Docker target and launches the service verifier directly with Node inside that image. The verification container:

- has no Compose bind mounts or user research/manuscript volumes;
- is read-only except for an isolated `/tmp` tmpfs;
- has networking disabled;
- drops Linux capabilities and enables `no-new-privileges`;
- executes `scripts/verify-latex-toolchain.mjs` against an internal temporary Observaire workspace.

This is the authoritative compiler integration check because it exercises `compileLatexProject` and SyncTeX through the same Node service code used by the IDE, without npm cache writes or access to real user data.

## 5. Docker recreation and persistence

Run:

```bash
npm run verify:persistence
```

The verifier creates:

- a unique Compose project name;
- temporary host research, annotation, and manuscript directories;
- a uniquely named external state volume.

It builds and starts Observaire, checks the three durable bind mounts, writes a marker into `.research-observer/`, recreates the service without deleting the external state volume, and confirms all durable bytes plus the state-volume marker survive.

The verifier must never use or delete the normal `observaire-profile` volume. Cleanup targets only its randomly generated verification resources.

## 6. Full automated gate

When Docker is available and the network/toolchain layers are healthy, run:

```bash
npm run verify:merge-full
```

The command executes, in order:

```text
verify:merge-local
→ verify:latex:container
→ verify:latex:project-toolchain
→ verify:latex:project-app
→ verify:persistence
```

Any failed command means the automated merge gate is incomplete.

## 7. Required manual/browser gate

The automated commands do not replace browser verification. Before merge, verify at minimum:

- a real research PDF rather than only a synthetic fixture;
- annotation create/edit/Hide/Restore across reload and zoom;
- visual Area/Figure/Table drag with pointer and touch input;
- PDF replacement → stale anchor → explicit re-anchor;
- reviewed caption/OCR/transcription evidence flow;
- iPad/tablet landscape and portrait;
- narrow mobile layout;
- only one Editor/Codex/Citations auxiliary drawer is open at a time;
- the three narrow-screen launchers remain reachable above the sticky status bar/safe area;
- CodeMirror and plain-textarea fallback;
- citation source navigation;
- PDF preview and forward/reverse SyncTeX controls;
- Codex Act diff review with Apply/Discard controls reachable;
- file rail and hidden/restore controls remain reachable.

## 8. Merge-ready rule

Do not mark the feature branch merge-ready from `npm run check:full` alone.

A merge-ready decision requires:

1. `verify:merge-full` passes in a real Docker environment;
2. the browser/manual gate above has no unresolved correctness or data-loss defects;
3. `progress.md` records the exact commands, environment, results, and remaining non-blocking warnings;
4. no verification claim is made for a scenario that was not actually executed.
