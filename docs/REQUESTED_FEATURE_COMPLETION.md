# Requested feature completion

This note records the implementation and verification boundary for the Research Observer work requested around Research Assist, analytics, revision history, multi-research work, and tablet/mobile behavior.

## Completion scope

The requested user-facing feature scope is complete when all five areas below are present without introducing a second data model or weakening the existing provenance rules.

### 1. Consensus and Codex Research Assist

The existing Research Assist surface is the canonical home for both integrations.

- `ConsensusCitationPanel` supports contextual query helpers, cancellable search, result/error/empty states, source links, citation copying, and saving a result as Evidence.
- `CodexPanel` supports Ask, Draft, and Act modes, contextual scope chips, isolated-worktree proposals, validation/review gates, diff review, apply, dismiss, retry, and error states.
- Research Assist controls retain keyboard focus treatment and coarse-pointer touch targets instead of introducing desktop-only controls.

No parallel replacement panel is required; the implemented Research Assist surface is the maintained integration point.

### 2. Graph-heavy statistics

`Insights` is the portfolio analytics surface and intentionally reuses the canonical compiled research index. It includes reusable visualizations for:

- horizontal distributions;
- donut/status composition;
- dated activity lines;
- research pipeline composition;
- per-project composition;
- health heatmaps;
- cross-project relationship matrices.

Wide SVG charts and matrices are contained by internal horizontal scrolling so they do not create document-level overflow on narrow viewports.

### 3. Research and manuscript version differences

Version history is covered at two complementary levels.

Research-level evolution includes:

- `ResearchEvolutionTimeline` for chronological events and lineage browsing;
- `ResearchVersionCompare` for explicit version-to-version metrics, heading changes, and textual diffs;
- the existing version explorer/lineage model for navigating authored versions.

Manuscript Claim↔Evidence history includes:

- bounded adjacent-revision activity bars;
- selected-pair event composition;
- Event type × revision heatmap;
- Claim × revision heatmap;
- exact Base → Compare drill-down;
- strict AND filtering for authored Claim, Evidence, event, and relation identities.

Heat intensity and bar length always represent explicit event counts. They are not quality, confidence, importance, or research scores.

### 4. Multiple research tracks at the same time

`Insights` accepts the canonical comma-separated `research` scope and renders portfolio/cross-project views over several research projects simultaneously.

The global research context exposes that capability directly:

- Insights can select several projects or the implicit all-project portfolio;
- the selected set remains URL-backed through the existing `research=a,b,c` convention;
- navigation back to Insights preserves the complete project set;
- single-project workspaces deterministically receive the first selected project rather than accidentally receiving a comma-separated scope they cannot interpret.

This preserves one URL/data contract instead of introducing a competing multi-project state model.

### 5. Responsive iPad/tablet/mobile behavior

The relevant workbench surfaces use responsive structural fallbacks and coarse-pointer interaction rules.

- Research scope menus are viewport-bounded, internally scrollable, and bottom-anchored on narrow screens.
- Scope controls use a 44 px minimum coarse-pointer target.
- Evolution timeline controls, events, and lineage/version controls use a 44 px minimum coarse-pointer target.
- Version-compare selectors and version cards use touch-sized controls.
- Manuscript revision heatmaps stay inside their own horizontal scroll containers with sticky row identity where appropriate.
- Research Assist Consensus/Codex controls retain their existing touch-safe targets.

## Regression coverage

Focused coverage exists for the relevant contracts, including:

- Consensus and Evidence integration tests;
- Codex scope/recovery/worktree tests;
- analytics tests;
- research evolution/version comparison/lineage tests;
- Claim↔Evidence history and activity matrix tests;
- multi-project workspace-scope tests;
- responsive coarse-pointer regression checks.

## Release verification

The application-code checkpoint `b2f0c95b6c7744e145bde86f9124f0c727de4244` received full repository and browser verification in an isolated worktree. Subsequent merge-preparation hygiene changed only documentation/CI metadata, not application runtime code.

Repository gates:

- `npm test`: PASS — 285/285 tests;
- typecheck: PASS;
- lint: PASS with two pre-existing warnings;
- production build: PASS;
- `npm run check:full`: PASS;
- research doctor: 0 errors, one ignored `AGENTS.md` warning;
- production dependency audit (`npm audit --omit=dev`): 0 vulnerabilities.

Browser sign-off covered Overview, Analytics, Claims, Timeline, workspace navigation, New Research, multi-project scope, version comparison, and manuscript history at representative desktop, iPad/tablet, and mobile viewports from 1440×900 down to 390×844. No unintended page-level horizontal overflow remained on the audited surfaces.

Multi-project scope was verified across seven viewport sizes, including add/remove behavior, URL persistence after refresh, and viewport-bounded menus. Version comparison selected the intended Base/Compare revisions and rendered the expected diff. Manuscript-history QA used a temporary local-only Git fixture covering all nine revision event types and all four supported relations; strict AND filtering and exact revision/Claim drill-down behavior were verified. The fixture was not pushed and was cleaned up after testing.

Consensus browser QA covered loading, results, empty, error/retry, selection, citation copy, and Evidence save flows. Codex's local-development-only/offline frontend state was verified responsively; the authenticated Codex backend was not exercised because no local authenticated agent service was configured.

Final browser observations at the application-code checkpoint:

- runtime/page errors: 0;
- hydration errors: 0;
- unhandled promise failures observed: 0;
- unexpected failed requests: 0.

The repository does not rely on a GitHub Actions workflow for this sign-off; verification was performed in a real checkout plus browser automation.

## Completion statement

Within the requested scope above, there is no remaining known user-facing feature gap. The feature branch has completed code verification and browser sign-off and is ready for final code review / merge preparation. Future work may still refactor internals or add unrelated product capabilities, but those are outside this feature-completion boundary.
