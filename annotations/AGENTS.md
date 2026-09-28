# PDF annotation sidecars

This directory is durable Research Observer source data. It is not generated browser output.

- Annotation JSON files are managed by `lib/research/pdf-annotations.mjs`; do not hand-edit them while the app is running.
- A PDF annotation is a structured record, not paint burned into the PDF. Preserve its stable `id`, semantic `type`, page, anchor kind, text quote context when available, normalized page rectangles, comments, tags, timestamps, and revision metadata.
- Text and visual-region anchors are both first-class. Region annotations (`area`, `figure`, `table`) may intentionally have an empty quote; never fabricate text for a visual region.
- New anchors are bound to the actual source PDF SHA-256. Listing compares the saved anchor fingerprint with the current PDF and exposes `current`, `stale`, or `legacy` status.
- A changed PDF must not silently move old annotations. Stale/legacy anchors require explicit re-anchoring. Re-anchoring records the former page/quote/rectangles/fingerprint in bounded `anchorHistory` before replacing the active anchor.
- Do not implement automatic fuzzy re-anchoring as a destructive write. A future fuzzy matcher may propose candidates/confidence, but applying a new anchor must remain reviewable and preserve history.
- Page-text hashes/indexes are secondary text-anchor hints. Geometry and document fingerprints remain independent so scanned/image regions still work.
- Deleting an annotation in the UI is always a soft delete. Set `deletedAt`; never physically remove the annotation record for a normal user delete action. Restoring clears `deletedAt`.
- Keep annotation sidecars project-scoped and bound to their source PDF path. A sidecar must never be allowed to escape the configured `annotationDir`.
- Mutations use optimistic revision checks and atomic writes. Do not bypass those mechanisms with ad-hoc filesystem writes.
- Promoting an annotation to research evidence is an explicit user action. Promotion creates a normal durable `type: evidence` Markdown note through the existing evidence writer; an annotation label such as `evidence`, `claim`, or `limitation` must never automatically create a semantic research relationship.
- Region-only annotations are not textual evidence. They require a verified quote/OCR/caption text before promotion instead of using a comment as a fake source quote.
- Promoted evidence records preserve a human-readable `Observaire source annotation` marker containing the stable annotation ID and the document fingerprint available at promotion time. Promotion must remain idempotent: retries resolve to the existing evidence object instead of generating duplicates.
- Hiding an annotation does not delete already-promoted evidence. Annotation visibility and research-evidence lifecycle are separate decisions.
- Do not copy this directory into `public/_research`; annotations may contain private research comments.
- Schema v2 remains backward-readable from v1 sidecars. Future schema changes need an explicit version/migration path rather than rejecting or silently rewriting existing records.
