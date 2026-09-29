import assert from "node:assert/strict";
import test from "node:test";
import { buildResearchVersionComparisons, compareResearchVersions } from "../lib/research/version-compare.mjs";

function version(slug, content, overrides = {}) {
  return {
    slug,
    title: overrides.title || slug,
    research: overrides.research || "default",
    status: overrides.status || "complete",
    date: overrides.date,
    content,
    text: content,
    words: overrides.words,
    headings: overrides.headings || [],
  };
}

test("version comparison reports added/removed lines, headings, and word delta", () => {
  const older = version("hypothesis-v1", "# Hypothesis\n\nAlpha assumption.\n\n## Limits\n\nOld limit.", {
    date: "2026-09-01",
    words: 6,
    headings: [{ level: 1, title: "Hypothesis" }, { level: 2, title: "Limits" }],
  });
  const newer = version("hypothesis-v2", "# Hypothesis\n\nAlpha assumption revised.\n\n## Evidence\n\nNew evidence.", {
    date: "2026-09-03",
    words: 7,
    headings: [{ level: 1, title: "Hypothesis" }, { level: 2, title: "Evidence" }],
  });

  const comparison = compareResearchVersions(older, newer);
  assert.equal(comparison.older.slug, "hypothesis-v1");
  assert.equal(comparison.newer.slug, "hypothesis-v2");
  assert.equal(comparison.wordDelta, 1);
  assert.deepEqual(comparison.headings.added, ["Evidence"]);
  assert.deepEqual(comparison.headings.removed, ["Limits"]);
  assert.ok(comparison.addedLines > 0);
  assert.ok(comparison.removedLines > 0);
  assert.ok(comparison.diff.some((line) => line.kind === "added" && /revised|Evidence|New evidence/.test(line.text)));
  assert.ok(comparison.diff.some((line) => line.kind === "removed" && /Old limit|Limits|Alpha assumption/.test(line.text)));
});

test("workspace comparison follows explicit supersedes direction only", () => {
  const v1 = version("v1", "one", { research: "default", date: "2026-09-01" });
  const v2 = version("v2", "two", { research: "default", date: "2026-09-02" });
  const unrelated = version("other", "other", { research: "other", date: "2026-09-03" });
  const workspace = {
    entries: [v1, v2, unrelated],
    graph: {
      edges: [
        { source: "v2", target: "v1", type: "supersedes", explicit: true },
        { source: "other", target: "v2", type: "supersedes", explicit: true },
        { source: "v1", target: "v2", type: "references", explicit: false },
      ],
    },
  };

  const comparisons = buildResearchVersionComparisons(workspace, { projectId: "default" });
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].older.slug, "v1");
  assert.equal(comparisons[0].newer.slug, "v2");
});

test("large comparisons are bounded and report truncation", () => {
  const older = version("old", Array.from({ length: 300 }, (_, index) => `old ${index}`).join("\n"));
  const newer = version("new", Array.from({ length: 300 }, (_, index) => `new ${index}`).join("\n"));
  const comparison = compareResearchVersions(older, newer);
  assert.equal(comparison.truncated, true);
  assert.ok(comparison.addedLines <= 240);
  assert.ok(comparison.removedLines <= 240);
});
