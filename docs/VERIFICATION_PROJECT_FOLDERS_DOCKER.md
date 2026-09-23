# Verification — project folders, auto-indexing, and Docker persistence

Run this checklist against the exact commit intended for merge.

## Automated gates

```bash
npm ci
node --test tests/project-folders.test.mjs
node --test tests/evidence-write.test.mjs
node --test tests/consensus-evidence.test.mjs
node --test tests/data-contract.test.mjs
npm run doctor
npm run typecheck
npm run lint
npm run build
```

Or run the repository aggregate gates:

```bash
npm run check
npm run check:full
```

## Folder discovery

1. Create `progress/Project A/00_question.md` and `progress/Project A/01_method.md` without editing `research-observer.config.json`.
2. Confirm **Projects** shows Project A as auto-indexed.
3. Confirm its notes appear in Notes, Search, Graph, Collections, and Insights under one project ID.
4. Create `progress/Project B/00_question.md`. Confirm Project B appears independently and no duplicate-order diagnostic is emitted merely because both projects use `00`.
5. Confirm previous/next note navigation and the left research rail remain within the active project.
6. Create an asset-only folder such as `progress/figures/chart.svg`. Confirm `figures` is not registered as a project.
7. Add `.observaire-project.json` with a stable custom ID/label to a project folder. Confirm the custom metadata is used when no conflicting legacy config metadata exists.
8. Put a conflicting `research:` value inside a folder-backed note. Confirm folder identity wins and a `research-folder-mismatch` diagnostic appears.
9. Confirm legacy root-level `progress/00_*.md` notes still compile and configured `research:` project assignments remain compatible.

## Nested links, assets, and evidence

1. From `Project A/00_question.md`, link to `01_method.md`. Confirm the note reference resolves within Project A even if Project B also contains `01_method.md`.
2. Reference `figures/chart.svg` and `papers/source.pdf` inside the same project. Confirm they resolve and render/copy into generated media correctly.
3. Add an intentional relative cross-project Markdown link using `../Project B/00_question.md`. Confirm it resolves to the target note.
4. Confirm typed frontmatter relationships still resolve by stable object ID across projects.
5. Attempt to create an evidence relationship using only a duplicate filename slug that exists in two projects. Confirm Observaire refuses the ambiguous target and requires a stable ID.
6. Capture local PDF evidence for a folder-backed project. Confirm the new evidence Markdown is created inside that project folder at its next local order number, not at root `progress/`.
7. Confirm that evidence note stores a project-relative source path such as `papers/source.pdf`, while the compiled model resolves it to the full project asset path.
8. Save Consensus evidence into an auto-indexed project. Confirm the evidence file is created inside the project folder at the next local order number and does not need redundant `research:` frontmatter.

## Browser project import

1. Open **Projects** on desktop and select a folder containing `00_*.md` through the folder picker.
2. Confirm the selected project name, file count, Markdown count, and size are shown before import.
3. Choose **Import + index**. Confirm the project appears immediately after success.
4. Confirm the success state exposes **Open project notes** and **Open insights**, and both routes remain scoped to the imported project.
5. Inspect the host filesystem. Confirm the selected folder physically exists under the configured host research directory.
6. Confirm Observaire creates `.observaire-project.json` when the imported folder did not supply one.
7. Try importing the same folder again. Confirm Observaire returns an existing-project conflict and does not overwrite the original directory.
8. Supply a different folder whose generated or manifest project ID is already used by a populated project. Confirm Observaire returns a project-identity conflict before writing the folder.
9. Attempt to import a loose set of files rather than one folder. Confirm the client rejects it.
10. Attempt a crafted/mixed-root request. Confirm the server refuses files that do not belong to the selected folder.
11. Import a folder that produces a compiler error. Confirm the import is rolled back rather than leaving a partially registered directory.
12. On Chromium, drag one folder onto the drop zone and confirm recursive folder traversal works. On browsers without directory drag APIs, confirm the folder picker remains usable.
13. At tablet/phone widths, confirm the importer, selected-folder summary, success actions, and import action stack without horizontal overflow and touch targets remain usable.

## ChatGPT Web handoff

1. Open **Instruction** and generate a ChatGPT Web prompt from one topic/idea/hypothesis.
2. Confirm the generated prompt asks for exactly one project folder and a `.observaire-project.json` manifest.
3. Confirm the suggested ordered notes begin at `00_` within that folder rather than using the old root-level `900_` temporary range.
4. Confirm the prompt tells the model to omit `research:` for folder-backed notes and does not require the new folder ID to already exist in `researchProjects`.
5. Recreate the returned folder exactly, import it through **Projects**, and confirm it indexes without central config edits.

## Docker source persistence

From the repository root:

```bash
docker compose up --build
```

1. Open `http://127.0.0.1:4173`.
2. Import a new project through **Projects**.
3. On the host, confirm the imported project exists under `./progress/<project>/` by default.
4. Stop and remove the container:

```bash
docker compose down
```

5. Start it again:

```bash
docker compose up
```

6. Confirm the project is still present and re-indexed. This is the primary proof that research source lives in the host bind mount rather than container-only storage.
7. Rebuild/recreate the service and repeat the check.
8. Copy a new project folder directly into host `./progress/` while the container runs. Confirm the project is detected without restarting; the Compose polling fallback should notice it within roughly the configured poll interval.
9. Set `OBSERVAIRE_RESEARCH_DIR` to another writable host directory, start Compose, import a project, and confirm it is written to that alternate host directory.
10. With an alternate research directory that does not contain `progress/AGENTS.md`, open **Instruction** and confirm the page falls back to the repository-level contract instead of failing.
11. Verify `.research-observer` state uses the `observaire-state` named volume and is not confused with durable `progress/**` research source.

## Docker integration and Codex persistence

1. Configure a workspace Consensus key from **Settings**, restart/recreate the container with `docker compose down && docker compose up`, and confirm the workspace integration state remains available.
2. Use **Settings → Codex → Sign in with ChatGPT** and complete device authorization.
3. Confirm `CODEX_HOME` resolves beneath `/app/.research-observer/codex`.
4. Restart/recreate the container without deleting volumes and confirm `codex login status` / the Settings badge still reports authorization.
5. Run `docker compose down -v`, restart, and confirm local integration/Codex runtime state is intentionally cleared while bind-mounted project folders remain on the host.
6. If using a non-1000 host UID/GID on Linux, run Compose with `OBSERVAIRE_UID=$(id -u)` and `OBSERVAIRE_GID=$(id -g)` and confirm both the research bind mount and persistent state remain writable.

## Docker Git-backed review features

The Compose setup mounts host `.git` metadata so existing Direct Edit/Codex review workflows can continue using Git when the default repository-backed `progress/` directory is mounted.

1. Confirm `git status` works inside the running container.
2. Confirm Direct Edit can prepare an isolated review diff for a note in a nested project folder.
3. Confirm Save updates the host-mounted Markdown file and does not stage or commit it.
4. Confirm the Codex Act review worktree can be created/removed without modifying unrelated host files.
5. If `OBSERVAIRE_RESEARCH_DIR` points outside the Git worktree, do not assume Git-backed Act represents that external folder's history; verify indexing/import separately from Git review behavior.

## Failure boundaries

Do not call this feature fully verified until all of these have been observed on the exact candidate commit:

- automated project-folder/evidence/contract regression tests pass;
- `npm run check` passes;
- `npm run build` passes;
- browser import succeeds;
- host filesystem contains the imported source folder;
- container recreation preserves/re-indexes it;
- Codex/integration state survives normal recreation;
- direct host folder copy is detected;
- two projects can reuse the same order numbers safely;
- project-ID collisions are rejected;
- folder-generated evidence remains physically inside the project;
- invalid import rollback leaves no partial project;
- ChatGPT Web output can be imported as a folder without central project registration.
