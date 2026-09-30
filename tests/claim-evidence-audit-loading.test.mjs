import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Insights loads manuscript Claim audit only for the Claims view", async () => {
  const source = await fs.readFile(path.join(root, "app/insights/page.tsx"), "utf8");
  assert.match(source, /rawView === "analytics" \|\| rawView === "claims"/);
  assert.match(source, /const claimAudit = view === "claims"\s*\? await loadClaimEvidenceAudit/);
  assert.match(source, /view === "claims" && claimAudit && <ClaimEvidenceAuditView/);
});

test("Claims appears as a first-class Insights tab without replacing existing views", async () => {
  const source = await fs.readFile(path.join(root, "app/insights/page.tsx"), "utf8");
  for (const label of ["Overview", "Analytics", "Claims", "Timeline", "Versions"]) {
    assert.match(source, new RegExp(`\\[\\"[^\\"]+\\", \\"${label}\\"\\]`));
  }
});

test("five Insights tabs fit normal widths and retain the two-column mobile layout", async () => {
  const source = await fs.readFile(path.join(root, "app/insights/page.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "app/insights/InsightsPage.module.css"), "utf8");
  assert.match(source, /intelligence-view-tabs \$\{styles\.tabs\}/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});
