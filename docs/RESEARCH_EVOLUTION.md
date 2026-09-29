# Research evolution graph and timeline

Observaire's research-evolution views are **derived projections** over existing durable sources. They do not introduce a new research database and must never become a second source of truth.

## Durable sources

The projection may read from four existing durable domains:

1. `progress/` — canonical research Markdown, typed relationships, dates, paper paths, experiment definitions and results.
2. `annotations/` — annotation sidecars. The evolution projection does not scan private sidecars directly for semantic graph edges; promoted evidence carries the durable annotation snapshot marker needed for public provenance.
3. `manuscripts/` — current saved LaTeX/BibTeX manuscript source used to resolve visible citation tokens and literal passage context.
4. Git history — optional committed manuscript revision history. Git commits are read-only history; they are not a replacement for manuscript source.

Generated `.research-observer/` and `public/_research/` data are never authoritative evolution sources.

## Projection layers

### Research layer

Canonical research objects become `research:<slug>` nodes. Existing compiler edges are preserved:

- explicit frontmatter relationships become semantic edges;
- explicit `supersedes` relationships become semantic-version edges;
- ordinary Markdown links remain weaker reference edges.

The projection must not upgrade a Markdown reference into `supports`, `contradicts`, `answers`, or another semantic relation.

### Local paper and promoted-annotation provenance

Canonical local paper asset paths become `paper:<path>` nodes. Folder-backed project context is part of that identity, so `Alpha Study/papers/source.pdf` and `Beta Study/papers/source.pdf` remain distinct sources even when their note-relative frontmatter values are both `papers/source.pdf`.

A promoted PDF annotation is reconstructed only from the durable evidence snapshot written during promotion:

```text
Local PDF
  → annotated_as
Annotation snapshot
  → promoted_to
Evidence
```

The annotation snapshot may expose the stored annotation type, anchor kind, page, and reviewed region-source-text kind. Later edits to a private annotation sidecar do not rewrite this historical evidence snapshot.

An evidence object without an Observaire promotion marker may still have a direct paper `source_of` edge from its canonical `source.pdf` metadata.

### Reviewed external scholarly provenance

Reviewed Consensus/external scholarly evidence can also expose a source node when canonical evidence metadata already contains a durable identifier.

Identity precedence is:

1. normalized DOI;
2. provider paper ID;
3. canonical HTTPS URL.

The node ID is a stable hash of that already-stored identity. DOI identity takes precedence so a changed provider URL does not split one verified paper into several source nodes.

```text
External scholarly source
  → source_of
Evidence
```

This is provenance only. Saving or displaying an external paper must never manufacture `supports`, `contradicts`, `answers`, or another semantic research relationship.

### Citation, passage, and manuscript layer

Each visible `.tex` source is a manuscript node. Each citation token is an occurrence node rather than a global bibliography-key node because the same key may appear in several files or positions.

A manuscript passage is a **derived literal saved-source block** around one or more citation occurrences. It is not durable state and is never a semantic claim. The passage projection may expose only structural/source facts such as:

- source file;
- source start/end offsets;
- line span;
- nearest explicit LaTeX heading;
- a bounded literal excerpt from the saved `.tex` block.

Comment-only lines and a preceding heading command are excluded from the prose excerpt when the citation is on a later line; the heading remains separate metadata. Multiple citations in the same saved paragraph/block deduplicate to one Passage node.

```text
Research object
  → cited_as
Citation occurrence
  → located_in
Manuscript passage
  → part_of
Manuscript file
```

The historical direct compatibility edge also remains:

```text
Citation occurrence
  → appears_in
Manuscript file
```

A research-to-citation edge is created **only** when the existing citation resolver returns exactly one canonical choice. `ambiguous` and `missing` citations may still have literal passage/file/line context, but they never gain a guessed research edge.

Passage extraction must not infer that nearby prose supports, contradicts, proves, answers, or otherwise semantically relates to the cited research object. If semantic claim-level links are added in the future, they require an explicit durable user-authored contract separate from passage extraction.

Hidden manuscript files are excluded from live citation and passage projection.

### Manuscript deep links

Citation and Passage nodes may link to:

```text
/ide?research=<project>&file=<saved-source>&line=<positive-line>
```

The IDE may honor the location only when the requested file is present in the selected manuscript workspace, editable, and not hidden. Invalid, hidden, missing, or resource-file requests fall back to the normal manuscript entry file rather than bypassing workspace path/visibility rules.

The navigation uses the same `openFile` plus editor-cursor path already used by diagnostics and reverse SyncTeX. It must not add a DOM-click automation path or bypass stale-safe manuscript reads.

### Manuscript revision layer

Committed manuscript changes may become `revision:<project>:<commit>` nodes:

```text
Manuscript file
  → revised_in
Git commit
```

Revision history is optional and read-only. It is bounded to recent commits and path-confined to the selected manuscript project. Git history parsing disables rename detection so rename commits remain visible as bounded add/delete source paths instead of becoming parser-specific rename syntax.

Current dirty/untracked manuscript files are reported separately. They are **not** presented as revisions because IDE save timestamps and filesystem mtimes are not semantic revision history.

A Git repository with no first commit yet is still a valid working tree: the revision layer reports zero committed revisions while preserving dirty/untracked manuscript files. If Git itself is unavailable, the revision layer degrades without breaking the rest of the graph/timeline.

## Timeline semantics

Timeline chronology may use only:

- explicit research-note `date` values;
- validated experiment-run timestamps;
- actual Git commit timestamps for manuscript revisions.

Do not invent dates from file order, numeric filename prefixes, mtimes, IDE state timestamps, or graph layout positions.

Research-note `date` values are calendar dates, not instants. The UI must render them as the same calendar day in every viewer timezone. Run and Git timestamps are real instants and may be localized for display.

The monthly activity strip is a visualization of these events, not a research-quality score.

## Semantic version semantics

Research versions are created only by an explicit same-project relationship:

```yaml
relationships:
  - type: supersedes
    target: earlier-version-id
```

The stored direction is:

```text
newer → supersedes → older
```

The UI displays lineages in the reverse reading direction:

```text
older → newer
```

Ordering follows the relationship graph. Dates and numeric order may break ties between independent branches, but they must not override `supersedes` direction.

Cross-project `supersedes` edges remain visible in the canonical research graph but are excluded from semantic-version comparison.

Cycles are invalid as meaningful version history. The UI must surface a cycle warning rather than pretending there is a valid oldest/newest chain.

## Version comparison

A version comparison is allowed only for a concrete explicit `supersedes` edge in the same project.

The comparison may show:

- word-count delta;
- added/removed headings;
- bounded added/removed source lines;
- links to both canonical research objects.

The diff is a convenience view over the two current durable Markdown objects. It does not reconstruct historical Git snapshots of research Markdown and should not be described as doing so.

Large comparisons stay bounded to 240 source lines per side. The UI must disclose truncation and link to the full source objects.

## Provenance trace interaction

Selecting a node in the provenance graph highlights a bounded neighborhood over the currently enabled layers. The UI uses six hops, sufficient for the passage-aware intended chain:

```text
Paper/source
  → Annotation snapshot
  → Evidence/research object
  → Citation occurrence
  → Manuscript passage
  → Manuscript file
  → Revision
```

Traversal is cycle-safe and treats a provenance path as navigational context, not as a new semantic assertion. Disabling a layer removes those edges from the selected trace.

The inspector lists direct visible connections while canvas emphasis may extend across the bounded multi-hop trace. Passage inspectors may show the literal bounded excerpt and source location; they must not relabel the excerpt as a claim.

## UI behavior

`/graph` has three complementary views:

1. **Research graph** — existing force-directed canonical research relationships.
2. **Provenance** — stable-lane source → annotation → research → citation → passage → manuscript → revision trace.
3. **Timeline & versions** — explicit dated events, semantic version lineages, manuscript commit events, and explicit version-pair content comparison.

The existing research graph remains first-class. The provenance graph must not replace or mutate it.

The default Research graph view does not scan manuscript citations or Git history merely to render its header. Optional manuscript/Git layers are loaded only when a view needs them. If one of those scans fails, the UI says that it is unavailable rather than reporting a factual zero.

The provenance SVG may be wider than a phone viewport, but horizontal scrolling must stay inside its component. It must not create document-level horizontal overflow.

Large projections use a visual working-set budget of 90 rendered nodes per lane. The underlying derived projection stays complete. Selected-trace nodes, direct search matches, and high-connectivity nodes receive display priority, and lane labels disclose shown/total counts. Search is the way to narrow a large complete projection rather than removing the safety bound.

## Project scoping

All evolution views are scoped by the selected stable research project ID.

- Research nodes must belong to the selected project.
- Semantic/reference edges whose endpoint leaves the selected project are excluded from the scoped evolution projection.
- Citation and passage resolution use the same selected project.
- Manuscript history is path-confined to that project's configured manuscript root.
- Local paper identity retains the canonical project-folder asset path.

Never silently merge similarly named objects, manuscript paths, or note-relative assets from different research projects.

## Performance and safety bounds

- Manuscript Git history is bounded to 80 revisions.
- Research version source comparison is bounded to 240 lines per side.
- Citation resolution reuses the existing project-scoped citation service and scans visible editable `.tex` files only.
- Passage excerpts are bounded literal strings derived from the same saved `.tex` snapshot used for citation resolution.
- Provenance rendering is bounded to 90 nodes per lane.
- Selected UI trace traversal is bounded to six hops; the reusable helper clamps callers to at most 12.
- Provenance scrolling has a bounded viewport even when the SVG working set is tall.
- No graph/timeline view writes Git history, research Markdown, manuscript source, annotations, or generated evidence.
- A missing optional projection source must degrade that layer only; it must not break the canonical research graph.

## Verification

At minimum, changes to this feature should verify:

```bash
node --test tests/research-evolution.test.mjs
node --test tests/research-evolution-consensus.test.mjs
node --test tests/research-evolution-trace.test.mjs
node --test tests/research-evolution-layout.test.mjs
node --test tests/research-evolution-passages.test.mjs
node --test tests/manuscript-passages.test.mjs
node --test tests/latex-provenance-navigation.test.mjs
node --test tests/research-version-lineage.test.mjs
node --test tests/research-version-compare.test.mjs
node --test tests/manuscript-evolution.test.mjs
node --test tests/manuscript-history.test.mjs
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
git diff --check
```

Browser verification should exercise `/graph` in all three modes on desktop, tablet, and narrow mobile widths and confirm:

- project isolation;
- existing force graph behavior is unchanged;
- nested-project local PDF paths remain distinct;
- promoted Figure/Table evidence shows paper → annotation → evidence provenance;
- saved Consensus evidence shows verified external source → evidence provenance without a fabricated semantic edge;
- uniquely resolved citations connect to literal manuscript passage context and manuscript files;
- multiple citations in one saved paragraph deduplicate to one Passage node;
- ambiguous/missing citations retain literal location context but do not gain guessed research edges;
- Passage inspector text is a literal bounded saved-source excerpt, not an AI summary or claim;
- Passage/Citation `Open manuscript location` opens the requested visible editable `.tex` source at the requested line in both CodeMirror and plain-editor modes;
- hidden manuscript sources do not become reachable through provenance deep links;
- manuscript commits appear only when real history exists;
- dirty manuscript files are not presented as revisions, including a Git repository before its first commit;
- renamed manuscript source remains represented in revision history;
- `supersedes` chains read oldest → newest from edge direction even when dates are missing or misleading;
- date-only research events do not shift calendar day with timezone;
- version diff selects only explicit same-project version pairs;
- selected source/evidence nodes highlight the complete enabled passage-aware provenance trace;
- large synthetic projections disclose the render budget and remain searchable;
- graph scrollers do not create page-level horizontal overflow.
