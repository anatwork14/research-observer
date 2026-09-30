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

test("Claim audit keeps visible lists bounded and avoids unsupported-claim scoring language", async () => {
  const source = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.tsx"), "utf8");
  assert.match(source, /audit\.claims\.slice\(0, 80\)/);
  assert.match(source, /claimCount === 0\)\.slice\(0, 40\)/);
  assert.match(source, /audit\.issues\.slice\(0, 40\)/);
  assert.match(source, /evidenceReuse\.slice\(0, 12\)/);
  assert.match(source, /not a quality score/);
  assert.match(source, /not a judgment of scientific support/);
  assert.doesNotMatch(source, /unsupported Claim/i);
});

test("all-unavailable Claim scopes do not render factual zero KPI cards", async () => {
  const source = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.tsx"), "utf8");
  assert.match(source, /const hasAudit = audit\.availableProjects > 0/);
  assert.match(source, /\{hasAudit && \(\s*<section className="intelligence-kpis"/);
  assert.match(source, /No visible editable manuscript source was available to audit/);
  assert.match(source, /Claim coverage is not reported as zero/);
});
