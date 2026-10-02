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
