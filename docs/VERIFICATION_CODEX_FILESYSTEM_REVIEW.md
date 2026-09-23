# Verification — filesystem-first Codex Act / Apply

Run this checklist against the exact commit intended for merge.

## Focused automated gate

```bash
node --test tests/worktree.test.mjs
```

The focused test must prove all of the following:

- a configured repository-relative research root other than `progress/` is accepted;
- paths outside that root are rejected;
- `AGENTS.md` cannot be modified through Act;
- a tracked research file already modified before review can be part of the review baseline;
- an imported/untracked research file can be part of the review baseline;
- a new file created by Codex appears in the review patch;
- restoring the frozen baseline index neutralizes accidental Codex staging;
- the review patch is based on the live filesystem snapshot, not Git HEAD;
- per-file baseline states report no conflict while the live files still match the reviewed snapshot;
- edits/creation after review are detected as Apply conflicts.

Also run the repository gates:

```bash
npm run check
npm run build
```

## Manual Act review with an imported project

1. Import a new folder through **Projects** and do not stage or commit it in Git.
2. Confirm `git status` shows the imported project as untracked/dirty.
3. Open a note from that project and request a small **Act** change.
4. Confirm Act does **not** reject the request merely because the imported project is untracked.
5. Inspect the returned patch. It should contain only the requested Codex changes, not the entire imported project as a giant `HEAD → current filesystem` diff.
6. Confirm the proposal file list stays under the configured research root.
7. Confirm the research doctor passes before Apply becomes eligible.
8. Apply the proposal and verify only the requested research files change on the host filesystem.
9. Confirm Act/Apply never stages or commits the live repository index.

## Pre-existing dirty tracked note

1. Modify a tracked research note manually without committing it.
2. Request an Act change to that same note.
3. Confirm the patch baseline starts from the manually edited content, not from the older Git HEAD content.
4. Without changing the live note again, Apply should be allowed if the patch still applies and Doctor passes.
5. Confirm the pre-existing manual edit remains present after Apply.

## Post-review drift protection

1. Create an Act proposal that changes an existing note.
2. Before Apply, edit that same live note in another editor.
3. Confirm Apply returns a conflict naming that file and does not overwrite the newer edit.
4. Create another Act proposal that adds a new file.
5. Before Apply, create a file at the same path manually.
6. Confirm Apply treats the newly occupied path as a conflict.
7. For a reviewed existing file, replace it with a symlink or directory before Apply and confirm it is rejected as a changed/unsafe state.

## Accidental staging inside the isolated worktree

The implementation restores the frozen baseline index after the Codex turn. To validate this manually in a development harness:

1. Stage the live research snapshot inside the detached review worktree and record its tree with `git write-tree`.
2. Modify a research file and run `git add` on that changed file, simulating accidental agent staging.
3. Restore the saved tree with `git read-tree <baseline-tree>` without resetting the working tree.
4. Collect the proposal diff.
5. Confirm the staged Codex edit is still visible in the patch relative to the original live snapshot.

## Custom `progressDir`

1. Set `progressDir` in `research-observer.config.json` to another directory inside the repository, for example `research-data`.
2. Put/import research under that directory.
3. Confirm compiler, Projects, Notes, Evidence, Direct Edit, and Codex Act all resolve the same root.
4. Request Act and confirm its boundary names `research-data/`, not hard-coded `progress/`.
5. Confirm a Codex change outside `research-data/` makes the proposal invalid.
6. Confirm Apply independently rejects proposal metadata whose touched files fall outside the reviewed research root.
7. Restore the normal config after the test.

## Docker bind mount

With the supplied Compose setup:

```bash
docker compose up --build
```

1. Import a project so it exists in the host-bound research directory.
2. Leave it uncommitted in the host repository.
3. Run Act and confirm the isolated worktree receives a snapshot of `/app/progress` even though the source is a bind mount.
4. Apply a valid reviewed change and confirm the host-mounted source file changes.
5. Recreate the container and confirm the research change persists because source files live on the host bind mount.
6. Confirm Codex authorization also persists through normal recreation via `CODEX_HOME=/app/.research-observer/codex` in the `observaire-state` volume.

## Rollback failure boundary

1. Force a proposal that applies but causes Doctor to fail in a controlled fixture.
2. Confirm Apply reverses the patch and reports the Doctor output.
3. In a controlled harness, make the reverse patch fail.
4. Confirm the API reports that automatic rollback failed and does **not** claim the workspace was restored.

Do not call this workflow fully verified until the focused Git test, full repository checks, browser Act/Apply path, custom research-root path, and Docker host-persistence path have all executed against the exact merge candidate.
