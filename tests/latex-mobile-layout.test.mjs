import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const bottomSheets = [
  "components/LatexEditorAssistant.module.css",
  "components/LatexCodexAssistant.module.css",
  "components/LatexCitationDrawer.module.css",
  "components/PdfAnnotationBridge.module.css",
  "components/PdfReanchorSuggestions.module.css",
];

function mobileBlock(css) {
  const marker = "@media (max-width: 760px)";
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const rest = css.slice(start);
  const nextMedia = rest.indexOf("@media", marker.length);
  return nextMedia === -1 ? rest : rest.slice(0, nextMedia);
}

test("mobile bottom-sheet drawers stay within the layout viewport", async () => {
  for (const relative of bottomSheets) {
    const css = await fs.readFile(path.join(root, relative), "utf8");
    const mobile = mobileBlock(css);
    assert.doesNotMatch(mobile, /\.drawer\s*\{[^}]*\bwidth\s*:\s*100vw\s*;/s, `${relative} must not size its mobile drawer with 100vw`);
    assert.match(mobile, /\.drawer\s*\{[^}]*\bleft\s*:\s*0\s*;/s, `${relative} should pin the mobile drawer to the left layout edge`);
    assert.match(mobile, /\.drawer\s*\{[^}]*\bright\s*:\s*0\s*;/s, `${relative} should pin the mobile drawer to the right layout edge`);
    assert.match(mobile, /\.drawer\s*\{[^}]*\bmax-width\s*:\s*100%\s*;/s, `${relative} should clamp the mobile drawer to the layout viewport`);
  }
});

test("PDF mobile capture hint avoids viewport-unit scrollbar overflow", async () => {
  const css = await fs.readFile(path.join(root, "components/PdfAnnotationBridge.module.css"), "utf8");
  const mobile = mobileBlock(css);
  assert.doesNotMatch(mobile, /\.captureHint\s*\{[^}]*100vw/s);
  assert.match(mobile, /\.captureHint\s*\{[^}]*\bleft\s*:\s*0\.75rem\s*;/s);
  assert.match(mobile, /\.captureHint\s*\{[^}]*\bright\s*:\s*0\.75rem\s*;/s);
  assert.match(mobile, /\.captureHint\s*\{[^}]*\bwidth\s*:\s*auto\s*;/s);
});

test("mobile LaTeX statusbar may wrap when its toolchain labels exceed the row", async () => {
  const css = await fs.readFile(path.join(root, "components/LatexWorkbench.module.css"), "utf8");
  const mobile = mobileBlock(css);
  assert.match(mobile, /\.statusbar\s*\{[^}]*\bflex-wrap\s*:\s*wrap\s*;/s);
});
