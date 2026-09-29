# Research evolution graph and timeline

Observaire's research-evolution views are **derived projections** over existing durable sources. They do not introduce a new research database and must never become a second source of truth.

## Durable sources

The projection may read from four existing durable domains:

1. `progress/` — canonical research Markdown, typed relationships, dates, paper paths, experiment definitions and results.
2. `annotations/` — annotation sidecars. The evolution projection does not scan private sidecars directly for semantic graph edges; promoted evidence carries the durable annotation snapshot marker needed for public provenance.
3. `manuscripts/` — current LaTeX/BibTeX manuscript source used to resolve visible citation tokens.
4. Git history — optional committed manuscript revision history. Git commits are read-only history; they are not a replacement for manuscript source.

Generated `.research-observer/` and `public/_research/` data are never authoritative evolution sources.

## Projection layers

### Research layer

Canonical research objects become `research:<slug>` nodes. Existing compiler edges are preserved:

- explicit frontmatter relationships become semantic edges;
- explicit `supersedes` relationships become semantic-version edges;
- ordinary Markdown links remain weaker reference edges.

The projection must not upgrade a Markdown reference into `supports`, `contradicts`, `answers`, or another semantic relation.

### Paper and promoted-annotation provenance

Local paper paths become `paper:<path>` nodes.

A promoted PDF annotation is reconstructed only from the durable evidence snapshot written during promotion:

```text
Paper
  → annotated_as
Annotation snapshot
  → promoted_to
Evidence
```

The annotation snapshot may expose the stored annotation type, anchor kind, page, and reviewed region-source-text kind. Later edits to a private annotation sidecar do not rewrite this historical evidence snapshot.

An evidence object without an Observaire promotion marker may still have a direct paper `source_of` edge from its canonical `source.pdf` metadata.

### Citation and manuscript layer

Each visible `.tex` source is a manuscript node. Each citation token is an occurrence node rather than a global bibliography-key node because the same key may appear in several files or positions.

```text
Research object
  → cited_as
Citation occurrence
  → appears_in
Manuscript file
```

A research-to-citation edge is created **only** when the existing citation resolver returns exactly one canonical choice. `ambiguous` and `missing` citations remain visible health items and never gain guessed research edges.

Hidden manuscript files are excluded from live citation projection.

### Manuscript revision layer

Committed manuscript changes may become `revision:<project>:<commit>` nodes:

```text
Manuscript file
  → revised_in
Git commit
```

Revision history is optional and read-only. It is bounded to recent commits and path-confined to the selected manuscript project.

Current dirty/untracked manuscript files are reported separately. They are **not** presented as revisions because IDE save timestamps and filesystem mtimes are not semantic revision history.

If Git is unavailable or the manuscript has no committed history, the rest of the graph/timeline remains functional.

## Timeline semantics

Timeline chronology may use only:

- explicit research-note `date` values;
- validated experiment-run timestamps;
- actual Git commit timestamps for manuscript revisions.

Do not invent dates from file order, numeric filename prefixes, mtimes, IDE state timestamps, or graph layout positions.

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

Large comparisons stay bounded. The UI must disclose truncation and link to the full source objects.

## UI behavior

`/graph` has three complementary views:

1. **Research graph** — existing force-directed canonical research relationships.
2. **Provenance** — stable-lane source → annotation → research → citation → manuscript → revision trace.
3. **Timeline & versions** — explicit dated events, semantic version lineages, and explicit version-pair content comparison.

The existing research graph remains first-class. The provenance graph must not replace or mutate it.

The provenance SVG may be wider than a phone viewport, but horizontal scrolling must stay inside its component. It must not create document-level horizontal overflow.

## Project scoping

All evolution views are scoped by the selected stable research project ID.

- Research nodes must belong to the selected project.
- Semantic/reference edges whose endpoint leaves the selected project are excluded from the scoped evolution projection.
- Citation resolution uses the same selected project.
- Manuscript history is path-confined to that project's configured manuscript root.

Never silently merge similarly named objects from different research projects.

## Performance and safety bounds

- Manuscript Git history is bounded to 80 revisions.
- Research version source comparison is bounded to 240 lines per side.
- Citation resolution reuses the existing project-scoped citation service.
- No graph/timeline view writes Git history, research Markdown, manuscript source, annotations, or generated evidence.
- A missing optional projection source must degrade that layer only; it must not break the canonical research graph.

## Verification

At minimum, changes to this feature should verify:

```bash
node --test tests/research-evolution.test.mjs
node --test tests/research-version-lineage.test.mjs
node --test tests/research-version-compare.test.mjs
node --test tests/manuscript-evolution.test.mjs
GIT_CONFIG_GLOBAL=/dev/null npm run verify:merge-local
git diff --check
```

Browser verification should exercise `/graph` in all three modes on desktop, tablet, and narrow mobile widths and confirm:

- project isolation;
- existing force graph behavior is unchanged;
- promoted Figure/Table evidence shows paper → annotation → evidence provenance;
- uniquely resolved citations connect to manuscript files;
- ambiguous/missing citations do not gain guessed edges;
- manuscript commits appear only when real history exists;
- dirty manuscript files are not presented as revisions;
- `supersedes` chains read oldest → newest from edge direction;
- version diff selects only explicit same-project version pairs;
- graph scrollers do not create page-level horizontal overflow.
