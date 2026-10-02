import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  parseResearchProjectScope,
  primaryResearchProject,
  serializeResearchProjectScope,
  toggleResearchProjectScope,
} from "../lib/research/workspace-project-scope.mjs";

const root = process.cwd();

test("research scope parsing is ordered, exact, deduplicated, and optionally bounded to available projects", () => {
  assert.deepEqual(parseResearchProjectScope(["alpha,beta", " beta ,gamma", ""]), ["alpha", "beta", "gamma"]);
  assert.deepEqual(parseResearchProjectScope("alpha,missing,beta", { availableIds: ["alpha", "beta"] }), ["alpha", "beta"]);
  assert.equal(primaryResearchProject("alpha,beta"), "alpha");
  assert.equal(serializeResearchProjectScope(["alpha", "beta", "alpha"]), "alpha,beta");
});

test("research scope toggle keeps all-projects implicit and preserves available-project order", () => {
  const availableIds = ["alpha", "beta", "gamma"];
  assert.deepEqual(toggleResearchProjectScope(undefined, "beta", { availableIds }), ["beta"]);
  assert.deepEqual(toggleResearchProjectScope("beta", "alpha", { availableIds }), ["alpha", "beta"]);
  assert.deepEqual(toggleResearchProjectScope("alpha,beta", "gamma", { availableIds }), []);
  assert.deepEqual(toggleResearchProjectScope("alpha", "alpha", { availableIds }), []);
  assert.deepEqual(toggleResearchProjectScope("alpha", "missing", { availableIds }), ["alpha"]);
});

test("workspace selector exposes multi-project Insights scope with touch-safe controls", async () => {
  const selector = await fs.readFile(path.join(root, "components/WorkspaceProjectSelector.tsx"), "utf8");
  const navigation = await fs.readFile(path.join(root, "components/WorkspaceNavigation.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/WorkspaceProjectSelector.module.css"), "utf8");

  assert.match(selector, /pathname === "\/insights"/);
  assert.match(selector, /Keep several research tracks active together/);
  assert.match(selector, /toggleResearchProjectScope/);
  assert.match(selector, /aria-pressed=\{active\}/);
  assert.match(selector, /All projects/);
  assert.match(navigation, /section\.key === "insights"/);
  assert.match(navigation, /primaryResearchProject\(projectValues\)/);
  assert.match(navigation, /serializeResearchProjectScope\(projectScope\)/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*min-height:\s*44px/);
});
