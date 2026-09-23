# Verification checklist — evidence, integrations, Direct Edit, graph, and AI contract

Run these gates on `feature/evidence-integrations-settings` with Node 22.13+:

```bash
npm ci
npm run check
npm run build
```

Focused regression tests added by this change:

```bash
node --test tests/consensus-evidence.test.mjs
node --test tests/integration-settings.test.mjs
node --test tests/direct-edit.test.mjs
node --test tests/data-contract.test.mjs
node --test tests/graph-layout.test.mjs
```

## Browser checks — integrations + Direct Edit

1. Open **Settings**.
2. Verify Consensus API key input is password-masked, a saved key is never echoed back, Test connection works, and clearing a workspace key removes only the local stored key.
3. Start Codex **Sign in with ChatGPT**. Verify the device URL/code appear only after the click, successful authorization changes status to ready, and Disconnect delegates to Codex logout.
4. Open a research note and search Consensus. Save one result. Confirm it appears in **Evidence**, opens as a saved Observaire note, and links to the original paper/DOI.
5. Confirm a saved takeaway/abstract is labeled discovery context, while eligible returned full-text chunks are labeled evidence excerpts.
6. Open a research note and enable **Direct Edit**. Change Markdown and confirm Preview renders without modifying the file.
7. Choose **Review changes** and inspect the patch/doctor output. Save must remain disabled when validation is blocked.
8. With a valid review, choose **Save to .md** and confirm the note updates and generated research artifacts refresh.
9. Repeat the review, change the same `.md` file externally before Save, and confirm Observaire refuses the stale patch instead of overwriting the external edit.
10. Confirm Direct Edit does not stage or commit the live Git index.

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
3. Enter a topic in the **ChatGPT Web** topic field and confirm Preview replaces every `{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}` token without changing the version-controlled template.
4. Confirm **Copy ready prompt** copies the generated prompt and **Open ChatGPT** opens `https://chatgpt.com/` in a new tab.
5. Confirm **Copy complete LLM prompt** includes the canonical contract, machine-readable schema, and current workspace config, but does not recursively embed the ChatGPT Web helper template.
6. Check that the generated ChatGPT prompt does not invent a non-default `research` project and tells the model to avoid `type: result` unless a real result exists.

## Browser checks — Graph

Test with enough linked notes to produce multiple clusters and both explicit relationships and ordinary Markdown links.

1. Open **Graph**. Confirm the canvas stays inside its panel and does not create horizontal page overflow.
2. Confirm solid links represent explicit typed `relationships`; dashed links represent ordinary Markdown references.
3. Hover a node. Its immediate neighborhood should remain emphasized while unrelated nodes/edges fade.
4. Select a node. Confirm the inspector lists its type/status/project and incoming/outgoing connections.
5. Drag a node. It should follow the pointer, remain within safe graph world bounds, and become pinned rather than snapping behind another node.
6. Drag empty graph space to pan. Use wheel / Zoom +/- to zoom.
7. Toggle **Local**, test Depth 1/2/3, and confirm each depth reveals only the corresponding neighborhood around the selected node.
8. Toggle Typed links, References, Labels, Arrows, and Physics independently.
9. Adjust Center, Repel, Link force, and Distance. Confirm the graph responds without nodes overflowing the bounded canvas.
10. Click **Fit** after moving/pinning nodes. All visible nodes should return inside the usable viewport.
11. Click **Unpin all** and **Reset**. Confirm reset restores deterministic starting positions and clears saved pinned layout state.
12. Double-click a node or press Enter on a keyboard-focused node; confirm the research object opens.
13. At desktop widths, confirm control and inspector overlays stay independently scrollable and do not cover each other.
14. At tablet widths around 768–900px, confirm the control panel remains in the upper area and the inspector remains in the lower area without overlap.
15. At phone widths around 375–430px, confirm both overlays remain usable, internally scroll instead of overflowing the graph, and the status pill does not widen the page.
16. Test dark and light themes for readable node labels, link labels, selected states, and edge contrast.

Obsidian-inspired behaviors intentionally supported by this implementation include hover-neighborhood emphasis, click/open, pan/zoom, filtering, local graph depth, node-size-by-connectivity, arrows, and adjustable center/repel/link/distance forces. Observaire additionally distinguishes semantic typed edges from ordinary body references and supports persistent user pinning. Do not collapse those edge types into one undifferentiated backlink relation during future changes.

## Data-contract checks

`tests/data-contract.test.mjs` is a drift guard. If `research-observer.config.json` adds/removes a type, status, or relationship vocabulary value, update the human contract and ChatGPT Web prompt in the same change.

Research linking semantics to preserve:

- stable `id` = canonical identity;
- filename prefix = ordering only;
- body relative `.md` links = readable references + backlinks + weak `references` graph edges;
- frontmatter `relationships` = explicit semantic graph edges;
- relationship targets should prefer existing stable IDs;
- aliases may resolve older IDs/slugs to the canonical object;
- evidence provenance belongs in `source`;
- non-default project scope belongs in `research` and must use a configured project ID.

Production gates should also be checked with writes disabled: Settings credential persistence, evidence writes, and Direct Edit should remain read-only unless their explicit environment opt-ins are configured.
