import assert from "node:assert/strict";
import test from "node:test";
import { filterClaimEvidenceAudit, normalizeClaimEvidenceAuditFilters } from "../lib/research/claim-evidence-audit-filters.mjs";

function auditFixture() {
  const base = {
    projectId: "alpha",
    projectLabel: "Alpha",
    relationCount: 0,
    evidenceCount: 0,
    evidenceTargets: [],
    relationCounts: { supports: 0, contradicts: 0, contextualizes: 0, qualifies: 0 },
    hasSupport: false,
    hasContradiction: false,
    hasContext: false,
    hasQualification: false,
    hasSupportAndContradiction: false,
  };
  return {
    claims: [
      { ...base, nodeId: "claim:alpha:zero", claimId: "zero", file: "main.tex", section: "Introduction", excerpt: "No authored relation." },
      {
        ...base,
        nodeId: "claim:alpha:one",
        claimId: "one",
        file: "main.tex",
        section: "Results",
        excerpt: "Supported result.",
        relationCount: 1,
        evidenceCount: 1,
        evidenceTargets: [{ slug: "evidence-a", title: "Evidence A" }],
        relationCounts: { supports: 1, contradicts: 0, contextualizes: 0, qualifies: 0 },
        hasSupport: true,
      },
      {
        ...base,
        nodeId: "claim:alpha:mixed",
        claimId: "mixed",
        file: "chapters/discussion.tex",
        section: "Discussion",
        excerpt: "Mixed evidence.",
        relationCount: 3,
        evidenceCount: 2,
        evidenceTargets: [
          { slug: "evidence-a", title: "Evidence A" },
          { slug: "evidence-b", title: "Evidence B" },
        ],
        relationCounts: { supports: 1, contradicts: 1, contextualizes: 0, qualifies: 1 },
        hasSupport: true,
        hasContradiction: true,
        hasQualification: true,
        hasSupportAndContradiction: true,
      },
    ],
  };
}

test("normalizes only supported relation and coverage filters", () => {
  assert.deepEqual(normalizeClaimEvidenceAuditFilters({ relation: "proves", coverage: "many", query: "  Evidence  " }), {
    relation: "",
    coverage: "",
    file: "",
    section: "",
    query: "Evidence",
  });
  assert.equal(normalizeClaimEvidenceAuditFilters({ relation: "supports", coverage: "none" }).relation, "supports");
  assert.equal(normalizeClaimEvidenceAuditFilters({ relation: "supports", coverage: "none" }).coverage, "none");
});

test("filters Claims by authored relation and distinct Evidence coverage", () => {
  const audit = auditFixture();
  assert.deepEqual(filterClaimEvidenceAudit(audit, { coverage: "none" }).claims.map((item) => item.claimId), ["zero"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { coverage: "one" }).claims.map((item) => item.claimId), ["one"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { coverage: "multiple" }).claims.map((item) => item.claimId), ["mixed"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { relation: "contradicts" }).claims.map((item) => item.claimId), ["mixed"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { relation: "supports", coverage: "linked" }).claims.map((item) => item.claimId), ["one", "mixed"]);
});

test("filters by exact manuscript file and section", () => {
  const audit = auditFixture();
  const filtered = filterClaimEvidenceAudit(audit, { file: "main.tex", section: "Results" });
  assert.deepEqual(filtered.claims.map((item) => item.claimId), ["one"]);
  assert.deepEqual(filtered.options.files, [
    { value: "chapters/discussion.tex", count: 1 },
    { value: "main.tex", count: 2 },
  ]);
  assert.deepEqual(filtered.options.sections, [
    { value: "Discussion", count: 1 },
    { value: "Introduction", count: 1 },
    { value: "Results", count: 1 },
  ]);
});

test("text search covers Claim identity, source context, and Evidence title or slug", () => {
  const audit = auditFixture();
  assert.deepEqual(filterClaimEvidenceAudit(audit, { query: "mixed" }).claims.map((item) => item.claimId), ["mixed"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { query: "discussion.tex" }).claims.map((item) => item.claimId), ["mixed"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { query: "Evidence B" }).claims.map((item) => item.claimId), ["mixed"]);
  assert.deepEqual(filterClaimEvidenceAudit(audit, { query: "Results" }).claims.map((item) => item.claimId), ["one"]);
});

test("reports matching count separately from the complete audit total", () => {
  const filtered = filterClaimEvidenceAudit(auditFixture(), { relation: "supports", file: "main.tex" });
  assert.equal(filtered.totalClaims, 3);
  assert.equal(filtered.matchedClaims, 1);
  assert.equal(filtered.activeFilters, 2);
});
