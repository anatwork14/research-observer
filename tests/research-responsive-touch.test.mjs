import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("version-difference surfaces keep coarse-pointer controls touch-sized", async () => {
  const timeline = await fs.readFile(path.join(root, "components/ResearchEvolutionTimeline.module.css"), "utf8");
  const compare = await fs.readFile(path.join(root, "components/ResearchVersionCompare.module.css"), "utf8");

  assert.match(timeline, /@media \(pointer:\s*coarse\)[\s\S]*\.controls input,[\s\S]*\.controls button,[\s\S]*\.event,[\s\S]*\.versionStep button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(compare, /@media \(pointer:\s*coarse\)[\s\S]*\.header select\s*\{[^}]*height:\s*44px[^}]*\}[\s\S]*\.version\s*\{[^}]*min-height:\s*44px/s);
});

test("version-difference surfaces retain tablet and narrow-screen structural fallbacks", async () => {
  const timeline = await fs.readFile(path.join(root, "components/ResearchEvolutionTimeline.module.css"), "utf8");
  const compare = await fs.readFile(path.join(root, "components/ResearchVersionCompare.module.css"), "utf8");

  assert.match(timeline, /@media \(max-width:\s*980px\)[\s\S]*\.header,[\s\S]*\.body\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(timeline, /@media \(max-width:\s*620px\)[\s\S]*\.controls > div\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(compare, /@media \(max-width:\s*760px\)[\s\S]*\.header,[\s\S]*\.pair,[\s\S]*\.headingChanges\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(compare, /@media \(max-width:\s*460px\)[\s\S]*\.diffLine\s*\{[^}]*grid-template-columns:\s*24px minmax\(0,\s*1fr\)/s);
});

test("workspace navigation and New Research filters meet coarse-pointer touch targets", async () => {
  const css = await fs.readFile(path.join(root, "app/globals.css"), "utf8");
  const consistency = await fs.readFile(path.join(root, "app/consistency.css"), "utf8");
  const workbench = await fs.readFile(path.join(root, "components/LatexWorkbench.module.css"), "utf8");
  const evolution = await fs.readFile(path.join(root, "components/ResearchEvolutionTimeline.module.css"), "utf8");
  const editorAssistant = await fs.readFile(path.join(root, "components/LatexEditorAssistant.module.css"), "utf8");
  const codexAssistant = await fs.readFile(path.join(root, "components/LatexCodexAssistant.module.css"), "utf8");
  const citationLauncher = await fs.readFile(path.join(root, "components/LatexCitationLauncher.module.css"), "utf8");

  assert.match(consistency, /@media \(pointer:\s*coarse\)[\s\S]*\.workspace-tabs a\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.project-context-selector select\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.new-research-filters input:not\(\[type="checkbox"\]\),\s*\.new-research-filters select\s*\{[^}]*height:\s*44px/s);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.new-research-check\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media \(pointer:\s*coarse\)[\s\S]*\.new-research-check input\[type="checkbox"\]\s*\{[^}]*width:\s*20px;\s*height:\s*20px/s);
  assert.match(workbench, /@media \(pointer:\s*coarse\)[\s\S]*\.toolbar button,[\s\S]*\.toolbar select,[\s\S]*\.editorModes button,[\s\S]*\.previewTabs button,[\s\S]*\.pdfControls button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(workbench, /@media \(pointer:\s*coarse\)[\s\S]*\.fileButton\s*\{[^}]*min-height:\s*44px/s);
  assert.match(workbench, /@media \(pointer:\s*coarse\)[\s\S]*\.iconButton\s*\{[^}]*min-width:\s*44px;\s*min-height:\s*44px/s);
  assert.match(workbench, /@media \(pointer:\s*coarse\)[\s\S]*\.sidebarTools label\s*\{[^}]*min-height:\s*44px/s);
  assert.match(evolution, /@media \(pointer:\s*coarse\)[\s\S]*\.controls button\s*\{[^}]*min-width:\s*44px/s);
  for (const stylesheet of [editorAssistant, codexAssistant, citationLauncher]) {
    assert.match(stylesheet, /@media \(pointer:\s*coarse\)[\s\S]*\.launcher\s*\{[^}]*min-height:\s*44px/s);
  }
});
