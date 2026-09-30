import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("editor palette exposes explicit Claim and Claim↔Evidence transforms", async () => {
  const assistant = await fs.readFile(path.join(root, "components/LatexEditorAssistant.tsx"), "utf8");
  const tools = await fs.readFile(path.join(root, "lib/research/latex-editor-tools.mjs"), "utf8");
  assert.match(assistant, /insertObservaireClaimAnchor/);
  assert.match(assistant, /id === "claim-anchor"/);
  assert.match(tools, /id: "claim-anchor"/);
  assert.match(tools, /% observaire:claim claim-id/);
  assert.match(assistant, /insertObservaireClaimEvidenceRelation/);
  assert.match(assistant, /id === "claim-evidence"/);
  assert.match(tools, /id: "claim-evidence"/);
  assert.match(tools, /% observaire:claim-evidence/);
});

test("provenance graph has explicit Claim and Claim↔Evidence relationship toggles", async () => {
  const graph = await fs.readFile(path.join(root, "components/EvolutionGraph.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/EvolutionGraph.module.css"), "utf8");
  assert.match(graph, /"passage", "claim", "manuscript"/);
  assert.match(graph, /claim: "Explicit claims"/);
  assert.match(graph, /"claim-evidence": "Claim ↔ evidence"/);
  assert.match(graph, /const TRACE_DEPTH = 7/);
  assert.match(css, /\.layer_claim\s*\{/);
  assert.match(css, /\.layer_claim-evidence\s*\{/);
  assert.match(css, /\.node\[data-kind="claim"\]/);
});
