---
name: build-research-observer-ui
description: Implement or revise Observaire Next.js UI features such as the workbench, Markdown reader, PDF reader, evidence views, search, or Codex inspector. Use for application/UI work, not research-note authoring.
---

1. Read root `AGENTS.md` and `app/AGENTS.md`.
2. Reuse the canonical compiler/workspace model. Do not add an independent research parser.
3. Keep Server Components as the default; isolate browser-only behavior in focused Client Components.
4. Preserve the workbench information architecture and responsive behavior.
5. Treat PDF rendering and Codex as optional capabilities: a failure there must not break Notes/Overview.
6. Maintain keyboard accessibility, focus visibility, reduced motion behavior, and usable mobile controls.
7. Add regression coverage for parsing/content behavior where possible.
8. Do not add GitHub Actions.
9. Run `npm run check`; for deployment-oriented changes, run `npm run check:full`.
