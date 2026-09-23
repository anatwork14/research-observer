# Verification checklist — evidence, integrations, Direct Edit, graph, search, PDF UX, and AI contract

Run these release gates on `feature/evidence-integrations-settings` with Node 22.13+:

```bash
npm ci
npm run check
npm run build
```

Focused regression tests touched by this change:

```bash
node --test tests/consensus.test.mjs
node --test tests/consensus-citation.test.mjs
node --test tests/consensus-evidence.test.mjs
node --test tests/integration-settings.test.mjs
node --test tests/direct-edit.test.mjs
node --test tests/data-contract.test.mjs
node --test tests/graph-layout.test.mjs
```

## Browser checks — global navigation and responsive consistency

1. Test desktop, iPad/tablet landscape (~1024px), tablet portrait (~768px), and phone (~375–430px).
2. At widths below 1180px, confirm the workspace tabs move to their own horizontally scrollable row rather than colliding with the Observaire brand, Search, workspace controls, or theme toggle.
3. Confirm horizontal workspace tabs scroll smoothly by touch/trackpad and do not create page-level horizontal overflow.
4. At phone width, confirm collection headings/counts stack and long counts wrap rather than squeezing the title.
5. Toggle light/dark mode on Overview, a note reader, Graph, Evidence, Instruction, and Settings. Confirm no text, border, selected state, or badge loses contrast.
6. Test with browser storage blocked/unavailable. Theme, left/right rail, and focus controls must still operate for the current page without throwing; only persistence may be lost.

## Browser checks — Command Palette / search

1. Open the palette with Cmd/Ctrl+K and `/` while focus is outside an input.
2. While the full search index is still loading, confirm the visible fallback notes can already be navigated with ↑/↓ and opened with Enter.
3. With the full index available, confirm text search and `research:`, `project:`, `type:`, `status:`, and `tag:` filters behave as documented.
4. Temporarily make `/_research/search.json` unavailable. Confirm the palette displays a reduced-search notice and still searches/opens notes by title/status rather than becoming an empty broken surface.
5. Confirm Escape and backdrop click close the palette without navigating.

## Browser checks — integrations + Consensus evidence

1. Open **Settings**.
2. Verify the Consensus API key input is password-masked, a saved key is never echoed back, Test connection works, and clearing a workspace key removes only the local stored key.
3. Confirm Consensus ready/offline badges retain their pill layout and accent coloring rather than inheriting subtitle text styling.
4. With two tabs/windows saving a workspace Consensus key at nearly the same time, confirm Settings remains valid and no `.tmp` file is left under `.research-observer/`.
5. Start Codex **Sign in with ChatGPT**. Verify the device URL/code appear only after the click, successful authorization changes status to ready, and Disconnect delegates to Codex logout.
6. Search Consensus from a research note. Save a normal URL+DOI result and confirm it appears in **Evidence**, opens as an Observaire note, and links to the original source.
7. Test a DOI-only result. It must remain saveable; the result card and Evidence library should use `https://doi.org/<canonical-doi>` without producing malformed double DOI URLs.
8. If a provider record contains an insecure `http://` source URL but a valid DOI, confirm the insecure URL is discarded and the DOI remains the source path.
9. If a saved external record has only a provider paper ID, confirm Evidence visibly preserves that Paper ID and still opens the saved Observaire evidence object rather than pretending an external link exists.
10. Confirm a saved takeaway/abstract is labeled discovery context, while eligible returned full-text chunks are labeled evidence excerpts.
11. Confirm saving scholarly evidence never auto-creates `supports`, `contradicts`, `answers`, or other semantic relationships.

## Browser checks — New Research + Codex planning

1. Open **New Research** with Consensus configured and Codex signed out. Confirm Consensus can be ready while Codex planning clearly reports authorization required instead of pretending the SDK alone is sufficient.
2. After Codex sign-in, refresh New Research and confirm the planner reports ready from the same CLI-auth state used by Research Assist.
3. Search a packet containing normal URL+DOI papers and DOI-only papers. Every returned paper must have a distinct selection key and DOI-only titles must open through the canonical DOI URL.
4. Deselect/reselect DOI-only papers and confirm the selected count and literature packet remain correct.
5. Submit at least two papers to Codex planning and confirm returned source IDs map only to real provider IDs, DOI values, or HTTPS source URLs. Title-only records must be rejected rather than receiving invented `source-1` provenance.
6. If duplicate provider identities are supplied, confirm the server deduplicates them before planning so one paper cannot masquerade as multiple independent sources.
7. Confirm source trace cards with no external URL/DOI remain readable as static provenance cards rather than broken anchors.
8. Confirm Ask, New Research planning, and Act all use the same real Codex CLI authorization requirement and direct unauthenticated users to Settings → Codex.

## Browser checks — PDF reader + evidence capture

1. Open a local PDF on desktop and iPad/tablet. Select text with mouse, trackpad, touch selection handles, and pen where available.
2. Confirm selection updates from the browser selection state rather than requiring a mouse-only event, and the evidence toolbar remains usable after releasing a touch selection handle.
3. Use **Copy** and **Copy evidence** with normal Clipboard API access. Confirm the button changes to `Copied ✓`.
4. Repeat in a context where Clipboard API access is unavailable. Confirm fallback copying works or the pressed button shows `Copy failed` instead of silently doing nothing.
5. Confirm **Add evidence** preserves exact selected text, local PDF path, and positive page number, and that the saved object deep-links back to the correct PDF page.
6. Confirm **Ask Codex** carries the selection when present and otherwise uses the extracted current-page text; PDF source text remains explicitly marked untrusted in the server prompt boundary.
7. On coarse-pointer devices, confirm page/view controls, search controls, selection-bar actions, and inspector tabs meet the 44px interaction target.
8. At phone/tablet widths, confirm the selection toolbar wraps instead of covering the PDF, thumbnails scroll horizontally, and the inspector stacks below the page.

## Browser checks — Direct Edit

1. Open a research note and enable **Direct Edit**. Change Markdown and confirm Preview renders without modifying the live file.
2. Type a draft, wait for browser-local autosave, navigate to another Observaire route without saving the `.md`, return to the note, and confirm the same-source draft is recovered automatically.
3. Repeat but navigate away immediately after typing, before the 350ms autosave indicator updates. Confirm the component-unmount flush still restores the final keystrokes.
4. Save a browser draft, then change the source `.md` externally. Reopen Direct Edit and confirm the older draft is **not** silently applied; the UI must offer Restore for reconciliation or Discard old draft.
5. Restore an older draft for reconciliation and confirm Save is still impossible until a fresh diff/doctor review passes against the latest source.
6. Choose **Review changes** and inspect the patch/doctor output. Save must remain disabled when validation is blocked.
7. With a valid review, choose **Save to .md** and confirm the note updates, generated research artifacts refresh, and the browser-local draft is cleared rather than resurrected during route replacement.
8. Repeat the review, change the same `.md` file externally before Save, and confirm Observaire refuses the stale patch instead of overwriting the external edit.
9. Use Discard and disable Direct Edit with a dirty draft; confirm the source stays unchanged and discarded drafts do not recover later.
10. Confirm Direct Edit does not stage or commit the live Git index.
11. On phone/tablet, confirm editor tabs, recovery controls, review actions, and save buttons wrap cleanly and coarse-pointer targets remain at least 44px high.
12. Create/abandon enough Codex/Direct Edit review proposals to exercise cleanup. Confirm `.research-observer/codex-drafts` prunes proposal pairs older than seven days, caps retained metadata/patch pairs at 100, and removes orphan `.patch` files.

## Browser checks — Instruction / external AI handoff

1. Open **Instruction**.
2. Confirm the source list includes:
   - `AGENTS.md`
   - `docs/OBSERVAIRE_DATA_CONTRACT.md`
   - `docs/observaire-research-frontmatter.schema.json`
   - `research-observer.config.json`
   - `progress/AGENTS.md`
   - `.agents/skills/create-research-note/SKILL.md`
   - `docs/CHATGPT_WEB_RESEARCH_PROMPT.md`
3. Enter a topic in the **ChatGPT Web** topic field and confirm Preview replaces every `{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}` token.
4. Confirm the generated prompt also replaces `{{WORKSPACE_CONFIG}}` with the **current** `research-observer.config.json`, including current project IDs and vocabularies.
5. Confirm **Copy ready prompt** copies the generated prompt. Test a browser/context with Clipboard API unavailable and confirm fallback copy works or a visible manual-copy error appears rather than failing silently.
6. Confirm **Open ChatGPT** opens `https://chatgpt.com/` in a new tab.
7. Confirm **Copy complete LLM prompt** includes the canonical contract, machine-readable schema, and current workspace config, but does not recursively embed the ChatGPT Web helper template.
8. Confirm the generated ChatGPT prompt uses only configured project/type/status/relationship values and tells the model not to create `type: result` unless a real result exists.
9. Confirm root `AGENTS.md`, `progress/AGENTS.md`, the create-note skill, schema, contract, and workspace config all describe the same PDF/Consensus provenance shapes and the same body-link-vs-typed-relationship semantics.

## Browser checks — Graph

Test with enough linked notes to produce multiple clusters and both explicit relationships and ordinary Markdown links.

1. Open **Graph**. Confirm the canvas stays inside its panel and does not create horizontal page overflow.
2. Confirm solid links represent explicit typed `relationships`; dashed links represent ordinary Markdown references.
3. Hover a node. Its immediate neighborhood should remain emphasized while unrelated nodes/edges fade.
4. Select a node. Confirm the inspector lists its type/status/project and incoming/outgoing connections.
5. Drag a node. It should follow the pointer, remain within safe graph world bounds, and become pinned rather than snapping behind another node.
6. Drag empty graph space to pan. Lines and edge labels must not steal the pan gesture.
7. Use wheel / Zoom +/- to zoom.
8. Toggle **Local**, test Depth 1/2/3, and confirm each depth reveals only the corresponding neighborhood around the selected node.
9. Toggle Typed links, References, Labels, Arrows, and Physics independently.
10. Adjust Center, Repel, Link force, and Distance. Confirm the graph responds without nodes overflowing the bounded canvas.
11. Click **Fit** after moving/pinning nodes. All visible nodes should return inside the usable viewport; a perfectly centered graph must not produce unstable center-state behavior.
12. Click **Unpin all** and **Reset**. Confirm reset restores deterministic starting positions and clears saved pinned layout state.
13. Double-click a node or press Enter on a keyboard-focused node; confirm the research object opens.
14. At desktop widths, confirm control and inspector overlays stay independently scrollable and do not cover each other.
15. At tablet widths around 768–900px, confirm the control panel remains in the upper area and the inspector remains in the lower area without overlap.
16. At phone widths around 375–430px, confirm both overlays remain usable, internally scroll instead of overflowing the graph, and the status pill does not widen the page.
17. On coarse-pointer/touch devices, confirm graph controls and search fields have usable touch targets.
18. Test dark and light themes for readable node labels, link labels, selected states, and edge contrast.

Obsidian-inspired behaviors intentionally supported by this implementation include hover-neighborhood emphasis, click/open, pan/zoom, filtering, local graph depth, node-size-by-connectivity, arrows, and adjustable center/repel/link/distance forces. Observaire additionally distinguishes semantic typed edges from ordinary body references and supports persistent user pinning. Do not collapse those edge types into one undifferentiated backlink relation during future changes.

## Data-contract checks

`tests/data-contract.test.mjs` is a drift guard. If `research-observer.config.json` adds/removes a type, status, relationship vocabulary value, or project convention, update the human contract and ChatGPT Web prompt in the same change.

Research linking semantics to preserve:

- stable `id` = canonical identity;
- filename prefix = ordering only;
- body relative `.md` links = readable references + backlinks + weak `references` graph edges;
- frontmatter `relationships` = explicit semantic graph edges;
- relationship targets should prefer existing stable IDs;
- aliases may resolve older IDs/slugs to the canonical object;
- evidence provenance belongs in `source`;
- `source.kind: pdf` and `source.kind: consensus` are distinct supported provenance shapes;
- DOI is stored in canonical raw DOI form, not as a nested `https://doi.org/https://doi.org/...` URL;
- non-default project scope belongs in `research` and must use a configured project ID.

## Production gates

With production writes disabled, verify:

- Settings credential persistence remains read-only unless `OBSERVAIRE_SETTINGS_WRITES=1`;
- evidence writes and Direct Edit remain read-only unless `RESEARCH_OBSERVER_WRITES=1`;
- in-app Codex device authorization remains disabled unless `OBSERVAIRE_CODEX_AUTH_UI=1`;
- production Consensus always uses `https://api.consensus.app` regardless of development base-URL overrides.

Do not record a release as fully verified until `npm run check`, `npm run build`, and browser checks have executed against the exact commit being merged. A connected Vercel preview may be used for the browser layer only when its deployment metadata names this repository/branch/commit; never reuse a deployment from another project as verification evidence.
