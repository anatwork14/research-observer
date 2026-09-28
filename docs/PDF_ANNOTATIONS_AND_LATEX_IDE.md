# PDF annotations + LaTeX IDE architecture

Research Observer treats papers, annotations, manuscript source, compiled PDFs, research notes, evidence, citations, and read-only AI assistance as parts of one project-scoped research workspace.

## Storage boundaries

Three durable source domains are intentionally separate:

- `progress/` remains the Markdown-first research source of truth compiled by the existing research compiler.
- `annotations/<project-id>/` stores structured PDF annotation sidecars. These records are private application data and are never burned into or copied with the source PDF.
- `manuscripts/<project-id>/` stores LaTeX/BibTeX source and manuscript resources. It sits outside `progress/` so `.tex` and `.bib` files are not misclassified as research media assets.

Transient build/cache state remains under `.research-observer/`. Browser-consumable compiled PDF previews are generated under `public/_research/latex/` and are never authoritative source.

The configured roots are explicit:

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

Normalized rectangles make rendering independent of zoom. Quote context gives a second anchor for future document-version re-anchoring.

Mutations use a sidecar revision number. Clients send the revision they observed; stale writes fail rather than overwriting another edit. Sidecars are written atomically behind a short-lived filesystem lock.

### Soft delete

A normal delete action never destroys annotation data. It sets `deletedAt`. The default list hides those records, while `includeDeleted=1` exposes them for recovery. Restore clears `deletedAt`.

The same UX principle is used for manuscript files: the IDE stores hidden paths in `.observaire-ide.json`, leaving the physical source intact.

### Annotation editing

The annotation drawer supports in-place changes to semantic type, comment, tags, and display color while preserving the original page/quote/rectangle anchor.

If an annotation was already promoted to durable evidence, later annotation edits do not silently rewrite that evidence note. Promotion creates a reviewable research snapshot; annotation editing remains a reading-layer operation.

### Research semantics boundary

Annotation labels are reading/authoring metadata, not automatic scientific graph truth. Creating an annotation of type `evidence`, `claim`, or `limitation` does not silently create a durable Markdown evidence object or a `supports`, `contradicts`, or `answers` relationship.

### Annotation → evidence promotion

A saved visible text annotation can be explicitly promoted.

Promotion:

1. verifies revision and visibility;
2. checks a freshly compiled workspace for an existing promotion;
3. reuses the canonical `createEvidenceNote` writer;
4. stores PDF path, page, exact excerpt, comment, annotation type, and tags;
5. records the stable annotation ID as provenance;
6. re-lists the research workspace so the annotation UI can expose the evidence slug/title/filename.

Repeated promotion is idempotent. Hiding the source annotation does not delete previously promoted evidence.

## LaTeX IDE model

The `/ide` route shares the existing research project selector. Each project has one manuscript root and IDE state containing:

- main TeX file
- selected engine (`pdflatex`, `xelatex`, `lualatex`)
- soft-hidden files

Browser saves include the SHA-256 of the version originally opened. A save is rejected if the file changed externally after opening.

### Compilation

The local provider uses `latexmk` to handle repeated TeX passes and bibliography/index dependencies. Builds:

1. resolve a visible `.tex` main file;
2. run with bounded process timeout and captured logs;
3. keep unrestricted shell escape disabled;
4. enable SyncTeX;
5. direct generated files into `.research-observer/latex-builds/<project>/<build-id>/`;
6. parse file/line diagnostics;
7. copy successful PDF/SyncTeX preview artifacts into `public/_research/latex/<project>/<build-id>/`.

Production compilation remains opt-in with `RESEARCH_OBSERVER_LATEX=1`.

### Build retention

Generated builds are bounded. After a browser compile, `lib/research/latex-retention.mjs` prunes older IDs from both:

```text
.research-observer/latex-builds/<project>/
public/_research/latex/<project>/
```

The default is 12 builds per project. `OBSERVAIRE_LATEX_BUILD_RETENTION` is clamped to 2–100. Cleanup affects rebuildable output only, never manuscript source.

### Source ↔ PDF navigation

Successful builds retain `.synctex.gz`. The workbench supports:

- editor cursor → `synctex view` → PDF page/position
- PDF double-click → `synctex edit` → source file/line

SyncTeX is the canonical source/PDF positioning contract.

## Research citation bridge

The IDE now connects canonical research objects to manuscript bibliography source.

### Citation candidates

`lib/research/latex-citations.mjs` searches only the selected project’s indexed `literature` and `evidence` records.

Citation metadata is conservative:

- missing authors/year/source identity are never guessed;
- incomplete records remain visible but non-insertable;
- evidence may inherit bibliography metadata from the most complete literature record resolving to the same local PDF;
- reviewed Consensus evidence uses metadata already persisted into the research object.

### BibTeX identity and writes

The service can create `references.bib` or use an existing visible project `.bib` file. Writes reuse manuscript path guards and SHA-256 stale-write protection.

Deduplication priority is:

1. DOI
2. source URL
3. local PDF path
4. title + year

Existing records reuse their existing citation key. New records use deterministic author/year/title keys with collision suffixes. Generated records currently use conservative `@misc` rather than guessing publication classes not represented in verified metadata.

### Citation UX

The responsive citation drawer provides:

- project search;
- `.bib` selection/creation;
- inherited/missing metadata indicators;
- links to the research note, local PDF, and source URL;
- **Insert citation** → `\cite{key}` at the active TeX cursor.

Insertion validates that a `.tex` target is actually open before server-side `.bib` mutation.

## Bibliography setup

`lib/research/latex-bibliography.mjs` provides an explicit browser-safe source transform.

For classic BibTeX it preserves existing style choices, connects the selected library, adds `plain` only when a basic style is missing, and refuses to silently replace a different existing bibliography library.

For `biblatex` it uses `\addbibresource` and `\printbibliography` without introducing classic BibTeX commands.

Cursor/selection offsets are mapped through inserted configuration text so editor position remains stable.

## Editor assistance and future CodeMirror adapter

The initial workbench remains dependency-free/touch-compatible, but now has a replaceable editor-assistance layer in `lib/research/latex-editor-tools.mjs` and `LatexEditorAssistant`.

It provides:

- `Ctrl/⌘ + Shift + P` command palette;
- `Ctrl/⌘ + /` line-comment toggle;
- bold/italic/emphasis wrappers;
- section/subsection insertion;
- equation/align/itemize/enumerate/figure/table snippets;
- current-file outline from sections and labels;
- source navigation from outline items;
- advisory structural diagnostics for environments, braces, duplicate labels, and document boundaries.

These client diagnostics never determine build success; `latexmk` remains authoritative.

A CodeMirror adapter remains desirable for syntax highlighting, folding, search, richer completion, and language integration. The repository uses a committed npm lockfile, so CodeMirror must be introduced only when `package.json` and `package-lock.json` can be updated and verified together. The current textarea assistant remains the mobile/safe fallback.

## Codex manuscript context

The IDE now has a dedicated manuscript Codex surface for **Ask** and **Draft** only.

It may supply:

- selected project ID;
- active `.tex` filename;
- current unsaved selection or source snapshot;
- latest compiler diagnostics.

All supplied manuscript source and compiler messages are explicitly marked as untrusted source material. Codex Ask/Draft runs read-only and cannot mutate files.

Existing Codex **Act** remains restricted to reviewed `progress/` changes. It is deliberately not extended to manuscripts by weakening path restrictions. A future manuscript Act flow must have its own stale-safe review/apply contract using manuscript hashes, project path guards, visible diffs, and explicit user approval.

## Docker persistence

Compose preserves every durable source domain:

```text
${OBSERVAIRE_RESEARCH_DIR:-./progress}       -> /app/progress
${OBSERVAIRE_ANNOTATIONS_DIR:-./annotations} -> /app/annotations
${OBSERVAIRE_MANUSCRIPTS_DIR:-./manuscripts} -> /app/manuscripts
```

`.research-observer/` remains on the existing named state volume because it contains transient integration/build state.

`npm run observaire:start` and `npm run observaire:start:build` run the host-directory preflight before Compose starts.

## Integration path with the research graph

The workspace should continue connecting canonical objects rather than creating parallel stores:

1. **Annotation → evidence — implemented**: explicit idempotent promotion creates the normal durable evidence note.
2. **Evidence → manuscript citation — implemented**: verified research metadata can create/reuse a `.bib` record and insert `\cite{...}`.
3. **Bibliography → TeX — implemented**: the selected library can be explicitly configured in classic BibTeX or `biblatex` source.
4. **Manuscript Codex Ask/Draft — implemented**: unsaved source and compiler diagnostics can be passed read-only.
5. **Manuscript citation → paper — partial**: citation discovery links to source note/PDF; direct click-navigation from parsed source tokens remains future work.
6. **Compiled manuscript annotation → source — future**: annotate generated PDF and associate comments with TeX positions through SyncTeX.
7. **Codex manuscript Act — future**: separate stale-safe review/apply path; never bypass manuscript save guards.
8. **Graph/timeline — future**: expose manuscript/evidence/citation events without turning generated build artifacts into durable graph nodes.

## Robustness roadmap

High-value next steps:

- area/figure/table annotations for non-text/scanned PDFs;
- document hashing and PDF-version re-anchoring with confidence scores;
- threaded annotation replies/@mentions;
- legitimate lockfile-safe CodeMirror 6 integration;
- optional TexLab/LSP process adapter for symbols/hover/references/completion;
- direct citation-token navigation from source;
- generated-PDF annotation mapping back to TeX through SyncTeX;
- manuscript Act review/apply using stale hashes and project-scoped diffs;
- configurable compile providers and stronger process isolation for shared/untrusted deployments;
- annotation export/import using PDF/XFDF or W3C-inspired mappings after internal schema stabilization.

## Verification contract

Automated tests in the branch cover the data-model/pure-transform layer for annotations, promotion, manuscript source state, build retention, citations, bibliography setup, and editor structure/transforms.

Before merge/release, a checkout with Node and TeX must run:

```bash
npm run check
npm run check:full
```

Browser/toolchain verification should exercise:

- PDF annotation create/edit/Hide/Restore across reload/page/zoom;
- promotion retry/idempotency;
- manuscript create/save/hide/restore;
- editor command palette/comment toggle/outline/problems;
- citation search/dedup/insertion;
- classic BibTeX and `biblatex` real builds;
- Codex manuscript Ask/Draft context and read-only behavior;
- pdfLaTeX/XeLaTeX/LuaLaTeX smoke builds;
- diagnostics → source jumps;
- forward/reverse SyncTeX;
- repeated-build pruning;
- missing-toolchain graceful degradation;
- tablet/mobile recovery and Compose persistence.

The architectural rule remains: PDF pixels, editor widgets, AI responses, and compiler outputs are views or derived artifacts around durable structured project objects, not replacements for those objects.
