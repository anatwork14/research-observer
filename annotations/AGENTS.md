# PDF annotation sidecars

This directory is durable Research Observer source data. It is not generated browser output.

- Annotation JSON files are managed by `lib/research/pdf-annotations.mjs`; do not hand-edit them while the app is running.
- A PDF annotation is a structured record, not paint burned into the PDF. Preserve its stable `id`, semantic `type`, page, text quote context, normalized page rectangles, comments, tags, timestamps, and revision metadata.
- Deleting an annotation in the UI is always a soft delete. Set `deletedAt`; never physically remove the annotation record for a normal user delete action. Restoring clears `deletedAt`.
- Keep annotation sidecars project-scoped and bound to their source PDF path. A sidecar must never be allowed to escape the configured `annotationDir`.
- Mutations use optimistic revision checks and atomic writes. Do not bypass those mechanisms with ad-hoc filesystem writes.
- Do not copy this directory into `public/_research`; annotations may contain private research comments.
- If the schema changes, introduce an explicit schema version and migration path instead of silently changing existing records.
