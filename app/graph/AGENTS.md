# Graph and timeline UI contract

This directory renders derived research-evolution views. Read `docs/RESEARCH_EVOLUTION.md` before changing graph/timeline behavior.

- Keep the existing force-directed **Research graph** available. Provenance and Timeline are complementary views, not replacements.
- Project scope comes from the selected stable research project ID and must be preserved in graph-view/filter navigation.
- Provenance edges are visualizations of already-resolved source, semantic, citation, passage-location, or revision relationships. The UI must not manufacture missing semantic edges.
- Manuscript Passage nodes are literal saved `.tex` blocks around citation occurrences. They may display file/line/section and a bounded literal excerpt, but must never be relabeled or interpreted as semantic claims.
- Multiple citations in the same saved passage may share one Passage node. The direct citation→manuscript compatibility edge may remain alongside citation→passage→manuscript.
- Ambiguous/missing citation keys must remain visibly unresolved rather than being attached to a guessed research object. They may still expose literal saved-source location context.
- Semantic version lineages come only from explicit same-project `supersedes` edges. Display direction is oldest→newest even though stored edge direction is newer→older.
- Manuscript revision events come only from actual Git commits. Dirty working files are not revision events.
- Timeline chronology uses explicit note dates, validated experiment-run timestamps, and Git commit timestamps only. Date-only research metadata must remain the same calendar day in every viewer timezone.
- The version comparison panel compares explicit supersedes pairs only and must expose truncation when a bounded diff does not include the complete note bodies.
- Local PDF sources and stored external scholarly/Consensus sources may appear in the source lane, but the latter must come only from canonical verified identifiers already persisted with evidence.
- Passage/Citation `Open manuscript location` links must use the IDE's validated file/line navigation; hidden, missing, resource, unrelated-project, or otherwise invalid files must not be opened through provenance navigation.
- Wide provenance SVG content must scroll inside its graph container. Never let it force document-level horizontal overflow on mobile/tablet.
- Large provenance projections render a bounded working set (currently 90 nodes per lane). Search and selected-trace nodes receive priority. Do not silently imply that the bounded canvas is the complete underlying projection.
- Selecting a provenance node traces the enabled visible relationship graph up to six hops so a paper/evidence/citation/passage/manuscript/revision chain can be followed as one focus path. Layer toggles must change that trace rather than bypassing disabled layers.
- Interactive graph controls require keyboard access and visible focus. Touch/tablet remains first-class.
- Optional manuscript/citation/Git layers must fail soft. A missing manuscript or unavailable Git history must not take down the canonical research graph, and an unavailable scan must not be displayed as a factual zero.

After changing this surface, verify all three `/graph` views at desktop, tablet portrait/landscape, and narrow mobile widths in addition to the focused evolution tests and `npm run verify:merge-local`.
