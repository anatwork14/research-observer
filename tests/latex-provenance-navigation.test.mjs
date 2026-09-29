import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("IDE page forwards manuscript file and line query parameters to the workbench", async () => {
  const source = await fs.readFile(path.join(root, "app/ide/page.tsx"), "utf8");
  assert.match(source, /searchParams:\s*Promise<\{\s*research\?: string; file\?: string; line\?: string \}>/s);
  assert.match(source, /<LatexWorkbench[^>]*initialFile=\{requestedFile\}[^>]*initialLine=\{initialLine\}/s);
  assert.match(source, /<LatexDeepLinkCursor file=\{requestedFile\} line=\{initialLine\}/s);
});

test("workbench only honors deep links to visible editable workspace sources", async () => {
  const source = await fs.readFile(path.join(root, "components/LatexWorkbench.tsx"), "utf8");
  assert.match(source, /file\.path === initialFile && file\.editable && !file\.hidden/);
  assert.match(source, /void openFile\(preferred, cursor\)/);
  assert.match(source, /line:\s*Math\.max\(1, Math\.trunc\(Number\(initialLine\)\)\), column: 0/);
});

test("deep-link cursor waits for the exact editor adapter after asynchronous mount", async () => {
  const source = await fs.readFile(path.join(root, "components/LatexDeepLinkCursor.tsx"), "utf8");
  assert.match(source, /editor\.file !== file/);
  assert.match(source, /window\.addEventListener\("latex-editor-change", schedule\)/);
  assert.match(source, /editor\.setSelection\(offset, offset, true\)/);
  assert.match(source, /applied\.current = true/);
});
