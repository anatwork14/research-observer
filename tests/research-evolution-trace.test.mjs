import assert from "node:assert/strict";
import test from "node:test";
import { traceEvolutionNeighborhood } from "../lib/research/evolution-trace.mjs";

const chain = [
  { source: "paper", target: "annotation" },
  { source: "annotation", target: "evidence" },
  { source: "evidence", target: "citation" },
  { source: "citation", target: "manuscript" },
  { source: "manuscript", target: "revision" },
];

test("provenance trace reaches a full paper-to-revision path", () => {
  assert.deepEqual(
    [...traceEvolutionNeighborhood(chain, "paper", 6)],
    ["paper", "annotation", "evidence", "citation", "manuscript", "revision"],
  );
});

test("provenance trace respects the depth bound and cycles", () => {
  const cyclic = [...chain, { source: "revision", target: "evidence" }];
  const shallow = traceEvolutionNeighborhood(cyclic, "paper", 2);
  assert.deepEqual([...shallow], ["paper", "annotation", "evidence"]);
  const deep = traceEvolutionNeighborhood(cyclic, "paper", 12);
  assert.equal(deep.size, 6);
});
