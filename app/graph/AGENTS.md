# Graph and timeline UI contract

This directory renders derived research-evolution views. Read `docs/RESEARCH_EVOLUTION.md` before changing graph/timeline behavior.

- Keep the existing force-directed **Research graph** available. Provenance and Timeline are complementary views, not replacements.
- Project scope comes from the selected stable research project ID and must be preserved in graph-view/filter navigation.
- Provenance edges are visualizations of already-resolved source, semantic, citation, or revision relationships. The UI must not manufacture missing semantic edges.
- Ambiguous/missing citation keys must remain visibly unresolved rather than being attached to a guessed research object.
- Semantic version lineages come only from explicit same-project `supersedes` edges. Display direction is oldest→newest even though stored edge direction is newer→older.
- Manuscript revision events come only from actual Git commits. Dirty working files are not revision events.
- Timeline chronology uses explicit note dates, validated experiment-run timestamps, and Git commit timestamps only.
- The version comparison panel compares explicit supersedes pairs only and must expose truncation when a bounded diff does not include the complete note bodies.
- Wide provenance SVG content must scroll inside its graph container. Never let it force document-level horizontal overflow on mobile/tablet.
- Interactive graph controls require keyboard access and visible focus. Touch/tablet remains first-class.
- Optional manuscript/citation/Git layers must fail soft. A missing manuscript or unavailable Git history must not take down the canonical research graph.

After changing this surface, verify all three `/graph` views at desktop, tablet portrait/landscape, and narrow mobile widths in addition to the focused evolution tests and `npm run verify:merge-local`.
