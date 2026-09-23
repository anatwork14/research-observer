# Verification — project folders, auto-indexing, and Docker persistence

Run this checklist against the exact commit intended for merge.

## Automated gates

```bash
npm ci
node --test tests/project-folders.test.mjs
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
7. Add `.observaire-project.json` with a stable custom ID/label to a project folder. Confirm the custom metadata is used.
8. Put a conflicting `research:` value inside a folder-backed note. Confirm folder identity wins and a `research-folder-mismatch` diagnostic appears.
9. Confirm legacy root-level `progress/00_*.md` notes still compile and configured `research:` project assignments remain compatible.

## Nested links and assets

1. From `Project A/00_question.md`, link to `01_method.md`. Confirm the note reference resolves within Project A even if Project B also contains `01_method.md`.
2. Reference `figures/chart.svg` and `papers/source.pdf` inside the same project. Confirm they resolve and render/copy into generated media correctly.
3. Add an intentional relative cross-project Markdown link using `../Project B/00_question.md`. Confirm it resolves to the target note.
4. Confirm typed frontmatter relationships still resolve by stable object ID across projects.

## Browser project import

1. Open **Projects** on desktop and select a folder containing `00_*.md` through the folder picker.
2. Confirm the selected project name, file count, Markdown count, and size are shown before import.
3. Choose **Import + index**. Confirm the project appears immediately after success.
4. Inspect the host filesystem. Confirm the selected folder physically exists under the configured host research directory.
5. Confirm Observaire creates `.observaire-project.json` when the imported folder did not supply one.
6. Try importing the same folder again. Confirm Observaire returns an existing-project conflict and does not overwrite the original directory.
7. Attempt to import a loose set of files rather than one folder. Confirm the client rejects it.
8. Attempt a crafted/mixed-root request. Confirm the server refuses files that do not belong to the selected folder.
9. Import a folder that produces a compiler error. Confirm the import is rolled back rather than leaving a partially registered directory.
10. On Chromium, drag one folder onto the drop zone and confirm recursive folder traversal works. On browsers without directory drag APIs, confirm the folder picker remains usable.
11. At tablet/phone widths, confirm the importer, selected-folder summary, and import action stack without horizontal overflow and touch targets remain usable.

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
10. Verify `.research-observer` local state uses the Docker named volume and is not confused with durable `progress/**` research source.

## Docker Git-backed review features

The Compose setup mounts host `.git` metadata so existing Direct Edit/Codex review workflows can continue using Git.

1. Confirm `git status` works inside the running container.
2. Confirm Direct Edit can prepare an isolated review diff for a note in a nested project folder.
3. Confirm Save updates the host-mounted Markdown file and does not stage or commit it.
4. Confirm the Codex Act review worktree can be created/removed without modifying unrelated host files.
5. On Linux, run Compose with the host UID/GID if the default numeric user cannot write the bind mount:

```bash
OBSERVAIRE_UID=$(id -u) OBSERVAIRE_GID=$(id -g) docker compose up --build
```

## Failure boundaries

Do not call this feature fully verified until all of these have been observed on the exact candidate commit:

- automated project-folder regression tests pass;
- `npm run check` passes;
- `npm run build` passes;
- browser import succeeds;
- host filesystem contains the imported source folder;
- container recreation preserves/re-indexes it;
- direct host folder copy is detected;
- two projects can reuse the same order numbers safely;
- invalid import rollback leaves no partial project.
