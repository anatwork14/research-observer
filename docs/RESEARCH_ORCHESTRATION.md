# Research orchestration

Observaire can coordinate several research streams without turning research notes into tasks or inferring workflow state from activity.

The orchestration control plane lives on `/projects` and reads optional metadata from `research-observer.config.json`. Research Markdown, project folders, experiments, evidence, and manuscript files keep their existing source-of-truth rules.

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

For an auto-discovered folder project, add a config entry with the same stable project ID when orchestration metadata is needed. Folder discovery remains the project source; the config entry attaches coordination metadata and does not replace the folder.

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

## Validation and safety

The orchestration model validates:

- supported status vocabulary;
- `dependsOn` as a list of project IDs;
- unknown project dependencies;
- self-dependencies;
- dependency cycles;
- text shape for `next` and `note`.

Invalid metadata remains visible as a configuration issue instead of being repaired or guessed automatically. `npm run doctor` reports the same orchestration issues against `research-observer.config.json`, so invalid coordination metadata fails the normal local quality gate.

This first orchestration slice is intentionally read-only. Edit `research-observer.config.json` locally to change orchestration metadata. A future local editing surface may reuse this contract, but must preserve explicit human control and stale-safe writes.

## Non-goals

The control plane does not:

- infer priorities or quality scores;
- infer `blocked` from health warnings;
- infer `done` from completed notes or experiments;
- schedule Codex/Consensus jobs automatically;
- mutate research files;
- create a parallel project database;
- treat cross-project research relationships as orchestration dependencies unless they are also explicitly listed in `dependsOn`.
