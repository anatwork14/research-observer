# Large workspace performance contract

Observaire remains local-first and filesystem-first. Performance work must not introduce a database, remote index, background service, or second durable source of truth.

This checkpoint targets two costs that grow badly as a local workspace accumulates notes and large research assets.

## 1. Reverse research indexes

Canonical note parsing resolves ordinary Markdown links and explicit typed relationships in source order.

Historically, backlinks and incoming typed relationships were then derived by scanning the entire entry list once for every target entry. That made the reverse-index phase quadratic in the number of research objects even when the number of actual links/relationships remained sparse.

`applyReverseResearchIndexes()` now builds both reverse indexes in one pass over authored edges and a final pass over entries:

```text
O(notes + links + typed relationships)
```

Ordering is intentionally unchanged:

- backlinks preserve canonical source-entry order;
- incoming typed relationships preserve source-entry order;
- multiple relationships from one source preserve authored relationship order;
- relationship notes remain attached to the same edge.

This is an implementation optimization only. It does not add, remove, infer, or reinterpret relationships.

## 2. Incremental generated-media mirror

`public/_research/media/` is generated/rebuildable output. Durable assets remain under `progress/`.

Previously each `writeResearchArtifacts()` call removed the whole generated media tree and recopied every approved PDF, image, audio/video, data, and text asset. A small Markdown edit could therefore recopy gigabytes of unchanged local research data.

The compiler now keeps a transient media fingerprint state at:

```text
.research-observer/research-media-state.json
```

Each approved source asset is tracked by:

```text
relative path
size
mtimeMs
```

Those are the same filesystem-level change signals already used by the research workspace signature.

On the next artifact write:

- unchanged generated files with matching source fingerprint and size are reused;
- changed/new assets are copied;
- generated files no longer present in the canonical asset set are removed;
- untracked generated files are removed so the media directory remains a mirror;
- source and destination symlinks are not trusted;
- corrupt/missing cache state or an unsafe generated tree causes a full generated-media rebuild;
- cache state is written atomically after a successful sync.

The cache is disposable. Deleting `.research-observer/research-media-state.json` only causes the next artifact write to rebuild generated media.

## Safety boundaries

Performance optimization must preserve these invariants:

1. `progress/` remains canonical research and asset source.
2. `.research-observer/` remains transient/rebuildable.
3. `public/_research/` remains generated output.
4. No source asset is modified, renamed, deleted, or rewritten by generated-media sync.
5. Unsupported assets remain excluded from the generated media mirror.
6. Cache corruption degrades to rebuild rather than stale trust.
7. Generated symlink state degrades to rebuild rather than traversal/following.
8. Existing compiler diagnostics, graph semantics, routes, backlinks, incoming relationships, and project scoping remain unchanged.

## Reproducible benchmark

Run:

```bash
node scripts/benchmark-large-workspace.mjs
```

Defaults:

```text
20,000 synthetic research entries
12 generated PDF assets
2 MiB per PDF
```

Override sizes without editing source:

```bash
node scripts/benchmark-large-workspace.mjs --notes=50000 --assets=24 --asset-mb=4
```

The benchmark reports:

- reverse-index time;
- first generated-media sync time;
- second unchanged sync time;
- copied/skipped/removed counts.

It uses a temporary directory and removes it after completion.

Timing is diagnostic rather than a hard unit-test threshold because filesystem and machine performance vary. Correctness tests assert the durable behavior; verification should record benchmark measurements from the target machine.

## Verification focus

For a large-workspace verification run, confirm:

- canonical compiler tests remain byte/semantic compatible;
- backlinks and incoming relationships match the pre-optimization ordering;
- 10k+ synthetic reverse indexing completes without pathological growth;
- first media sync copies all approved assets;
- second unchanged sync reports zero copies;
- changing one asset copies only that asset;
- removing one source asset removes only its generated mirror;
- an untracked generated file is removed;
- corrupt transient state forces a clean rebuild;
- source files are byte-identical before and after all syncs;
- repeated `writeResearchArtifacts()` keeps unchanged generated media mtimes stable;
- light/dark/browser behavior is unchanged because this checkpoint has no product UI redesign.
