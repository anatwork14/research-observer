import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { previewResearchScaffold } from "../lib/research/new-research-scaffold.mjs";

async function rootWithVocabulary(t, allowedRelationshipTypes = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-scaffold-safety-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "progress"), { recursive: true });
  await fs.writeFile(path.join(root, "research-observer.config.json"), JSON.stringify({
    progressDir: "progress",
    warnOnMissingId: true,
    strictVocabulary: true,
    allowedTypes: ["question", "note", "hypothesis", "experiment"],
    allowedStatuses: ["idea"],
    allowedRelationshipTypes,
    allowedMediaExtensions: [".pdf"],
    maxAssetBytes: 1048576,
    researchProjects: [{ id: "default", label: "Main research" }],
    savedCollections: [],
  }, null, 2));
  return root;
}

const minimalPlan = {
  overview: "Reviewable planning context.",
  hypotheses: [{
    title: "Bounded hypothesis",
    statement: "A bounded change improves the measured outcome.",
    falsificationCriterion: "The measured outcome does not improve.",
    derivedFromGaps: [],
    sourceIds: [],
  }],
  experiments: [{
    title: "Bounded experiment",
    hypothesisTitle: "Bounded hypothesis",
    design: "Compare treatment and baseline under fixed controls.",
    independentVariables: ["treatment"],
    dependentVariables: ["outcome"],
    controls: ["dataset"],
    metrics: ["outcome"],
    confounders: [],
    stoppingCriteria: ["planned sample complete"],
  }],
};

test("scaffold respects custom relationship vocabulary instead of widening it", async (t) => {
  const root = await rootWithVocabulary(t, []);
  const preview = await previewResearchScaffold({
    rootDir: root,
    topic: "Vocabulary-safe scaffold",
    plan: minimalPlan,
    target: { mode: "new", projectLabel: "Vocabulary Study" },
  });
  assert.equal(preview.files.flatMap((file) => file.relationships).length, 0);
  assert.match(preview.files.find((file) => file.type === "experiment")?.content ?? "", /Tests the reviewed hypothesis/);
});

test("scaffold rejects raw executable or javascript content before preview", async (t) => {
  const root = await rootWithVocabulary(t, ["derived_from", "investigates"]);
  await assert.rejects(
    () => previewResearchScaffold({
      rootDir: root,
      topic: "Executable payload boundary",
      plan: {
        ...minimalPlan,
        overview: "<script>alert('no')</script>",
      },
      target: { mode: "new", projectLabel: "Safety Study" },
    }),
    /Embedded or executable content is not allowed/,
  );

  await assert.rejects(
    () => previewResearchScaffold({
      rootDir: root,
      topic: "Javascript payload boundary",
      plan: {
        ...minimalPlan,
        cautions: ["javascript:alert(1)"],
      },
      target: { mode: "new", projectLabel: "Safety Study" },
    }),
    /Embedded or executable content is not allowed/,
  );
});

test("new project folder names cannot escape the research root", async (t) => {
  const root = await rootWithVocabulary(t, ["derived_from", "investigates"]);
  const preview = await previewResearchScaffold({
    rootDir: root,
    topic: "Path-safe scaffold",
    plan: minimalPlan,
    target: { mode: "new", projectLabel: "../Escape Attempt" },
  });
  assert.equal(preview.target.directory.includes("/"), false);
  assert.equal(preview.target.directory.includes("\\"), false);
  assert.equal(preview.target.directory.startsWith(".."), false);
  assert.equal(preview.files.every((file) => !file.filename.startsWith("../")), true);
});
