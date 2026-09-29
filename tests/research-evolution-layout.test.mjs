import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("provenance graph bounds visible nodes per lane and discloses hidden nodes", async () => {
  const source = await fs.readFile(path.join(root, "components/EvolutionGraph.tsx"), "utf8");
  assert.match(source, /const MAX_VISIBLE_PER_LANE = \d+;/);
  assert.match(source, /items\.slice\(0, MAX_VISIBLE_PER_LANE\)/);
  assert.match(source, /Showing \$\{displayNodes\.length\} of \$\{filteredNodes\.length\}/);
});

test("provenance graph keeps oversized SVG content inside its own scroller", async () => {
  const css = await fs.readFile(path.join(root, "components/EvolutionGraph.module.css"), "utf8");
  assert.match(css, /\.scroller\s*\{[^}]*\bheight\s*:\s*clamp\(/s);
  assert.match(css, /\.scroller\s*\{[^}]*\boverflow\s*:\s*auto\s*;/s);
  assert.doesNotMatch(css, /\.scroller\s*\{[^}]*\bwidth\s*:\s*100vw\s*;/s);
});
