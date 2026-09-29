import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("graph page loads explicit claim projection only for Provenance view", async () => {
  const source = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  assert.match(source, /const claimRequest = view === "provenance"/);
  assert.match(source, /loadManuscriptClaimProjection\(\{ projectId \}\)/);
  assert.match(source, /Promise\.resolve<ManuscriptClaimProjection \| null>\(null\)/);
});

test("claim scan failures remain optional and do not replace canonical graph projection", async () => {
  const source = await fs.readFile(path.join(root, "app/graph/page.tsx"), "utf8");
  assert.match(source, /Promise\.allSettled\(/);
  assert.match(source, /claimAvailable = claimResult\.value\.stats\.manuscriptFiles > 0/);
  assert.match(source, /claim scan unavailable/);
});
