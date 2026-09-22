---
name: research-doctor
description: Diagnose and repair Observaire workspace integrity problems reported by npm run doctor. Use for broken note links, missing assets, invalid IDs/dates/frontmatter, PDF companion problems, aliases, or configuration diagnostics. Do not suppress legitimate errors just to make validation pass.
---

1. Run `npm run doctor` and classify every error/warning.
2. Repair errors at the source note/config/asset whenever possible.
3. Preserve stable IDs and existing valid aliases.
4. For broken links, find the intended existing target; never create a fake target solely to satisfy validation.
5. For missing assets/PDFs, restore the real file/reference or remove the unsupported claim/reference.
6. Treat unknown type/status warnings as vocabulary guidance unless `strictVocabulary` is intentionally enabled.
7. Do not weaken path/symlink/security checks to accommodate unsafe content.
8. Re-run `npm run doctor` until no introduced errors remain.
