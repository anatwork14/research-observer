# Explicit manuscript claim anchors

Observaire manuscript Claims are **explicit author-authored identities** embedded in saved LaTeX source. They are not extracted, summarized, classified, or inferred by AI.

For explicit authored semantics between Claims and canonical Evidence, also read `docs/CLAIM_EVIDENCE_RELATIONS.md`.

## Syntax

A claim anchor is a standalone LaTeX comment placed before the prose passage it identifies:

```tex
% observaire:claim robustness-under-drift
Our method remains stable under distribution shift \cite{smith2025}.
```

The comment is compile-safe and does not change the rendered manuscript.

The IDE command palette includes **Insert Observaire claim anchor**. It inserts:

```tex
% observaire:claim claim-id
```

and selects `claim-id` for replacement. `claim-id` is intentionally reserved and invalid as a durable claim ID, so saving the placeholder produces an advisory health warning rather than silently creating a generic claim.

## ID contract

Claim IDs:

- are authored by the researcher;
- use lowercase kebab-case;
- begin with a lowercase letter;
- contain only lowercase letters, digits, and hyphens;
- are at most 80 characters;
- must be unique within the selected manuscript project;
- must not use the reserved `claim-id` placeholder.

Examples:

```text
robustness-under-drift
primary-generalization-result
ablation-removes-gain
claim2
```

Invalid examples:

```text
Claim-Two
claim_two
claim id
claim-id
```

Observaire never auto-renames a duplicate or malformed claim ID.

## Passage attachment

The anchor attaches to the next substantive saved LaTeX prose passage.

Blank lines, comment-only lines, other Observaire claim markers, and standalone section/structural commands may occur between the marker and prose. The nearest explicit LaTeX heading remains structural metadata for the Claim/Passage; it is not part of the claim ID.

The derived projection stores only source facts:

- claim ID;
- marker line;
- source file;
- passage start/end offsets;
- passage line range;
- nearest explicit LaTeX heading;
- bounded literal passage excerpt.

No durable Claim database is created. Moving or editing the saved source rebuilds passage location from the current manuscript bytes while the explicit claim ID remains the author's stable semantic handle.

## Provenance model

A Claim node is created only for one valid, unique explicit anchor.

```text
Citation occurrence
  → located_in
Passage
  → anchors_claim
Explicit Claim
  → part_of
Manuscript
```

The existing research/citation provenance may therefore produce:

```text
Paper/source
  → Annotation
  → Evidence/research object
  → Citation
  → Passage
  → Explicit Claim
  → Manuscript
  → Revision
```

The provenance UI uses a seven-hop selected trace to cover this full path.

A Claim may exist without any citation. In that case Observaire still shows the explicit Claim and its Passage, but it does **not** invent an Evidence/Research relationship.

Multiple explicit Claim IDs may deliberately anchor the same Passage. They remain separate Claim nodes that share one literal Passage identity.

## Claim identity is not Claim ↔ Evidence semantics

A Claim anchor identifies a manuscript claim. By itself it does not state that any nearby research object:

- supports the Claim;
- contradicts the Claim;
- contextualizes the Claim;
- qualifies the Claim;
- confirms or proves the Claim.

Citation proximity is not semantic relationship metadata.

Observaire must never create those relationships from prose wording, citation occurrence, AI interpretation, polarity, or passage position.

Claim↔Evidence semantics now have a **separate explicit contract**:

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift supports evidence-robustness
Our method remains stable under distribution shift.
```

That directive names both endpoints explicitly and is validated separately. See `docs/CLAIM_EVIDENCE_RELATIONS.md`.

A valid relationship is derived independently of the citation path:

```text
Canonical Evidence
  → supports|contradicts|contextualizes|qualifies
Explicit Claim
```

The existence of this edge does not fabricate a citation, and a citation does not fabricate this edge.

## Duplicate, invalid, and orphan anchors

Project-level claim scanning reports issues instead of guessing.

### Duplicate

The same Claim ID occurs more than once among the scanned manuscript sources.

Result:

- no Claim node is created for that ID;
- all duplicate occurrences are reported in Trace health;
- no occurrence is silently selected as canonical;
- authored Claim↔Evidence relationships referencing that duplicate Claim remain unresolved and create no semantic edge.

### Invalid ID

The marker does not contain exactly one valid ID, or contains the reserved `claim-id` placeholder.

Result:

- no Claim node;
- advisory editor diagnostic when detectable in the active file;
- project-level Trace health issue.

### Orphan

A valid marker has no following substantive passage.

Result:

- no Claim node;
- advisory editor diagnostic;
- project-level Trace health issue.

Cross-file duplicate detection is a project-level check. The lightweight active-editor diagnostics intentionally remain file-local and advisory.

## Hidden files

Live Claim projection scans visible editable `.tex` manuscript sources, matching the live citation-projection boundary. Hidden sources are excluded from the live graph and re-enter projection after Restore.

Claim↔Evidence directives in hidden files are excluded by the same live projection boundary.

Hide remains non-destructive and preserves source bytes.

## Navigation

Claim nodes link back to the selected manuscript project using the existing guarded IDE navigation contract.

Only visible editable saved source files can be opened from provenance deep links. Path traversal, hidden files, resources, missing files, and sibling-project paths must never bypass normal manuscript workspace guards.

## UI behavior

The Provenance view has a dedicated **Explicit claims** lane and structural relationship toggle between Passage and Manuscript. Authored Claim↔Evidence relationships use their own independent graph layer toggle.

Claim nodes expose:

- explicit ID;
- source file;
- anchor line;
- passage line range;
- section context;
- literal bounded passage excerpt;
- manuscript deep link.

The 90-node-per-lane rendering budget applies to Claims exactly as it does to other provenance lanes. Search and selected-trace priority must continue to work without removing the bound.

## Editor behavior

The claim-anchor palette command is an editor transform only. It:

1. inserts a LaTeX comment immediately above the active line;
2. selects the reserved `claim-id` placeholder;
3. does not save automatically;
4. does not create graph state until the source is saved and re-projected;
5. does not alter compilation semantics.

The editor also provides an **Insert Claim ↔ Evidence relation** template command. That command writes only explicit placeholders/default syntax and never chooses Evidence or relationship meaning from manuscript prose or citations.

Malformed/orphan Claim anchors and malformed Claim↔Evidence syntax may surface as lightweight advisory editor diagnostics. Canonical target/project/type validation remains project-level. `latexmk` remains authoritative for LaTeX build correctness.

## Verification

Focused Claim verification should include:

```bash
node --test tests/manuscript-claims.test.mjs
node --test tests/manuscript-claim-projection.test.mjs
node --test tests/manuscript-claim-relations.test.mjs
node --test tests/manuscript-claim-relation-collision.test.mjs
node --test tests/manuscript-claim-evidence-projection.test.mjs
node --test tests/research-evolution-claims.test.mjs
node --test tests/latex-claim-anchor-ui.test.mjs
node --test tests/latex-editor-tools.test.mjs
```

Browser verification should confirm:

- command-palette Claim and Claim↔Evidence insertion in CodeMirror and plain editor;
- placeholder warnings before replacement;
- Claim lane appears only in Provenance;
- unique Claim IDs produce one Claim node;
- duplicate IDs produce health issues and no guessed Claim node;
- an uncited Claim remains visible without an inferred research edge;
- Citation and Claim projections converge on one shared Passage node;
- valid explicit Claim↔Evidence directives connect only same-project canonical Evidence objects;
- Literature/citation proximity without a directive creates no Claim semantic edge;
- full Paper→Annotation→Evidence→Citation→Passage→Claim→Manuscript→Revision trace still works;
- disabling the Claims structural layer or Claim↔Evidence semantic layer changes only the relevant edges;
- Claim deep links stay project/path/visibility confined;
- mobile/tablet graph containment remains intact.
