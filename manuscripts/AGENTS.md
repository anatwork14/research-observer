# LaTeX manuscript workspaces

This directory contains durable, project-scoped manuscript source. It is intentionally separate from `progress/`, whose compiler treats non-Markdown files as research assets.

- Each research project owns `<configured manuscriptsDir>/<project-id>/`; `manuscripts/<project-id>/` is the default, not a hard-coded requirement.
- Editable source types are `.tex`, `.bib`, `.sty`, `.cls`, and `.bst`. Figures and other manuscript resources may live alongside them.
- `.observaire-ide.json` is managed by `lib/research/latex-ide.mjs`. It stores IDE state such as the selected main file, TeX engine, and soft-hidden files.
- Hiding/removing a manuscript file in the IDE is a soft delete. Keep the physical source file and add it to `hiddenFiles`; restoring removes it from that list.
- Browser saves must keep SHA-256 stale-write protection. Never silently overwrite a source file that changed after the editor opened it.
- Never compile directly into this directory. Build products belong under `.research-observer/latex-builds/`; browser preview copies are generated under `public/_research/latex/` and are not source of truth.
- LaTeX builds must keep unrestricted shell escape disabled. Treat compilation as execution of potentially complex input and preserve resource/time bounds.
- SyncTeX is the canonical source↔PDF positioning mechanism. Keep `-synctex=1` enabled for supported engines.
- Do not commit ordinary TeX intermediate files such as `.aux`, `.log`, `.fls`, `.fdb_latexmk`, `.out`, `.toc`, or `.synctex.gz` inside manuscript source directories.
- `npm run verify:latex` is the isolated application-service toolchain smoke command. It executes the same `compileLatexProject`/SyncTeX service used by the IDE and therefore requires Node plus the TeX toolchain.
- `npm run verify:latex:container` is a verification-only fallback that avoids building the Observaire runtime image. It runs `scripts/verify-latex-toolchain.sh` in a digest-pinned prebuilt TeX Live container, mounts the repository read-only, and validates pdfLaTeX, XeLaTeX, LuaLaTeX, classic BibTeX, Biber/biblatex, SyncTeX, and disabled unrestricted shell escape. Passing it proves the external TeX toolchain contract, not the Node service integration.
- `npm run verify:latex:project-toolchain` builds the exact Docker TeX/system layer used by Observaire. `npm run verify:latex:project-app` builds the app target and runs the Node service verifier in a read-only, network-disabled container with only `/tmp` writable; it must not mount real research/manuscript data or the normal state volume.
- Keep the default verification container image digest-pinned. `OBSERVAIRE_LATEX_VERIFY_IMAGE` and `OBSERVAIRE_LATEX_VERIFY_PLATFORM` may override it deliberately for another trusted test environment.

## Citations and bibliography

- `lib/research/latex-citations.mjs` is the bridge from project literature/evidence to manuscript `.bib` files. Do not create a second hand-maintained citation registry.
- Citation candidates come only from the selected research project and must originate from indexed `literature` or `evidence` objects.
- Never invent missing authors, year, DOI, URL, title, journal, or publication type. Incomplete research metadata must remain visibly incomplete and non-insertable until verified.
- When an evidence object points to the same local PDF as a verified literature note, the literature note may supply bibliography metadata while the evidence object remains the research-context origin.
- Deduplicate bibliography records by durable identity in this order where available: DOI, source URL, local PDF, then title/year. Reuse an existing citation key instead of appending a duplicate record.
- Generated entries currently use conservative `@misc` BibTeX rather than guessing a publication class. A future richer metadata model may deliberately choose `@article`, `@inproceedings`, and other types only from verified source metadata.
- `.bib` writes must use the same stale-write-safe manuscript APIs as other source files. A citation action must not bypass SHA-256 conflict protection.
- `lib/research/latex-bibliography.mjs` is a browser-safe source transform for explicit bibliography setup. Keep it pure and independent of Node/process/filesystem APIs.
- Bibliography setup must preserve an existing BibTeX style. If no classic BibTeX configuration exists, the explicit setup action may add a basic `plain` style plus `\bibliography{...}`; never silently change a user's existing style.
- When `biblatex` is detected, use `\addbibresource{...}` and `\printbibliography` instead of mixing in classic BibTeX commands.
- If a different classic `\bibliography{...}` is already configured, do not silently rewrite it to another library; surface the conflict for explicit user editing.
- Citation insertion and bibliography setup must go through the shared editor adapter so CodeMirror and the plain textarea preserve the same service contracts.

## Codex manuscript Act/review

- Manuscript Act is a separate workflow from the existing research Codex Act route. Never widen the research-only `progress/` path guard to cover manuscript source.
- `/api/codex/manuscript-act` snapshots the selected project's visible editable sources into an isolated detached worktree. Hidden files, resources, `.observaire-ide.json`, generated output, and unrelated projects are out of scope.
- If the active browser editor contains unsaved source that differs from disk, Act must refuse to prepare a proposal until the user saves or reloads. The reviewed baseline must exactly match durable source.
- Codex may create or modify only `.tex`, `.bib`, `.sty`, `.cls`, and `.bst` files inside the selected manuscript project. Binary/resource edits, sibling-project changes, AGENTS/config/code changes, renames, and physical deletions invalidate the proposal.
- A manuscript proposal stores a bounded human-reviewable patch plus frozen per-file baseline hashes. Proposal storage under `.research-observer/codex-drafts/` is transient review state, not manuscript source.
- The UI must display the exact patch and touched files before enabling **Apply reviewed changes**. Advisory LaTeX structure diagnostics may be shown, but they are not a substitute for the real compiler.
- `/api/codex/manuscript-apply` must verify proposal kind, patch SHA-256, path scope, non-destructive status, reviewability, and all frozen live file hashes before applying.
- If any touched live source changed after review, apply must fail with a stale/conflict response and require a new proposal.
- Apply must use `git apply --check` before mutation and create an exact pre-apply recovery snapshot for every touched source under transient `.research-observer/codex-recovery/` state.
- Post-apply source validation first attempts reverse-patch rollback on failure. If reverse rollback fails, restore the exact recovery snapshot; existing files return to their previous bytes and files newly created by the proposal are removed.
- Recovery orchestration belongs in `lib/codex/manuscript-apply-recovery.mjs` so reverse-patch failure → exact-snapshot fallback can be tested without a production fault-injection flag. Do not duplicate that decision tree inside route code.
- Distinguish source recovery from snapshot cleanup: if manuscript bytes were restored but transient recovery-state deletion fails, report source recovery as successful while retaining the snapshot and requiring cleanup. Do not misreport that state as source loss.
- Recovery snapshot state is deleted after successful apply, successful rollback, or discard. Retain it when cleanup or automatic restoration fails and report the retained state clearly.
- Discard deletes only transient proposal/recovery state. It never changes manuscript files.
- A successful apply should reload/reopen the IDE from disk so editor base hashes are refreshed rather than continuing with stale browser state.
- Manuscript Act remains local-development only until an authenticated production agent execution service is explicitly designed and enabled.
