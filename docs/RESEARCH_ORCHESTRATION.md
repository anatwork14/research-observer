# Research orchestration

Observaire can coordinate several research streams without turning research notes into tasks or inferring workflow state from activity.

The orchestration control plane lives on `/projects` and stores optional metadata in `research-observer.config.json`. Research Markdown, project folders, experiments, evidence, and manuscript files keep their existing source-of-truth rules.

## Project metadata

A configured project may add an `orchestration` object:

```json
{
  "id": "retrieval",
  "label": "Retrieval",
  "description": "Retrieval experiments and evidence.",
  "orchestration": {
    "status": "active",
    "dependsOn": ["evaluation"],
    "next": "Run the retrieval benchmark against the frozen evaluation set.",
    "note": "Keep this stream active while evaluation data is finalized."
  }
}
```

For an auto-discovered folder project, the local editor can add a config entry with the same stable project ID when orchestration metadata is first saved. Folder discovery remains the project source; the config entry attaches coordination metadata and does not replace the folder.

## Declared statuses

The supported orchestration statuses are:

```text
queued
active
blocked
done
```

Status is explicit authored workflow metadata. Observaire never changes it automatically from note activity, compiler health, experiment results, dependency state, evidence coverage, or AI output.

Projects without an `orchestration` object remain fully usable and appear as `Untracked` in the control plane.

## Dependencies

`dependsOn` contains stable research project IDs.

```json
{
  "status": "active",
  "dependsOn": ["evaluation", "dataset-curation"]
}
```

Dependency state is derived informational context only:

- `clear`: every declared dependency is explicitly `done`;
- `waiting`: at least one declared dependency exists but is not `done`;
- `invalid`: a dependency is missing, self-referential, or belongs to a dependency cycle.

A project declared `active` stays `active` even when its dependency state is `waiting`. Observaire does not silently rewrite it to `blocked`.

Dependencies are directional. `retrieval dependsOn evaluation` does not imply the reverse edge.

## Next step and note

`next` and `note` are optional plain text:

- `next` is the explicitly declared next action for the research stream;
- `note` is short coordination context.

They are not generated from note content and are not executed automatically.

## Control plane

`/projects` shows:

- declared status lanes;
- tracked/untracked counts;
- waiting and invalid dependency context;
- explicit dependency flow;
- next steps and notes;
- latest dated research objects as factual activity context;
- links to Notes, Insights, and Experiments.

Latest activity does not decide project status. It is displayed only to help orient the user.

## Local editor

Each project card exposes **Edit coordination** when the `/projects` UI is available. The editor changes only that project's orchestration metadata:

- declared status;
- explicit dependencies;
- next declared step;
- coordination note.

The editing sequence is intentionally explicit:

1. Open the editor and load the current config hash.
2. Change the draft locally in the browser.
3. Select **Preview changes**.
4. Observaire validates the exact draft and shows a before → after review plus dependency context.
5. **Save reviewed change** is enabled only while the form still matches that reviewed draft.
6. Save re-validates the draft against the current on-disk config before writing.

Changing any form field after preview invalidates the review and requires another preview. There is no autosave.

Choosing `Untracked` removes only the project's `orchestration` property. It does not delete the project config entry, folder, research notes, experiments, evidence, or assets.

### Stale-write protection

The editor hashes the exact bytes of `research-observer.config.json`. Preview and save both require that hash to remain current.

If the config changes on disk after the editor opens, Observaire rejects the operation rather than overwriting newer work. The user must reload current values, preview again, and then save.

### Atomic local writes

A successful save writes a temporary file beside `research-observer.config.json` and promotes it with a filesystem rename. Unrelated top-level config fields and unrelated project metadata are preserved.

After promotion, Observaire rebuilds generated research artifacts. If compiler validation fails, it restores the previous config bytes and rebuilds the prior generated state.

### Local write policy

Development enables orchestration editing by default, matching the existing local research-write policy. A production build remains read-only unless:

```text
RESEARCH_OBSERVER_WRITES=1
```

is explicitly configured for that local runtime.

Mutation requests are same-origin only. The API does not expose a generic filesystem path or arbitrary JSON-file editor.

## Validation and safety

The orchestration model validates:

- supported status vocabulary;
- `dependsOn` as a list of project IDs;
- unknown project dependencies;
- self-dependencies;
- dependency cycles;
- text shape and bounded size for `next` and `note`.

Invalid metadata remains visible as a configuration issue instead of being repaired or guessed automatically. `npm run doctor` reports orchestration issues against `research-observer.config.json`, so invalid coordination metadata fails the normal local quality gate.

The editor uses the same orchestration model for preview; it does not maintain a parallel validation vocabulary.

## Non-goals

The control plane and editor do not:

- infer priorities or quality scores;
- infer `blocked` from health warnings;
- infer `done` from completed notes or experiments;
- schedule Codex/Consensus jobs automatically;
- mutate research Markdown or manuscript files;
- create a parallel project database;
- provide a generic config-file editor;
- treat cross-project research relationships as orchestration dependencies unless they are also explicitly listed in `dependsOn`.
