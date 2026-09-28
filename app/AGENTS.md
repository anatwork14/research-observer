# Observaire Application Instructions

These instructions apply to application code under `app/` and complement the repository-root `AGENTS.md`.

## Architecture

- Next.js App Router and TypeScript are the application baseline.
- Markdown in `progress/` is the source of truth for indexed research objects. Do not add a second hand-maintained registry for notes, papers, evidence, or relationships.
- Durable PDF annotation sidecars live under the configured `annotationDir` (`annotations/` by default); they are not research Markdown and must not be folded into the research compiler as fake notes.
- Durable LaTeX/BibTeX authoring source lives under the configured `manuscriptsDir` (`manuscripts/` by default), project-scoped by stable project ID. Generated LaTeX build state belongs under `.research-observer/` and must remain rebuildable/transient.
- Consume the canonical research compiler in `lib/research/compiler.mjs` rather than independently rescanning/parsing research files in UI features.
- Generated browser assets belong under `public/_research/` and must remain reproducible.
- Do not rely on the deployed server having runtime access to the original `progress/` filesystem unless the feature is explicitly local/runtime-only and protected by the write/compile environment gates.

## Server/client boundaries

- Prefer Server Components for workspace collection and note pages.
- Use Client Components only where browser state or browser APIs are required: PDF rendering/annotation geometry, keyboard interactions, local preferences, LaTeX editing/preview, Codex interactive controls.
- Keep Node-only filesystem/process code out of Client Component dependency graphs.
- Filesystem mutation, LaTeX processes, annotation sidecar writes, citation-library writes, and SyncTeX calls must remain in Node-only libraries/API routes.

## Workbench UI

- Preserve the mode-aware shell: Overview, Projects, Insights, New Research, Notes, Papers, IDE, Evidence, Graph, Collections, Health, Instruction, Settings.
- Reading/editing surfaces should be visually solid and high-contrast; reserve glass/backdrop effects for lightweight chrome.
- Major controls need keyboard access and visible focus states.
- Keep pointer targets at least 24×24 CSS pixels unless spacing provides an equivalent target.
- Desktop rails must collapse gracefully; mobile controls must always provide a way to restore hidden context.
- Do not create a feature that only works at desktop width.
- Avoid Monaco as the required editor foundation because the application contract includes tablet/mobile use. Any richer editor layer must retain a functional touch/mobile fallback.

## PDF reader and annotations

- Use the local PDF.js/React-PDF runtime; do not depend on a public CDN for worker/cMaps/fonts/WASM.
- Render the active full-size page only; thumbnails are lazy.
- Preserve selectable text and the PDF annotation/text layers.
- Keep the extracted text view available as an accessible alternative.
- Paper routes use `/papers/[...path]?page=N`.
- Local PDF assets are generated into `public/_research/media/`.
- Never reintroduce a runtime route that reads arbitrary source files from `progress/`.
- User annotations use normalized page rectangles plus text quote context so zoom/responsive layout changes do not invalidate anchors.
- Annotation deletion is always a soft delete (`deletedAt`); UI wording should use Hide/Restore rather than implying physical deletion.
- Annotation sidecars use optimistic revision checks and atomic writes. Do not replace them with client-only state or destructive overwrite behavior.
- Structured annotation types are interpretation/reading aids. A `claim`, `evidence`, or similar annotation must not silently create strong research graph relationships or a durable evidence Markdown object.

## LaTeX IDE

- The IDE is project-scoped. A project ID resolves to `manuscripts/<project-id>/` (or the configured equivalent).
- Text sources support `.tex`, `.bib`, `.sty`, `.cls`, and `.bst`. Browser-editable saves must retain stale-write protection using a content hash.
- File removal in the IDE is soft-hide metadata in `.observaire-ide.json`; never unlink a manuscript source from the browser Hide action. Restore must recover the same file bytes.
- Compilation is local/server-side only and gated by `RESEARCH_OBSERVER_LATEX` in production. The rest of Observaire must work when a TeX toolchain is absent.
- Use `latexmk` as the compatibility build orchestrator and produce SyncTeX data (`-synctex=1`). Keep unrestricted shell escape disabled.
- Build products/cache/logs belong under `.research-observer/latex-builds/`; browser PDF copies under `public/_research/latex/` are generated artifacts, never source of truth.
- Source↔PDF navigation must use SyncTeX and validate that reverse-resolved source files remain inside the selected manuscript project.
- Build diagnostics should remain navigable to source when a safe project-relative filename/line is known.
- Do not compile arbitrary user-provided filesystem paths; resolve all requested source/build identifiers through the project-scoped path guards.
- Citation search is project-scoped and must reuse indexed `literature`/`evidence` metadata from the canonical research compiler. Do not add a parallel citation database.
- Citation insertion must never fabricate missing bibliography metadata. Keep incomplete candidates visible for review but non-insertable until authors/year/source identity are verified.
- `.bib` writes must reuse stale-safe manuscript APIs and deduplicate durable identities before appending. Prefer DOI, then source URL, then local PDF, then title/year.
- The current textarea citation insertion bridge is transitional UI glue. When replacing the editor surface, preserve the citation API/service and replace only the editor insertion adapter.

## Codex UI

- Codex context must be visible to the user as explicit chips/labels.
- Keep modes distinct: Ask (read-only), Draft (proposed changes), Act (explicitly approved workspace changes).
- Do not silently mutate research files from an Ask interaction.
- Writing modes must surface proposed files/diffs and validation results.
- If the local Codex backend is unavailable, the rest of Observaire must continue working normally.
- Future Codex manuscript editing should reuse the same stale-write/review principles rather than bypassing the IDE file guards.

## Persistence

- `progress/`, `annotations/`, and `manuscripts/` are durable user-authored state and must be host-persisted in Docker deployments.
- `.research-observer/` is transient/rebuildable application state and may live in the named Observaire state volume.
- Do not store the only copy of an annotation or manuscript inside a container layer or `public/_research/`.

## Validation

No GitHub Actions are assumed. Before finishing application changes, use the repository-local quality gate:

```bash
npm run check
```

For a deployment candidate:

```bash
npm run check:full
```

For PDF annotation / LaTeX IDE work, also verify at minimum:

- annotation create, hide, restore, edit, promote-to-evidence, and stale-revision behavior;
- manuscript create, save, stale-save rejection, hide, and restore;
- citation search, incomplete-metadata refusal, BibTeX creation/deduplication, and editor cursor insertion;
- missing-TeX-toolchain graceful degradation;
- successful `latexmk` PDF build with shell escape disabled;
- forward and reverse SyncTeX when the toolchain is installed;
- desktop plus touch/tablet layouts;
- Docker recreation preserves `progress/`, `annotations/`, and `manuscripts/`.
