# PDF Region Evidence V2

PDF Intelligence V2 closes the provenance gap between private PDF annotation geometry and canonical Evidence.

## Goal

A figure, table, area, or text selection can already be anchored to a PDF page in an annotation sidecar. Before this change, promotion preserved the page, PDF identity, source text, and annotation marker but not the normalized page geometry. That meant the exact reviewed visual region remained dependent on the mutable private sidecar.

The V2 contract makes promotion review-first and freezes spatial provenance into the canonical Evidence Markdown itself.

## Review-first flow

The PDF reader keeps annotation creation/re-anchoring as working-state operations. An annotation becomes eligible for reviewed Evidence only when:

- it is not hidden;
- its anchor is current for the present PDF document hash;
- a text anchor contains at least three selected characters; or
- a region anchor has reviewed caption/OCR/transcription text attached to the current page/document anchor.

The annotation drawer exposes a **Reviewable Evidence** section. A user selects an eligible annotation, inspects the page-region map and exact Markdown, then explicitly chooses **Apply reviewed Evidence**.

The legacy promotion mutation remains available for compatibility/regression coverage, but it is not the default PDF reader action.

## Immutable promotion snapshot

Canonical Evidence keeps the normal compiler-visible PDF source contract:

```yaml
source:
  kind: pdf
  pdf: papers/source.pdf
  page: 5
```

The Evidence body also contains a fenced machine-readable block:

````markdown
```observaire-pdf-annotation-v1
{
  "schemaVersion": 1,
  "annotationId": "ann-...",
  "annotationType": "figure",
  "anchorKind": "region",
  "page": 5,
  "rects": [
    { "x": 0.16, "y": 0.22, "width": 0.64, "height": 0.42 }
  ],
  "documentSha256": "..."
}
```
````

For reviewed region text, the snapshot also records source-text kind, SHA-256, verification time, and the document/page against which that text was reviewed. Annotation tags may be retained as descriptive provenance.

Coordinates are normalized to the PDF page and rounded to six decimal places. The snapshot is authored into canonical Evidence bytes. It is not reconstructed from the current private annotation sidecar.

## Historical boundary

After Apply:

- later annotation comments may change;
- the annotation may be retyped;
- a region may be re-anchored;
- source text may be re-reviewed;
- a sidecar may eventually be hidden or removed.

None of those private working-state changes rewrite the already-created Evidence snapshot. The Evidence page renders **Spatial provenance** from the canonical Markdown snapshot only.

This preserves the existing invariant that private annotation-sidecar changes cannot silently rewrite historical Evidence provenance.

## Preview and stale protection

Preview is read-only and returns:

- annotation revision;
- PDF document SHA-256;
- canonical workspace signature;
- exact Evidence filename/content;
- SHA-256 proposal hash;
- normalized geometry snapshot.

Apply rebuilds the proposal and rejects the reviewed action when any of these changed:

- annotation revision;
- PDF document bytes;
- canonical research workspace;
- exact generated proposal.

The destination is confined to the compiler research root, uses exclusive creation, recompiles canonical research state, and removes the new Evidence file if it introduces validation errors.

## Production write policy

`GET /api/papers/annotations/evidence` reports whether Apply is enabled.

Preview remains available in production read-only mode. Apply requires the same explicit local write opt-in used elsewhere:

```text
RESEARCH_OBSERVER_WRITES=1
```

Mutation requests are same-origin only.

## Trust boundary

This feature does not add automatic OCR or AI interpretation.

- OCR/transcription text is durable only after the user reviews it against the current region.
- The annotation comment remains interpretation, separate from source text.
- Region type (`figure`, `table`, `area`) is authored annotation metadata, not computer vision classification.
- No `supports`, `contradicts`, `answers`, Claim relationship, confidence score, or scientific conclusion is inferred from geometry or source text.
- Executable/raw embed payloads are rejected from promoted Evidence text.

## UI

The review surface shows:

- normalized page miniature with exact rectangles;
- page, annotation type, anchor kind, and rectangle count;
- reviewed source-text provenance when present;
- exact canonical Markdown;
- PDF/document and proposal hash prefixes;
- explicit Apply/Discard.

After Apply, the canonical Evidence note shows a **Spatial provenance** sidebar card with the same frozen region and a link back to the exact PDF page.

## Verification

Focused verification should cover:

1. region preview writes no durable source bytes;
2. exact normalized rectangles round-trip through the fenced snapshot parser;
3. reviewed Apply creates compiler-indexed PDF Evidence;
4. later sidecar edits cannot change the saved Evidence snapshot;
5. stale annotation revision, changed PDF bytes, workspace changes, and changed proposals reject Apply;
6. region promotion without reviewed source text is rejected;
7. text-selection Evidence still works through the reviewed flow;
8. production read-only mode allows Preview but disables Apply;
9. the PDF drawer no longer exposes one-click promotion as the default action;
10. the canonical Evidence page renders the spatial snapshot at desktop/tablet/mobile widths.
