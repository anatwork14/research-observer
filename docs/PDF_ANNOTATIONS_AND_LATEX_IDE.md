# PDF annotations + LaTeX IDE architecture

Research Observer now treats papers, annotations, manuscript source, compiled PDFs, research notes, and evidence as parts of one project-scoped research workspace.

## Storage boundaries

Three durable source domains are intentionally separate:

- `progress/` remains the Markdown-first research source of truth compiled by the existing research compiler.
- `annotations/<project-id>/` stores structured PDF annotation sidecars. These records are private application data and are never burned into or copied with the source PDF.
- `manuscripts/<project-id>/` stores LaTeX/BibTeX source and manuscript resources. It sits outside `progress/` so `.tex` and `.bib` files are not misclassified as research media assets.

Transient build/cache state remains under `.research-observer/`. Browser-consumable compiled PDF previews are generated under `public/_research/latex/` and are never authoritative source.

The configured roots are intentionally explicit:

```json
{
  "progressDir": "progress",
  "annotationDir": "annotations",
  "manuscriptsDir": "manuscripts"
}
```

## PDF annotation model

Annotations are structured records with stable IDs and include:

- semantic type (`highlight`, `comment`, `evidence`, `claim`, `question`, `limitation`, `method`, `definition`, `important`)
- page number
- exact selected quote plus optional prefix/suffix context
- one or more normalized page rectangles
- comment body and tags
- display color
- created/updated timestamps
- `deletedAt` soft-delete marker

Normalized rectangles make rendering independent of the current zoom level. Quote context gives us a second anchor for later re-anchoring when a PDF revision changes.

Mutations use a sidecar revision number. Clients send the revision they observed; stale writes fail rather than overwriting another edit. Sidecars are written atomically behind a short-lived filesystem lock.

### Soft delete

A normal delete action never destroys annotation data. It sets `deletedAt`. The default list hides those records, while `includeDeleted=1` exposes them for recovery. Restore clears `deletedAt`.

This same UX principle is used for manuscript files: the IDE stores hidden paths in `.observaire-ide.json`, leaving the actual source file intact.

### Annotation editing

The PDF annotation drawer supports in-place changes to semantic type, comment, tags, and display color. These edits deliberately preserve the source anchor: page, exact quote context, and normalized rectangles are not rewritten when interpretation metadata changes.

If an annotation was already promoted to durable evidence, later annotation edits do not silently rewrite that evidence note. Promotion creates a reviewable research snapshot; annotation editing remains a reading-layer operation.

### Research semantics boundary

Annotation labels are reading/authoring metadata, not automatic scientific graph truth. Creating an annotation of type `evidence`, `claim`, or `limitation` does not silently create a durable Markdown evidence object or a `supports`, `contradicts`, or `answers` relationship.

Promotion into durable research evidence is explicit. It also remains neutral: the promotion operation never guesses a semantic relationship from the annotation type.

### Annotation → evidence promotion

A saved visible annotation with a sufficiently long exact text excerpt can be promoted through the annotation API/UI.

Promotion:

1. verifies the annotation revision and visibility;
2. checks a freshly compiled research workspace for an existing promotion;
3. reuses the canonical `createEvidenceNote` writer;
4. stores the PDF path, page, exact excerpt, annotation comment, type, and tags in the resulting evidence note;
5. records a human-readable `Observaire source annotation` marker containing the stable annotation ID;
6. re-lists the compiled workspace so the annotation UI can expose the evidence slug/title/filename.

The annotation ID acts as the bridge back to the richer sidecar anchor, including normalized rectangles and quote prefix/suffix context. Repeated promotion calls are idempotent: if the existing evidence note still carries the source-annotation marker, the existing evidence object is returned instead of creating a duplicate.

Hiding an annotation does not delete previously promoted evidence. Annotation visibility and research evidence lifecycle are separate decisions.

## LaTeX IDE model

The `/ide` route shares the existing research project selector. Each project has one manuscript root and IDE state containing:

- main TeX file
- selected engine (`pdflatex`, `xelatex`, or `lualatex`)
- soft-hidden files

Browser source saves include the SHA-256 of the version originally opened. A save is rejected if the file changed externally after opening, matching the stale-write philosophy of Direct Edit.

### Compilation

The local compiler provider uses `latexmk` because it handles repeated TeX passes and bibliography/index dependencies. Builds:

1. resolve a visible `.tex` main file
2. run with a bounded process timeout and bounded captured logs
3. keep unrestricted shell escape disabled
4. enable SyncTeX
5. direct generated files into `.research-observer/latex-builds/<project>/<build-id>/`
6. parse file/line diagnostics from the compiler log
7. copy only successful PDF/SyncTeX preview artifacts into `public/_research/latex/<project>/<build-id>/`

Production compilation remains opt-in with `RESEARCH_OBSERVER_LATEX=1`; normal research-file writes retain the existing `RESEARCH_OBSERVER_WRITES=1` production opt-in.

### Build retention

Generated LaTeX builds are intentionally bounded. After a browser compile, `lib/research/latex-retention.mjs` prunes older build IDs from both:

```text
.research-observer/latex-builds/<project>/
public/_research/latex/<project>/
```

The default is 12 build IDs per project. `OBSERVAIRE_LATEX_BUILD_RETENTION` can change this and is clamped to 2–100. Cleanup only affects rebuildable build/preview directories. Manuscript source under `manuscripts/` is never eligible for retention cleanup.

Cleanup failure is surfaced as a warning but does not turn a valid compiled PDF into a failed build.

### Source ↔ PDF navigation

Successful builds retain `.synctex.gz`. The workbench exposes both directions:

- editor cursor → `synctex view` → PDF page/position
- PDF double-click → `synctex edit` → source file/line

This is the key connection that makes the PDF preview part of the IDE rather than a passive iframe.

## Current workbench UX

The initial workbench deliberately uses a dependency-free text editor surface so the feature does not introduce an unreviewed editor package or lockfile change. It already provides:

- project-scoped file tree
- source creation
- soft hide/restore
- stale-safe save
- main-file and engine selection
- keyboard save
- line-number gutter
- compile action
- parsed diagnostics with source jumps
- PDF preview through the same local PDF.js/React-PDF runtime used by the Papers reader
- forward/reverse SyncTeX
- responsive tablet/mobile panels

The editor surface is intentionally replaceable. A future CodeMirror 6 adapter can provide LaTeX/BibTeX highlighting, completions, folding, bracket/environment helpers, and an LSP bridge without changing the storage/build APIs. Monaco should not be the default foundation because mobile-browser support is a project requirement.

## Docker persistence

The Compose profile must preserve every durable source domain, not only Markdown research:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains on the existing `observaire-state` named volume because it contains transient integration/build state.

`npm run observaire:start` and `npm run observaire:start:build` run `npm run observaire:prepare` first. The preflight creates the three host directories before Compose starts so Docker does not implicitly create missing bind directories with surprising ownership.

Do not store the only copy of annotation/manuscript source in a container layer or under `public/_research/`.

## Integration path with the research graph

These primitives should continue to connect through canonical objects rather than parallel systems:

1. **Annotation → evidence — implemented foundation**: explicit idempotent promotion creates the normal durable `type: evidence` note and retains the annotation ID/PDF/page/excerpt provenance bridge.
2. **Evidence → manuscript citation — next target**: from the IDE, search project evidence/papers, insert a citation key, and update a selected `.bib` file.
3. **Manuscript citation → paper**: clicking a citation in source opens the corresponding local paper/evidence record.
4. **Compiled manuscript annotation → source**: annotate the generated PDF, then use SyncTeX to associate the comment with the originating TeX line/range.
5. **Codex context**: extend the existing Codex panel context with current manuscript file, selection, build diagnostics, related annotations, and cited evidence. Codex changes should continue to use review/apply rather than silently writing source.
6. **Consensus → manuscript**: reviewed Consensus evidence can create/resolve a citation record, then be inserted into the manuscript with provenance intact.
7. **Graph/timeline**: expose manuscript versions, annotations, and evidence links as graph/timeline events without turning generated build artifacts into durable graph nodes.

## Robustness roadmap

High-value next steps after this foundation:

- threaded annotation replies/@mentions
- area/figure/table annotations for non-text regions and scanned papers
- document hashing and PDF-version re-anchoring with confidence scores
- optional first-class compiler schema field for annotation provenance after an intentional source-schema version update
- citation-key management and BibTeX import/deduplication
- CodeMirror 6 editor adapter with a mobile-safe configuration
- TexLab/LSP process adapter for diagnostics, completion, hover, references, and document symbols
- configurable compile providers: local `latexmk`, isolated container worker, and an optional Tectonic provider
- build cancellation and queued per-project builds for multi-user deployments
- explicit CPU/memory/process isolation for untrusted shared workspaces
- generated-PDF annotation mapping back to TeX ranges through SyncTeX
- export/import of annotations using interoperable PDF/XFDF or W3C-inspired representations

## Verification contract

Automated tests in this branch cover the filesystem/data-model layer for:

- annotation creation, stale revision rejection, metadata editing, Hide/Restore;
- annotation → evidence promotion, provenance discovery, and repeated-promotion idempotency;
- manuscript source stale-save behavior, IDE state, Hide/Restore, and separation from the Markdown compiler;
- LaTeX build-retention clamping and transient/public pruning behavior.

Before merge/release, a checkout with Node and the TeX toolchain must also run:

```bash
npm run check
npm run check:full
```

Browser/toolchain verification should explicitly exercise:

- PDF text selection → highlight/comment → reload → anchor persists;
- annotation edit → reload → anchor remains unchanged;
- Promote to evidence → Open evidence → reload → promotion state remains linked;
- repeated/concurrent promotion attempts do not duplicate evidence;
- hidden annotation → Show hidden → Restore;
- create/save/hide/restore `.tex`/`.bib` files;
- successful pdfLaTeX, XeLaTeX, and LuaLaTeX smoke builds where supported;
- failed build diagnostics jump to the correct source line;
- forward and reverse SyncTeX;
- repeated builds prune old transient/public build directories without losing the latest preview;
- missing-toolchain graceful degradation;
- tablet/mobile file rail, annotation editor, and preview recovery;
- Compose recreation preserves `progress/`, `annotations/`, and `manuscripts/`.

The architectural rule is that research knowledge remains structured and portable: PDF pixels, editor widgets, and compiler outputs are views over durable project objects, not the objects themselves.
