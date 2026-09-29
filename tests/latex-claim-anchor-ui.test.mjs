import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("editor palette exposes the explicit claim anchor transform", async () => {
  const assistant = await fs.readFile(path.join(root, "components/LatexEditorAssistant.tsx"), "utf8");
  const tools = await fs.readFile(path.join(root, "lib/research/latex-editor-tools.mjs"), "utf8");
  assert.match(assistant, /insertObservaireClaimAnchor/);
  assert.match(assistant, /id === "claim-anchor"/);
  assert.match(tools, /id: "claim-anchor"/);
  assert.match(tools, /% observaire:claim claim-id/);
});

test("provenance graph has a dedicated explicit-claim lane and relationship toggle", async () => {
  const graph = await fs.readFile(path.join(root, "components/EvolutionGraph.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/EvolutionGraph.module.css"), "utf8");
  assert.match(graph, /"passage", "claim", "manuscript"/);
  assert.match(graph, /claim: "Explicit claims"/);
  assert.match(graph, /claim: "Explicit claims"/);
  assert.match(graph, /const TRACE_DEPTH = 7/);
  assert.match(css, /\.layer_claim\s*\{/);
  assert.match(css, /\.node\[data-kind="claim"\]/);
});
