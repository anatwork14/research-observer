# Observaire Application Instructions

These instructions apply to application code under `app/` and complement the repository-root `AGENTS.md`.

## Architecture

- Next.js App Router and TypeScript are the application baseline.
- Markdown in `progress/` is the source of truth. Do not add a second hand-maintained registry for notes, papers, evidence, or relationships.
- Consume the canonical research compiler in `lib/research/compiler.mjs` rather than independently rescanning/parsing research files in UI features.
- Generated browser assets belong under `public/_research/` and must remain reproducible.
- Do not rely on the deployed server having runtime access to the original `progress/` filesystem.

## Server/client boundaries

- Prefer Server Components for workspace collection and note pages.
- Use Client Components only where browser state or browser APIs are required: PDF rendering, keyboard interactions, local preferences, Codex interactive controls.
- Keep Node-only filesystem/process code out of Client Component dependency graphs.

## Workbench UI

- Preserve the mode-aware shell: Overview, Notes, Papers, Evidence.
- Reading surfaces should be visually solid and high-contrast; reserve glass/backdrop effects for lightweight chrome.
- Major controls need keyboard access and visible focus states.
- Keep pointer targets at least 24×24 CSS pixels unless spacing provides an equivalent target.
- Desktop rails must collapse gracefully; mobile controls must always provide a way to restore hidden context.
- Do not create a feature that only works at desktop width.

## PDF reader

- Use the local PDF.js/React-PDF runtime; do not depend on a public CDN for worker/cMaps/fonts/WASM.
- Render the active full-size page only; thumbnails are lazy.
- Preserve selectable text and annotation layers.
- Keep the extracted text view available as an accessible alternative.
- Paper routes use `/papers/[...path]?page=N`.
- Local PDF assets are generated into `public/_research/media/`.
- Never reintroduce a runtime route that reads arbitrary source files from `progress/`.

## Codex UI

- Codex context must be visible to the user as explicit chips/labels.
- Keep modes distinct: Ask (read-only), Draft (proposed changes), Act (explicitly approved workspace changes).
- Do not silently mutate research files from an Ask interaction.
- Writing modes must surface proposed files/diffs and validation results.
- If the local Codex backend is unavailable, the rest of Observaire must continue working normally.

## Validation

No GitHub Actions are assumed. Before finishing application changes, use the repository-local quality gate:

```bash
npm run check
```

For a deployment candidate:

```bash
npm run check:full
```
