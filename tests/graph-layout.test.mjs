import assert from "node:assert/strict";
import test from "node:test";
import {
  clampGraphPoint,
  fitGraphViewport,
  graphDegreeMap,
  graphNeighborhood,
  initialGraphPositions,
} from "../lib/research/graph-layout.mjs";

const nodes = [
  { slug: "q", order: 1, research: "alpha" },
  { slug: "h", order: 2, research: "alpha" },
  { slug: "e", order: 3, research: "alpha" },
  { slug: "r", order: 4, research: "beta" },
];

const edges = [
  { source: "h", target: "q", explicit: true },
  { source: "e", target: "h", explicit: true },
  { source: "r", target: "e", explicit: false },
];

test("graph neighborhood expands by requested depth", () => {
  assert.deepEqual([...graphNeighborhood(edges, "h", 1)].sort(), ["e", "h", "q"]);
  assert.deepEqual([...graphNeighborhood(edges, "h", 2)].sort(), ["e", "h", "q", "r"]);
  assert.deepEqual([...graphNeighborhood(edges, "h", 2, { explicitOnly: true })].sort(), ["e", "h", "q"]);
});

test("degree map counts both incoming and outgoing edges", () => {
  const degree = graphDegreeMap(nodes, edges);
  assert.equal(degree.get("q"), 1);
  assert.equal(degree.get("h"), 2);
  assert.equal(degree.get("e"), 2);
  assert.equal(degree.get("r"), 1);
});

test("initial positions are deterministic and finite", () => {
  const first = initialGraphPositions(nodes);
  const second = initialGraphPositions(nodes);
  assert.deepEqual(first, second);
  for (const point of Object.values(first)) {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
  }
});

test("graph points are clamped to safe world bounds", () => {
  assert.deepEqual(clampGraphPoint({ x: 9999, y: -9999 }), { x: 1700, y: -1100 });
});

test("fit viewport returns bounded zoom and centers visible nodes", () => {
  const positions = { a: { x: -1000, y: -500 }, b: { x: 1000, y: 500 } };
  const fitted = fitGraphViewport(positions, new Set(["a", "b"]));
  assert.ok(fitted.zoom >= 0.36 && fitted.zoom <= 2.2);
  assert.ok(Number.isFinite(fitted.panX));
  assert.ok(Number.isFinite(fitted.panY));
  assert.equal(fitted.panX, 0);
  assert.equal(fitted.panY, 0);
});
