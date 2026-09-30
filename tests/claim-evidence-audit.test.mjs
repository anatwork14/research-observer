import assert from "node:assert/strict";
import test from "node:test";
import { buildClaimEvidenceAudit } from "../lib/research/claim-evidence-audit.mjs";
import { buildManuscriptClaimProjection } from "../lib/research/manuscript-claim-projection.mjs";

function workspaceFixture() {
  return {
    projects: [
      { id: "alpha", label: "Alpha", notes: 5 },
      { id: "beta", label: "Beta", notes: 1 },
    ],
    entries: [
      { slug: "evidence-a", title: "Evidence A", research: "alpha", type: "evidence" },
      { slug: "evidence-b", title: "Evidence B", research: "alpha", type: "evidence" },
      { slug: "evidence-unused", title: "Unused Evidence", research: "alpha", type: "evidence" },
      { slug: "evidence-beta", title: "Beta Evidence", research: "beta", type: "evidence" },
    ],
  };
}

function alphaProjection() {
  const content = [
    "% observaire:claim claim-one",
    "% observaire:claim-evidence claim-one supports evidence-a",
    "% observaire:claim-evidence claim-one qualifies evidence-b",
    "First claim prose.",
    "",
    "% observaire:claim claim-two",
    "% observaire:claim-evidence claim-two supports evidence-a",
    "% observaire:claim-evidence claim-two contradicts evidence-a",
    "Second claim prose.",
    "",
    "% observaire:claim claim-three",
    "Third claim prose without an authored Evidence relation.",
  ].join("\n");
  const workspace = workspaceFixture();
  return buildManuscriptClaimProjection({
    projectId: "alpha",
    mainFile: "main.tex",
    files: [{ file: "main.tex", content }],
    researchEntries: workspace.entries,
  });
}

function betaProjection() {
  const workspace = workspaceFixture();
  return buildManuscriptClaimProjection({
    projectId: "beta",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      content: "% observaire:claim claim-one\n% observaire:claim-evidence claim-one contextualizes evidence-beta\nBeta claim prose.",
    }],
    researchEntries: workspace.entries,
  });
}

test("claim evidence audit counts authored targets without inventing a quality score", () => {
  const workspace = workspaceFixture();
  const audit = buildClaimEvidenceAudit({
    workspace,
    researchIds: ["alpha", "beta"],
    projectStates: [
      { projectId: "alpha", available: true, projection: alphaProjection() },
      { projectId: "beta", available: false, reason: "No visible editable manuscript sources" },
    ],
  });

  assert.equal(audit.availableProjects, 1);
  assert.deepEqual(audit.unavailableProjects, [{ projectId: "beta", label: "Beta", reason: "No visible editable manuscript sources" }]);
  assert.equal(audit.totals.claims, 3);
  assert.equal(audit.totals.claimsWithEvidence, 2);
  assert.equal(audit.totals.claimsWithoutEvidence, 1);
  assert.equal(audit.totals.relations, 4);
  assert.equal(audit.totals.linkedEvidence, 2);
  assert.equal(audit.totals.canonicalEvidence, 3);
  assert.equal(audit.totals.evidenceWithoutClaimLinks, 1);
  assert.equal(audit.totals.claimsWithSupportAndContradiction, 1);

  assert.deepEqual(audit.coverage.map((item) => [item.key, item.value]), [
    ["none", 1],
    ["one", 1],
    ["multiple", 1],
  ]);
  assert.deepEqual(audit.relationMix.map((item) => [item.key, item.value]), [
    ["supports", 2],
    ["contradicts", 1],
    ["contextualizes", 0],
    ["qualifies", 1],
  ]);

  const claimOne = audit.claims.find((item) => item.claimId === "claim-one");
  assert.equal(claimOne.evidenceCount, 2);
  assert.equal(claimOne.relationCount, 2);
  assert.equal(claimOne.hasQualification, true);

  const claimTwo = audit.claims.find((item) => item.claimId === "claim-two");
  assert.equal(claimTwo.evidenceCount, 1, "multiple relation types to one Evidence target count once for coverage");
  assert.equal(claimTwo.relationCount, 2);
  assert.equal(claimTwo.hasSupportAndContradiction, true);

  const evidenceA = audit.evidence.find((item) => item.slug === "evidence-a");
  assert.equal(evidenceA.claimCount, 2);
  assert.equal(evidenceA.relationCount, 3);
  assert.equal(audit.evidenceReuse[0].slug, "evidence-a");
  assert.equal(audit.evidenceReuse[0].value, 2);

  const beta = audit.projects.find((project) => project.id === "beta");
  assert.equal(beta.available, false);
  assert.equal(beta.claims, null, "unavailable claim scans must not be displayed as factual zero");
  assert.equal(beta.canonicalEvidence, 1);
});

test("raw prose and citations do not become claim-evidence audit relations", () => {
  const workspace = workspaceFixture();
  const projection = buildManuscriptClaimProjection({
    projectId: "alpha",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      content: "% observaire:claim prose-only\nThis clearly supports Evidence A \\cite{evidence-a}.",
    }],
    researchEntries: workspace.entries,
  });
  const audit = buildClaimEvidenceAudit({
    workspace,
    researchIds: ["alpha"],
    projectStates: [{ projectId: "alpha", available: true, projection }],
  });

  assert.equal(audit.totals.claims, 1);
  assert.equal(audit.totals.relations, 0);
  assert.equal(audit.totals.claimsWithoutEvidence, 1);
  assert.equal(audit.claims[0].evidenceCount, 0);
});

test("invalid authored directives remain audit issues and are excluded from valid coverage", () => {
  const workspace = workspaceFixture();
  const projection = buildManuscriptClaimProjection({
    projectId: "alpha",
    mainFile: "main.tex",
    files: [{
      file: "main.tex",
      content: [
        "% observaire:claim valid-claim",
        "% observaire:claim-evidence valid-claim supports missing-evidence",
        "% observaire:claim-evidence missing-claim supports evidence-a",
        "Claim prose.",
      ].join("\n"),
    }],
    researchEntries: workspace.entries,
  });
  const audit = buildClaimEvidenceAudit({
    workspace,
    researchIds: ["alpha"],
    projectStates: [{ projectId: "alpha", available: true, projection }],
  });

  assert.equal(audit.totals.claims, 1);
  assert.equal(audit.totals.relations, 0);
  assert.equal(audit.totals.relationIssues, 2);
  assert.deepEqual(new Set(audit.issues.map((issue) => issue.type)), new Set(["evidence-missing", "claim-unresolved"]));
  assert.equal(audit.claims[0].evidenceCount, 0);
});

test("same Claim IDs stay project-scoped and the selected research scope controls the audit", () => {
  const workspace = workspaceFixture();
  const states = [
    { projectId: "alpha", available: true, projection: alphaProjection() },
    { projectId: "beta", available: true, projection: betaProjection() },
  ];

  const combined = buildClaimEvidenceAudit({ workspace, researchIds: ["alpha", "beta"], projectStates: states });
  const shared = combined.claims.filter((claim) => claim.claimId === "claim-one");
  assert.equal(shared.length, 2);
  assert.deepEqual(new Set(shared.map((claim) => claim.projectId)), new Set(["alpha", "beta"]));
  assert.equal(combined.relationMix.find((item) => item.key === "contextualizes").value, 1);

  const betaOnly = buildClaimEvidenceAudit({ workspace, researchIds: ["beta"], projectStates: states });
  assert.equal(betaOnly.totals.claims, 1);
  assert.equal(betaOnly.totals.relations, 1);
  assert.equal(betaOnly.claims[0].projectId, "beta");
  assert.equal(betaOnly.evidence[0].slug, "evidence-beta");
  assert.equal(betaOnly.evidence[0].claimCount, 1);
  assert.deepEqual(betaOnly.researchIds, ["beta"]);
});
