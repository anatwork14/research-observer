# Explicit Claim ↔ Evidence relationships

Observaire Claim↔Evidence relationships are **explicit author-authored semantic statements** embedded in saved LaTeX source. They are not inferred from citations, prose wording, annotation polarity, AI interpretation, or graph proximity.

Read this document together with `docs/MANUSCRIPT_CLAIMS.md` and `docs/RESEARCH_EVOLUTION.md`.

## Why this contract exists

The manuscript provenance stack deliberately separates three different facts:

```text
Citation
  = this source is cited at this manuscript occurrence

Explicit Claim
  = this saved manuscript statement has an author-assigned identity

Claim ↔ Evidence relationship
  = the author explicitly states how one canonical Evidence object relates to one explicit Claim
```

None of those facts implies either of the others.

A nearby citation must never silently become `supports`. A sentence containing words such as “proves”, “contradicts”, or “supports” must never create graph semantics by itself.

## Syntax

A relationship is a standalone compile-safe LaTeX comment:

```tex
% observaire:claim robustness-under-drift
% observaire:claim-evidence robustness-under-drift supports evidence-robustness
Our method remains stable under distribution shift \cite{paper-key}.
```

The relationship directive contains exactly three tokens after `observaire:claim-evidence`:

```text
<claim-id> <relation> <evidence-slug>
```

No positional inference is used. The directive names both endpoints explicitly.

## Endpoint contract

### Claim endpoint

`<claim-id>` must:

- resolve to one valid explicit manuscript Claim in the selected manuscript project;
- use the Claim ID contract from `docs/MANUSCRIPT_CLAIMS.md`;
- not be missing, malformed, duplicated, or the reserved `claim-id` placeholder.

A relationship that references an invalid, missing, or duplicate Claim becomes a health issue and creates no semantic edge.

### Evidence endpoint

`<evidence-slug>` must resolve exactly to a canonical research object that:

- exists in the research workspace;
- belongs to the selected research project;
- has `type: evidence`.

The target uses the canonical research slug/ID, not a bibliography key, title guess, filename similarity, citation key, DOI lookup, or alias heuristic.

A Literature note is **not** automatically Evidence for this contract. If a paper should carry manuscript-Claim semantics, the research workflow should first create/promote the appropriate canonical Evidence object.

This preserves the distinction between “this paper exists/is cited” and “this reviewed evidence supports or contradicts this manuscript Claim.”

## Relationship vocabulary

The first supported vocabulary is intentionally small:

```text
supports
contradicts
contextualizes
qualifies
```

Direction is read as:

```text
Evidence supports Claim
Evidence contradicts Claim
Evidence contextualizes Claim
Evidence qualifies Claim
```

The derived provenance edge therefore points:

```text
Evidence → Explicit Claim
```

Other verbs such as `proves`, `confirms`, `refutes`, `answers`, or arbitrary free-text relationships are rejected in this contract rather than normalized or guessed.

Vocabulary expansion should be deliberate and separately reviewed.

## Graph model

A valid authored directive adds one derived edge:

```text
Canonical Evidence
  → supports|contradicts|contextualizes|qualifies
Explicit Claim
```

The edge layer is `claim-evidence`, separate from:

- canonical research semantic relationships;
- citation relationships;
- Passage→Claim structure;
- source provenance;
- version/revision relationships.

This separation allows the Provenance UI to toggle authored Claim semantics independently.

A full provenance graph may therefore contain both:

```text
Evidence → Citation → Passage → Claim
```

and:

```text
Evidence → supports → Claim
```

These are different facts. The citation path does not create the semantic edge, and the semantic edge does not fabricate a citation occurrence.

## Duplicate directives

Repeating the exact same triple:

```text
<claim-id> <relation> <evidence-slug>
```

creates at most one derived graph edge.

Every duplicate occurrence is still surfaced as relationship health so authors can remove redundant metadata. Observaire does not silently multiply graph edges.

Different explicitly authored relation types between the same endpoints remain distinct. The system does not decide that the author “must have meant” one of them.

## Invalid and unresolved relationships

Relationship health distinguishes:

- malformed directive;
- invalid Claim ID token;
- unsupported relationship type;
- invalid Evidence slug token;
- missing/invalid/duplicate Claim endpoint;
- missing Evidence target;
- cross-project Evidence target;
- target that exists but is not `type: evidence`;
- duplicate exact relationship.

Invalid or unresolved relationships remain visible in Provenance Trace health with manuscript file/line context. They create no semantic edge.

## Project isolation

Claim IDs and manuscript files are scoped to the selected manuscript/research project.

Evidence targets must belong to the same selected research project. A canonical slug that belongs to another project is rejected even if it exists globally.

No cross-project Claim↔Evidence edge is allowed in this first contract.

## Saved-source semantics

Claim↔Evidence directives are read from visible editable saved `.tex` sources only.

Therefore:

- unsaved browser edits do not enter provenance;
- hidden sources do not contribute live Claim relationships;
- restoring a source restores its saved relationships;
- Git history remains revision history, not relationship truth;
- no separate relationship database or sidecar is created.

## IDE authoring helper

The LaTeX editor command palette includes **Insert Claim ↔ Evidence relation**.

With no explicit Claim ID selection it inserts:

```tex
% observaire:claim-evidence claim-id supports evidence-slug
```

and selects `claim-id`.

If the researcher explicitly selects a valid Claim ID before running the command, that selected ID may be reused and `evidence-slug` becomes the selected placeholder.

Both placeholders are deliberately invalid as durable relationship endpoints. The active editor reports advisory syntax diagnostics until they are replaced.

The helper uses `supports` only as an editable explicit template default. The researcher remains responsible for choosing the correct relationship type and Evidence slug before saving.

The helper never inspects prose/citations to choose Evidence or relationship meaning.

## What must never be inferred

Do not create or rewrite Claim↔Evidence semantics from:

- citation occurrence;
- bibliography key;
- same paragraph/section;
- PDF annotation type;
- positive/negative language;
- words such as “supports”, “proves”, or “contradicts” in prose;
- Consensus/provider answers;
- AI classifications or summaries;
- metric direction or experiment outcome;
- graph distance;
- source title/author/year similarity.

AI may help an author **review or draft** a proposed directive in a future review workflow, but durable semantics must still require an explicit authored/reviewed directive.

## Verification

Focused verification should include:

```bash
node --test tests/manuscript-claim-relations.test.mjs
node --test tests/manuscript-claim-relation-collision.test.mjs
node --test tests/manuscript-claim-evidence-projection.test.mjs
node --test tests/latex-editor-tools.test.mjs
node --test tests/latex-claim-anchor-ui.test.mjs
```

Browser verification should confirm:

- editor insertion in CodeMirror and plain editor;
- placeholders surface advisory warnings;
- valid relationship appears only after save;
- valid Evidence→Claim edge uses the selected project;
- Literature/non-Evidence targets are rejected;
- cross-project targets are rejected;
- missing/duplicate Claims are rejected;
- duplicate exact directives produce one edge plus health issues;
- prose/citations without a directive produce no Claim↔Evidence edge;
- the Claim↔Evidence layer toggle hides only authored semantic edges;
- mobile/tablet graph containment remains intact;
- Research Graph and Timeline do not need this manuscript relationship scan.
