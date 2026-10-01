# Graph and timeline UI contract

This directory renders derived research-evolution views. Read `docs/RESEARCH_EVOLUTION.md` before changing graph/timeline behavior, `docs/MANUSCRIPT_CLAIMS.md` before changing explicit manuscript Claim behavior, `docs/CLAIM_EVIDENCE_RELATIONS.md` before changing authored Claim↔Evidence semantics, and `docs/CLAIM_EVIDENCE_REVISION_HISTORY.md` before changing historical Claim/Evidence comparison.

- Keep the existing force-directed **Research graph** available. Provenance and Timeline are complementary views, not replacements.
- Project scope comes from the selected stable research project ID and must be preserved in graph-view/filter navigation.
- Provenance edges are visualizations of already-resolved source, semantic, citation, passage-location, explicit-claim, authored Claim↔Evidence, or revision relationships. The UI must not manufacture missing semantic edges.
- Manuscript Passage nodes are literal saved `.tex` blocks around citation occurrences and/or explicit Claim anchors. They may display file/line/section and a bounded literal excerpt, but must never be relabeled or interpreted as semantic claims.
- Explicit manuscript Claim nodes exist only when the author writes a valid unique `% observaire:claim <id>` marker in saved visible editable `.tex` source.
- Claim nodes must remain visually and semantically distinct from canonical research nodes whose role happens to be `claim`.
- Claim structure may show only `Passage → anchors_claim → Claim → part_of → Manuscript` unless a valid explicit Claim↔Evidence directive separately authorizes a semantic edge.
- Authored Claim↔Evidence edges exist only for strict `% observaire:claim-evidence <claim-id> <relation> <evidence-slug>` directives whose Claim and canonical same-project `type:evidence` target both validate in the live projection.
- Keep the authored Claim↔Evidence graph layer independently toggleable from canonical research semantics, citations, and Claim structure.
- Never infer Claim↔Evidence meaning from citation proximity, prose wording, annotation type, AI interpretation, or graph distance.
- Duplicate, invalid, orphan, malformed, unresolved, cross-project, and non-Evidence endpoints stay visible as health issues; do not guess or auto-correct them.
- Multiple citations in the same saved passage may share one Passage node. Citation and Claim layers referring to the same block must converge on the same Passage identity.
- Ambiguous/missing citation keys must remain visibly unresolved rather than being attached to a guessed research object. They may still expose literal saved-source location context.
- Semantic version lineages come only from explicit same-project `supersedes` edges. Display direction is oldest→newest even though stored edge direction is newer→older.
- Manuscript revision events come only from actual Git commits. Dirty working files are not revision events.
- Historical Claim/Evidence snapshots live only in **Timeline & versions** in the first implementation. Research Graph and Provenance must not load historical Claim snapshots merely to render.
- Historical Claim snapshots use committed `.tex` bytes plus the committed manuscript visibility state for that revision. Current dirty editor state must remain visibly separate.
- A historical Claim↔Evidence directive proves what the manuscript explicitly authored at that commit. Current canonical Evidence resolution is only a present-day annotation; never present it as historical endpoint validation.
- Historical Claim identity is exact authored Claim ID. Do not infer Claim renames from similar prose or adjacent revisions.
- A `relation-changed` event is valid only for an unambiguous one-old/one-new relation change on the same exact Claim/Evidence endpoints. Ambiguous many-to-many changes remain additions/removals.
- Base/Compare/Claim history controls remain URL-backed with `claimBase`, `claimCompare`, and `claimHistory`. They filter/compare already-loaded snapshots and must not create hidden client history state.
- Do not deep-link historical Claim line numbers into the current IDE as if those lines necessarily still existed. Current-canonical Evidence may link to the current research object; unresolved historical slugs remain literal historical text.
- Timeline chronology uses explicit note dates, validated experiment-run timestamps, and Git commit timestamps only. Date-only research metadata must remain the same calendar day in every viewer timezone.
- The version comparison panel compares explicit supersedes pairs only and must expose truncation when a bounded diff does not include the complete note bodies.
- Local PDF sources and stored external scholarly/Consensus sources may appear in the source lane, but the latter must come only from canonical verified identifiers already persisted with evidence.
- Passage/Citation/Claim `Open manuscript location` links must use the IDE's validated file/line navigation; hidden, missing, resource, unrelated-project, or otherwise invalid files must not be opened through provenance navigation.
- Wide provenance SVG content must scroll inside its graph container. Never let it force document-level horizontal overflow on mobile/tablet.
- Large provenance projections render a bounded working set (currently 90 nodes per lane). Search and selected-trace nodes receive priority. Do not silently imply that the bounded canvas is the complete underlying projection.
- Selecting a provenance node traces the enabled visible relationship graph up to seven hops so a paper/evidence/citation/passage/claim/manuscript/revision chain can be followed as one focus path. Layer toggles must change that trace rather than bypassing disabled layers.
- Interactive graph controls require keyboard access and visible focus. Touch/tablet remains first-class.
- Optional manuscript/citation/claim/Git layers must fail soft. A missing manuscript or unavailable optional scan must not take down the canonical research graph, and an unavailable scan must not be displayed as a factual zero.

After changing this surface, verify all three `/graph` views at desktop, tablet portrait/landscape, and narrow mobile widths in addition to the focused evolution tests and `npm run verify:merge-local`.
