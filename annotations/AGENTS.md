# PDF annotation sidecars

This directory is durable Research Observer source data. It is not generated browser output.

- Annotation JSON files are managed by `lib/research/pdf-annotations.mjs`; do not hand-edit them while the app is running.
- A PDF annotation is a structured record, not paint burned into the PDF. Preserve its stable `id`, semantic `type`, page, anchor kind, text quote context when available, normalized page rectangles, comments, tags, timestamps, and revision metadata.
- Text and visual-region anchors are both first-class. Region annotations (`area`, `figure`, `table`) may intentionally have an empty quote; never fabricate text for a visual region.
- New anchors are bound to the actual source PDF SHA-256. Listing compares the saved anchor fingerprint with the current PDF and exposes `current`, `stale`, or `legacy` status.
- A changed PDF must not silently move old annotations. Stale/legacy anchors require explicit re-anchoring. Re-anchoring records the former page/quote/rectangles/fingerprint in bounded `anchorHistory` before replacing the active anchor.
- Do not implement automatic fuzzy re-anchoring as a destructive write. A future fuzzy matcher may propose candidates/confidence, but applying a new anchor must remain reviewable and preserve history.
- Page-text hashes/indexes are secondary text-anchor hints. Geometry and document fingerprints remain independent so scanned/image regions still work.

## Region source text

- Visual source text is separate from the annotation comment. Store reviewed region text in `sourceText`, never in `comment` or a fabricated `quote`.
- `sourceText.kind` is explicit: `caption`, `ocr`, or `transcription`.
- Saving region source text records its SHA-256, verification timestamp, current anchor page, and current document SHA-256.
- `sourceTextHistory` preserves superseded/review-invalidated source text. Do not silently overwrite or discard previous reviewed text.
- Re-anchoring a region invalidates its current source-text verification (`reviewRequired: true`). The user must explicitly review/save it again against the new geometry before it can support a new evidence promotion.
- Do not treat raw/unreviewed OCR as verified evidence. OCR text becomes eligible only after the user explicitly saves/reviews it in the annotation UI.
- A source-text edit against a stale/legacy geometry must never make that stale anchor promotable; evidence promotion still requires an anchor bound to the current PDF.

## Lifecycle and evidence

- Deleting an annotation in the UI is always a soft delete. Set `deletedAt`; never physically remove the annotation record for a normal user delete action. Restoring clears `deletedAt`.
- Keep annotation sidecars project-scoped and bound to their source PDF path. A sidecar must never be allowed to escape the configured `annotationDir`.
- Mutations use optimistic revision checks and atomic writes. Do not bypass those mechanisms with ad-hoc filesystem writes.
- Promoting an annotation to research evidence is an explicit user action. Promotion creates a normal durable `type: evidence` Markdown note through the existing evidence writer; an annotation label such as `evidence`, `claim`, or `limitation` must never automatically create a semantic research relationship.
- A new promotion requires a `current` anchor. Stale and legacy annotations must be explicitly re-anchored first.
- Region-only annotations require reviewed `sourceText` before promotion. Their user comment is interpretation and must never be substituted as source evidence.
- Promoted evidence records preserve a human-readable `Observaire source annotation` marker containing the stable annotation ID. Text promotion also preserves the document fingerprint; region promotion additionally preserves source-text kind/hash/verification metadata.
- Promotion must remain idempotent: retries resolve to the existing evidence object instead of generating duplicates.
- Existing promoted evidence is a provenance snapshot. If its source annotation later becomes stale, is re-anchored, hidden, or edited, do not silently mutate/delete that evidence note.
- Do not copy this directory into `public/_research`; annotations may contain private research comments.
- Schema v2 remains backward-readable from v1 sidecars. Future schema changes need an explicit version/migration path rather than rejecting or silently rewriting existing records.
