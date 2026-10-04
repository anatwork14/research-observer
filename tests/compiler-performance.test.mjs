import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyReverseResearchIndexes,
  syncGeneratedResearchMedia,
} from "../lib/research/compiler-performance.mjs";
import { writeResearchArtifacts } from "../lib/research/compiler.mjs";

async function tempRoot(t, prefix = "observaire-performance-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

function makeEntries(count) {
  return Array.from({ length: count }, (_, index) => ({
    slug: `note-${index}`,
    linkedSlugs: index + 1 < count ? [`note-${index + 1}`] : [],
    relationships: index + 2 < count ? [{ type: "supports", target: `note-${index + 2}`, note: `edge-${index}` }] : [],
    backlinks: [],
    incomingRelationships: [],
  }));
}

test("reverse research indexes preserve source ordering on large synthetic workspaces", () => {
  const entries = makeEntries(12_000);
  applyReverseResearchIndexes(entries);

  assert.deepEqual(entries[1].backlinks, ["note-0"]);
  assert.deepEqual(entries[2].incomingRelationships, [{ type: "supports", source: "note-0", note: "edge-0" }]);
  assert.deepEqual(entries.at(-1).backlinks, [`note-${entries.length - 2}`]);
  assert.deepEqual(entries.at(-1).incomingRelationships, [{
    type: "supports",
    source: `note-${entries.length - 3}`,
    note: `edge-${entries.length - 3}`,
  }]);
});

test("generated media sync skips unchanged assets, recopies changes, and mirrors removals", async (t) => {
  const root = await tempRoot(t);
  const progressRoot = path.join(root, "progress");
  const mediaDir = path.join(root, "public", "_research", "media");
  const statePath = path.join(root, ".research-observer", "research-media-state.json");
  await fs.mkdir(path.join(progressRoot, "papers"), { recursive: true });
  await fs.mkdir(path.join(progressRoot, "figures"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(progressRoot, "papers", "a.pdf"), "%PDF-A-v1"),
    fs.writeFile(path.join(progressRoot, "figures", "b.svg"), "<svg>v1</svg>"),
  ]);

  const assets = [
    { path: "papers/a.pdf", extension: ".pdf", size: 9 },
    { path: "figures/b.svg", extension: ".svg", size: 13 },
  ];
  const allowedExtensions = [".pdf", ".svg"];

  const first = await syncGeneratedResearchMedia({ progressRoot, mediaDir, statePath, assets, allowedExtensions });
  assert.deepEqual(first, { total: 2, copied: 2, skipped: 0, removed: 0, fullRebuild: true });
  const firstPdfStat = await fs.stat(path.join(mediaDir, "papers", "a.pdf"));

  await new Promise((resolve) => setTimeout(resolve, 25));
  const second = await syncGeneratedResearchMedia({ progressRoot, mediaDir, statePath, assets, allowedExtensions });
  assert.deepEqual(second, { total: 2, copied: 0, skipped: 2, removed: 0, fullRebuild: false });
  const secondPdfStat = await fs.stat(path.join(mediaDir, "papers", "a.pdf"));
  assert.equal(secondPdfStat.mtimeMs, firstPdfStat.mtimeMs);

  await fs.writeFile(path.join(mediaDir, "rogue-generated.txt"), "must disappear");
  await new Promise((resolve) => setTimeout(resolve, 25));
  await fs.writeFile(path.join(progressRoot, "figures", "b.svg"), "<svg>v2 changed</svg>");
  const third = await syncGeneratedResearchMedia({ progressRoot, mediaDir, statePath, assets, allowedExtensions });
  assert.equal(third.copied, 1);
  assert.equal(third.skipped, 1);
  assert.equal(third.removed, 1);
  assert.match(await fs.readFile(path.join(mediaDir, "figures", "b.svg"), "utf8"), /v2 changed/);
  await assert.rejects(fs.stat(path.join(mediaDir, "rogue-generated.txt")), (error) => error?.code === "ENOENT");

  const fourth = await syncGeneratedResearchMedia({
    progressRoot,
    mediaDir,
    statePath,
    assets: [assets[1]],
    allowedExtensions,
  });
  assert.equal(fourth.removed, 1);
  await assert.rejects(fs.stat(path.join(mediaDir, "papers", "a.pdf")), (error) => error?.code === "ENOENT");

  await fs.writeFile(statePath, "{ broken state", "utf8");
  const fifth = await syncGeneratedResearchMedia({
    progressRoot,
    mediaDir,
    statePath,
    assets: [assets[1]],
    allowedExtensions,
  });
  assert.equal(fifth.fullRebuild, true);
  assert.equal(fifth.copied, 1);
  assert.equal(fifth.skipped, 0);
});

test("writeResearchArtifacts preserves unchanged generated media bytes without recopying", async (t) => {
  const root = await tempRoot(t, "observaire-performance-integration-");
  await fs.mkdir(path.join(root, "progress", "papers"), { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    allowedTypes: ["literature"],
    allowedStatuses: ["complete"],
    allowedMediaExtensions: [".pdf"],
    allowedRelationshipTypes: ["references"],
    strictVocabulary: true,
  }));
  await fs.writeFile(path.join(root, "progress", "00_paper.md"), [
    "---",
    "id: large-paper",
    "type: literature",
    "status: complete",
    "pdf: papers/large.pdf",
    "---",
    "",
    "# Large paper",
    "",
  ].join("\n"));
  await fs.writeFile(path.join(root, "progress", "papers", "large.pdf"), Buffer.alloc(256 * 1024, 7));

  await writeResearchArtifacts({ rootDir: root, fresh: true });
  const generated = path.join(root, "public", "_research", "media", "papers", "large.pdf");
  const first = await fs.stat(generated);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await writeResearchArtifacts({ rootDir: root, fresh: true });
  const second = await fs.stat(generated);

  assert.equal(second.size, first.size);
  assert.equal(second.mtimeMs, first.mtimeMs, "unchanged generated media should be reused, not recopied");
});
