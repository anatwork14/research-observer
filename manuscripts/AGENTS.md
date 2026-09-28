# LaTeX manuscript workspaces

This directory contains durable, project-scoped manuscript source. It is intentionally separate from `progress/`, whose compiler treats non-Markdown files as research assets.

- Each research project owns `manuscripts/<project-id>/`.
- Editable source types are `.tex`, `.bib`, `.sty`, `.cls`, and `.bst`. Figures and other manuscript resources may live alongside them.
- `.observaire-ide.json` is managed by `lib/research/latex-ide.mjs`. It stores IDE state such as the selected main file, TeX engine, and soft-hidden files.
- Hiding/removing a manuscript file in the IDE is a soft delete. Keep the physical source file and add it to `hiddenFiles`; restoring removes it from that list.
- Browser saves must keep SHA-256 stale-write protection. Never silently overwrite a source file that changed after the editor opened it.
- Never compile directly into this directory. Build products belong under `.research-observer/latex-builds/`; browser preview copies are generated under `public/_research/latex/` and are not source of truth.
- LaTeX builds must keep unrestricted shell escape disabled. Treat compilation as execution of potentially complex input and preserve resource/time bounds.
- SyncTeX is the canonical source↔PDF positioning mechanism. Keep `-synctex=1` enabled for supported engines.
- Do not commit ordinary TeX intermediate files such as `.aux`, `.log`, `.fls`, `.fdb_latexmk`, `.out`, `.toc`, or `.synctex.gz` inside manuscript source directories.

## Citations and bibliography

- `lib/research/latex-citations.mjs` is the bridge from project literature/evidence to manuscript `.bib` files. Do not create a second hand-maintained citation registry.
- Citation candidates come only from the selected research project and must originate from indexed `literature` or `evidence` objects.
- Never invent missing authors, year, DOI, URL, title, journal, or publication type. Incomplete research metadata must remain visibly incomplete and non-insertable until verified.
- When an evidence object points to the same local PDF as a verified literature note, the literature note may supply bibliography metadata while the evidence object remains the research-context origin.
- Deduplicate bibliography records by durable identity in this order where available: DOI, source URL, local PDF, then title/year. Reuse an existing citation key instead of appending a duplicate record.
- Generated entries currently use conservative `@misc` BibTeX rather than guessing a publication class. A future richer metadata model may deliberately choose `@article`, `@inproceedings`, and other types only from verified source metadata.
- `.bib` writes must use the same stale-write-safe manuscript APIs as other source files. A citation action must not bypass SHA-256 conflict protection.
- Citation insertion into the current textarea uses a temporary client adapter. When the editor migrates to CodeMirror, replace only that adapter; keep the citation service/API/data contract unchanged.
