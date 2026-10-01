import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Insights loads manuscript Claim audit only for the Claims view", async () => {
  const source = await fs.readFile(path.join(root, "app/insights/page.tsx"), "utf8");
  assert.match(source, /rawView === "analytics" \|\| rawView === "claims"/);
  assert.match(source, /const claimAudit = view === "claims"\s*\? await loadClaimEvidenceAudit/);
  assert.match(source, /view === "claims" && claimAudit &&/);
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

test("Claim audit grid contains its internally scrolling table at narrow widths", async () => {
  const css = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.module.css"), "utf8");
  assert.match(css, /\.shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.shell\s*>\s*\*\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.filterForm\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test("Claim audit keeps visible lists bounded and avoids unsupported-claim scoring language", async () => {
  const source = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.tsx"), "utf8");
  assert.match(source, /filtered\.claims\.slice\(0, 80\)/);
  assert.match(source, /claimCount === 0\)\.slice\(0, 40\)/);
  assert.match(source, /audit\.issues\.slice\(0, 40\)/);
  assert.match(source, /evidenceReuse\.slice\(0, 12\)/);
  assert.match(source, /audit\.evidenceReuse\.length > 12[\s\S]*Showing 12 of \{audit\.evidenceReuse\.length\} linked Evidence objects/);
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

test("Claim drilldown filters are URL-backed and preserved across project scope changes", async () => {
  const page = await fs.readFile(path.join(root, "app/insights/page.tsx"), "utf8");
  const controls = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditFilters.tsx"), "utf8");
  assert.match(page, /relation:\s*one\(params\.claimRelation\)/);
  assert.match(page, /coverage:\s*one\(params\.claimCoverage\)/);
  assert.match(page, /signal:\s*one\(params\.claimSignal\)/);
  assert.match(page, /evidence:\s*one\(params\.claimEvidence\)/);
  assert.match(page, /file:\s*one\(params\.claimFile\)/);
  assert.match(page, /section:\s*one\(params\.claimSection\)/);
  assert.match(page, /query:\s*one\(params\.claimQ\)/);
  assert.match(page, /scopeHref\(view, toggled\(project\.id\), base, compare, view === "claims" \? claimFilters : undefined\)/);
  assert.match(page, /key === "claims" \? claimFilters : undefined/);
  assert.match(controls, /<form ref=\{formRef\} className=\{styles\.filterForm\} action="\/insights" method="get">/);
  assert.match(controls, /researchScope\.length > 0 && <input type="hidden" name="research"/);
  assert.match(controls, /filters\.signal && <input type="hidden" name="claimSignal"/);
  assert.match(controls, /filters\.evidence && <input type="hidden" name="claimEvidence"/);
  assert.match(controls, /claimAuditFilterHref\(researchScope, filters, clearFilters\)/);
  for (const name of ["claimRelation", "claimCoverage", "claimFile", "claimSection", "claimQ"]) {
    assert.match(controls, new RegExp(`name="${name}"`));
  }
});

test("Claim filter controls resync from the URL after browser history navigation", async () => {
  const controls = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditFilters.tsx"), "utf8");
  assert.match(controls, /^"use client"/);
  assert.match(controls, /form\.elements\.namedItem\(name\)/);
  assert.match(controls, /function syncFilterControls\(form: HTMLFormElement \| null, search: string\)/);
  assert.match(controls, /new URLSearchParams\(search\)/);
  assert.match(controls, /\[filters\.relation, filters\.coverage, filters\.signal, filters\.evidence, filters\.file, filters\.section, filters\.query\]/);
  assert.match(controls, /requestAnimationFrame\(syncFromUrl\)/);
  assert.match(controls, /setTimeout\(syncFromUrl, 0\)/);
  assert.match(controls, /addEventListener\("pageshow", scheduleSync\)/);
  assert.match(controls, /addEventListener\("popstate", scheduleSync\)/);
});

test("preserved file and section filters remain visible after project scope changes", async () => {
  const controls = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditFilters.tsx"), "utf8");
  assert.match(controls, /function preserveSelectedOption/);
  assert.match(controls, /const fileOptions = preserveSelectedOption\(options\.files, filters\.file\)/);
  assert.match(controls, /const sectionOptions = preserveSelectedOption\(options\.sections, filters\.section\)/);
  assert.match(controls, /0 && item\.value === filters\.file \? " in current scope"/);
  assert.match(controls, /0 && item\.value === filters\.section \? " in current scope"/);
});

test("relation tags link back into the authored-relation drilldown", async () => {
  const source = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.tsx"), "utf8");
  const controls = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditFilters.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.module.css"), "utf8");
  assert.match(source, /claimAuditFilterHref\(researchScope, filtered\.filters, \{ relation: item\.type \}\)/);
  assert.match(source, /<ClaimEvidenceAuditFilters/);
  assert.match(controls, /Charts above remain complete-scope context/);
  assert.match(css, /\.relationTags a/);
});

test("Claims charts drill into the same URL-backed filter contract", async () => {
  const source = await fs.readFile(path.join(root, "components/ClaimEvidenceAudit.tsx"), "utf8");
  const charts = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditCharts.tsx"), "utf8");
  assert.match(source, /<ClaimCoverageDrilldownChart[^>]*data=\{audit\.coverage\}/);
  assert.match(source, /<ClaimRelationDrilldownChart[^>]*data=\{audit\.relationMix\}/);
  assert.match(source, /<ClaimSignalDrilldownChart[^>]*data=\{audit\.claimSignals\}/);
  assert.match(source, /<ClaimEvidenceReuseDrilldownChart[^>]*data=\{audit\.evidenceReuse\.slice\(0, 12\)\}/);
  assert.match(charts, /<a href=\{hrefForDatum\(item\)\}/);
  assert.match(charts, /coverage: item\.key/);
  assert.match(charts, /relation: item\.key/);
  assert.match(charts, /signal: "support-contradiction"/);
  assert.match(charts, /evidence: \(item as EvidenceDatum\)\.slug/);
  assert.match(charts, /support:\s*"supports"/);
  assert.match(charts, /contradiction:\s*"contradicts"/);
  assert.match(charts, /context:\s*"contextualizes"/);
  assert.match(charts, /qualification:\s*"qualifies"/);
});

test("chart-only drilldown filters remain removable and survive form submissions", async () => {
  const controls = await fs.readFile(path.join(root, "components/ClaimEvidenceAuditFilters.tsx"), "utf8");
  assert.match(controls, /Signal: support \+ contradiction/);
  assert.match(controls, /Evidence: \$\{filters\.evidence\}/);
  assert.match(controls, /signal:\s*""/);
  assert.match(controls, /evidence:\s*""/);
  assert.match(controls, /name="claimSignal" value=\{filters\.signal\}/);
  assert.match(controls, /name="claimEvidence" value=\{filters\.evidence\}/);
});
