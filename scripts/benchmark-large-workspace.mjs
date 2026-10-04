import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  applyReverseResearchIndexes,
  syncGeneratedResearchMedia,
} from "../lib/research/compiler-performance.mjs";

function numericArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function syntheticEntries(count) {
  return Array.from({ length: count }, (_, index) => ({
    slug: `note-${index}`,
    linkedSlugs: [
      ...(index + 1 < count ? [`note-${index + 1}`] : []),
      ...(index + 7 < count ? [`note-${index + 7}`] : []),
    ],
    relationships: index + 3 < count
      ? [{ type: index % 2 ? "supports" : "references", target: `note-${index + 3}` }]
      : [],
    backlinks: [],
    incomingRelationships: [],
  }));
}

async function main() {
  const notes = numericArg("notes", 20_000);
  const assetCount = numericArg("assets", 12);
  const assetMb = numericArg("asset-mb", 2);
  const entries = syntheticEntries(notes);

  const graphStarted = performance.now();
  applyReverseResearchIndexes(entries);
  const graphMs = performance.now() - graphStarted;

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-large-workspace-benchmark-"));
  try {
    const progressRoot = path.join(root, "progress");
    const mediaDir = path.join(root, "public", "_research", "media");
    const statePath = path.join(root, ".research-observer", "research-media-state.json");
    await fs.mkdir(path.join(progressRoot, "papers"), { recursive: true });
    const payload = Buffer.alloc(assetMb * 1024 * 1024, 17);
    const assets = [];
    for (let index = 0; index < assetCount; index += 1) {
      const relative = `papers/paper-${String(index).padStart(3, "0")}.pdf`;
      await fs.writeFile(path.join(progressRoot, ...relative.split("/")), payload);
      assets.push({ path: relative, extension: ".pdf", size: payload.length });
    }

    const firstStarted = performance.now();
    const first = await syncGeneratedResearchMedia({ progressRoot, mediaDir, statePath, assets, allowedExtensions: [".pdf"] });
    const firstMs = performance.now() - firstStarted;

    const secondStarted = performance.now();
    const second = await syncGeneratedResearchMedia({ progressRoot, mediaDir, statePath, assets, allowedExtensions: [".pdf"] });
    const secondMs = performance.now() - secondStarted;

    console.log(JSON.stringify({
      notes,
      reverseIndexMs: Number(graphMs.toFixed(2)),
      assets: assetCount,
      assetMb,
      totalAssetMb: assetCount * assetMb,
      firstMediaSyncMs: Number(firstMs.toFixed(2)),
      secondMediaSyncMs: Number(secondMs.toFixed(2)),
      firstMediaSync: first,
      secondMediaSync: second,
    }, null, 2));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

await main();
