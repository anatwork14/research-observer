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
