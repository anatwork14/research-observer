import assert from "node:assert/strict";
import test from "node:test";
import { orderVersionLineages } from "../lib/research/version-lineage.mjs";

const nodes = [
  { id: "research:v1", label: "Version 1", date: "2026-09-30", order: 30 },
  { id: "research:v2", label: "Version 2", date: "2026-09-01", order: 10 },
  { id: "research:v3", label: "Version 3", order: 5 },
];

const edges = [
  { source: "research:v3", target: "research:v2", type: "supersedes", layer: "version", explicit: true },
  { source: "research:v2", target: "research:v1", type: "supersedes", layer: "version", explicit: true },
];

test("lineage display follows supersedes direction rather than dates or order", () => {
  const [lineage] = orderVersionLineages([
    { id: "lineage:test", members: ["research:v3", "research:v1", "research:v2"], newest: [], oldest: [], cyclic: false },
  ], edges, nodes);

  assert.deepEqual(lineage.members, ["research:v1", "research:v2", "research:v3"]);
  assert.deepEqual(lineage.oldest, ["research:v1"]);
  assert.deepEqual(lineage.newest, ["research:v3"]);
  assert.equal(lineage.cyclic, false);
});

test("branching supersedes lineage remains deterministic and preserves multiple newest nodes", () => {
  const branchEdges = [
    { source: "research:v2", target: "research:v1", type: "supersedes", layer: "version", explicit: true },
    { source: "research:v3", target: "research:v1", type: "supersedes", layer: "version", explicit: true },
  ];
  const [lineage] = orderVersionLineages([
    { id: "lineage:branch", members: ["research:v1", "research:v2", "research:v3"], newest: [], oldest: [], cyclic: false },
  ], branchEdges, nodes);

  assert.equal(lineage.members[0], "research:v1");
  assert.deepEqual(new Set(lineage.newest), new Set(["research:v2", "research:v3"]));
  assert.deepEqual(lineage.oldest, ["research:v1"]);
});

test("cyclic supersedes remains flagged and falls back to stable display order", () => {
  const cycle = [
    ...edges,
    { source: "research:v1", target: "research:v3", type: "supersedes", layer: "version", explicit: true },
  ];
  const [lineage] = orderVersionLineages([
    { id: "lineage:cycle", members: ["research:v1", "research:v2", "research:v3"], newest: [], oldest: [], cyclic: false },
  ], cycle, nodes);
  assert.equal(lineage.cyclic, true);
  assert.equal(lineage.members.length, 3);
});
