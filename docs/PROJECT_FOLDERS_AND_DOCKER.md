# Project folders, auto-indexing, and Docker persistence

Observaire treats the filesystem as the durable research database. For ordinary multi-project work, **one top-level folder under `progress/` is one research project**.

You do not need to add the project to `research-observer.config.json` first.

## Fastest workflow

From the repository root:

```bash
docker compose up --build
```

Open:

```text
http://127.0.0.1:4173
```

Then open **Projects** in Observaire and choose or drop a folder such as:

```text
My Research Project/
├── 00_question.md
├── 01_literature.md
├── 02_hypothesis.md
├── 03_experiment.md
├── papers/
│   └── source.pdf
└── figures/
    └── result.svg
```

Observaire will:

1. inspect the folder before writing it;
2. require at least one numbered Markdown note;
3. reject path traversal, unsupported file types, unsafe folder names, oversized browser imports, and project-ID collisions with populated projects;
4. stage the folder transactionally;
5. create `.observaire-project.json` if the folder does not already provide one;
6. move the validated folder into the workspace `progress/` directory;
7. compile and index the project immediately;
8. roll the imported folder back if it introduces compiler errors.

After success, the importer exposes direct **Open project notes** and **Open insights** actions.

The project appears in **Projects**, **Notes**, **Insights**, **Graph**, **Collections**, and search as soon as the workspace recompiles.

## Where the files really live

The supplied `compose.yaml` uses a **bind mount**, not a container-only filesystem, for research content:

```yaml
volumes:
  - "${OBSERVAIRE_RESEARCH_DIR:-./progress}:/app/progress"
```

With the defaults, a browser import of `My Research Project/` is physically written to:

```text
<repository>/progress/My Research Project/
```

on the host machine.

Stopping, deleting, rebuilding, or recreating the Observaire container does not remove those source files.

Generated indexes remain rebuildable output. They are not the durable research database.

## You can also copy folders directly on the host

The web importer is optional. You can copy or create a folder directly under the host `progress/` directory:

```text
progress/
└── New Historical Study/
    ├── 00_scope.md
    ├── 01_sources.md
    └── 02_analysis.md
```

The development watcher recompiles changes automatically. Docker Compose also sets:

```text
OBSERVAIRE_WATCH_POLL_MS=1000
```

so bind-mounted changes are detected even on Docker Desktop/filesystems where recursive filesystem events are unreliable.

## Project identity

A folder containing ordered notes is automatically registered.

For example:

```text
progress/My Retrieval Study/
```

normally receives the derived project ID:

```text
my-retrieval-study
```

When Observaire imports the folder through the website, it writes a folder-local manifest:

```text
progress/My Retrieval Study/.observaire-project.json
```

Example:

```json
{
  "schemaVersion": 1,
  "id": "my-retrieval-study",
  "label": "My Retrieval Study",
  "description": "Imported from the My Retrieval Study folder and auto-indexed by Observaire."
}
```

You may provide this file yourself when you need a stable project ID/label that should not change if the directory is renamed.

A valid project manifest contains:

```json
{
  "schemaVersion": 1,
  "id": "stable-kebab-case-id",
  "label": "Human readable label",
  "description": "Optional description"
}
```

The browser importer refuses an incoming ID that is already used by a populated project. Rename the folder or give the incoming manifest a different stable ID rather than silently merging two research histories.

## Ordering is per project

Each project owns its own sequence.

This is valid:

```text
progress/
├── Project A/
│   ├── 00_question.md
│   ├── 01_method.md
│   └── 02_result.md
└── Project B/
    ├── 00_question.md
    ├── 01_literature.md
    └── 02_experiment.md
```

`00` is not globally unique. Observaire reports duplicate-order diagnostics only when two files share an order **inside the same project**.

The note reader's left rail and previous/next buttons also stay within the active project.

## Frontmatter project field

Inside a folder-backed project, you normally do **not** need:

```yaml
research: my-project
```

Folder membership supplies the project scope.

If a nested note includes `research` and it conflicts with the folder project, the folder wins and Observaire emits a diagnostic instead of silently splitting the note into another project.

Root-level legacy notes remain compatible. A root-level note may still use:

```yaml
research: configured-project-id
```

and `researchProjects` in `research-observer.config.json` remains supported for legacy/root-level notes, advanced metadata, and intentionally predeclared projects.

## Assets, evidence, and relative links

Assets can live inside the project tree:

```text
My Research Project/
├── 00_question.md
├── 01_literature.md
├── papers/
│   └── paper.pdf
└── figures/
    └── chart.svg
```

Relative Markdown remains portable:

```md
![Chart](figures/chart.svg)

[Paper](papers/paper.pdf)

See [the literature note](01_literature.md).
```

An intentional cross-project file link may use a relative path such as:

```md
See [Evaluation method](../Evaluation Study/01_method.md).
```

For semantic relationships, prefer stable object IDs in frontmatter `relationships` rather than file paths. If the same filename exists in more than one project, evidence creation rejects that filename as an ambiguous semantic target and asks for the stable ID.

Evidence generated from a folder-backed project stays in that project folder. For example, if a folder has `00_question.md` and `01_literature.md`, the next captured evidence may become:

```text
My Research Project/02_evidence_....md
```

rather than a root-level `progress/` file. Local PDF provenance is written relative to the evidence note, so `papers/paper.pdf` remains portable if the project folder moves.

Configured/root-level projects keep the existing root-level evidence behavior for backwards compatibility.

## ChatGPT Web → Projects import

The prompt generator in **Instruction** now asks ChatGPT Web to produce the same folder contract the Projects importer accepts:

```text
<Project Folder>/
├── .observaire-project.json
├── 00_primary_question.md
├── 01_main_hypothesis.md
├── 02_research_method.md
├── 03_first_experiment.md
└── 04_research_map.md
```

That generated bundle does not need a manual `researchProjects` config entry and normally omits `research:` from each note.

## Change the host research directory

You can keep research somewhere other than the repository's `progress/` folder:

```bash
OBSERVAIRE_RESEARCH_DIR=/absolute/path/to/research docker compose up --build
```

Observaire still sees it at `/app/progress` inside the container, while the files remain at the path you chose on the host.

When an external research mount does not include the repository's `progress/AGENTS.md`, the **Instruction** page remains available and falls back to the repository-level contract, data contract, JSON Schema, and live workspace config.

Git-backed Direct Edit/Codex review works most naturally with the default repository `progress/` bind mount because the mounted `.git` metadata describes that worktree. External research directories remain valid for indexing, browsing, import, and normal filesystem-backed edits, but should not be assumed to share the repository's Git history.

Change the browser port if needed:

```bash
OBSERVAIRE_PORT=4180 docker compose up --build
```

Then open `http://127.0.0.1:4180`.

On Linux, if your host UID/GID are not 1000, you can preserve host ownership with:

```bash
OBSERVAIRE_UID=$(id -u) OBSERVAIRE_GID=$(id -g) docker compose up --build
```

The persistent Observaire state mount is writable by the runtime user, and Codex creates its own home under that state mount.

## What Docker stores separately

The research source directory is a host bind mount.

Observaire keeps runtime state in the Docker named volume:

```text
observaire-state
```

This includes local integration settings and `CODEX_HOME` (`/app/.research-observer/codex`), so an in-app Codex sign-in can survive normal container stop/rebuild/recreation.

`docker compose down` preserves named volumes. `docker compose down -v` intentionally deletes this local runtime/auth state, but still does **not** delete bind-mounted research source files.

Runtime state is not a substitute for research source files.

## Browser import safety

The current browser importer intentionally does **not** merge into or overwrite an existing project directory. If the folder already exists, edit/copy files directly in the host project folder or rename the incoming folder.

It also rejects a project ID already used by an existing populated project. This prevents a differently named folder/manifest from silently joining another research history.

This conservative rule avoids accidentally replacing or merging research history through a browser upload.

For very large project trees, copy them directly into the host research directory instead of sending them through the browser. Direct host copies are still automatically indexed.

## Verification

After changing research files directly:

```bash
npm run doctor
```

For application changes:

```bash
npm run check
```

For a release candidate:

```bash
npm run check:full
```

The canonical content rules are in `docs/OBSERVAIRE_DATA_CONTRACT.md`.
