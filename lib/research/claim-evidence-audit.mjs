import { selectedResearchIds } from "./analytics.mjs";
import { loadManuscriptClaimProjection } from "./manuscript-claim-projection.mjs";
import { MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS } from "./manuscript-claim-relations.mjs";

function researchSlugFromNodeId(value) {
  const raw = String(value ?? "");
  return raw.startsWith("research:") ? raw.slice("research:".length) : undefined;
}

function emptyRelationCounts() {
  return Object.fromEntries(MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((type) => [type, 0]));
}

function projectLabel(workspace, projectId) {
  return workspace.projects?.find((project) => project.id === projectId)?.label || projectId;
}

function issueRow(projectId, label, category, issue) {
  return {
    projectId,
    projectLabel: label,
    category,
    type: issue.type,
    file: issue.file,
    line: issue.line,
    claimId: issue.claimId,
    relation: issue.relation,
    evidenceSlug: issue.evidenceSlug,
    message: issue.message,
  };
}

export function buildClaimEvidenceAudit({ workspace, researchIds = [], projectStates = [] } = {}) {
  const selected = selectedResearchIds(workspace, researchIds);
  const selectedSet = new Set(selected);
  const statesByProject = new Map(projectStates.map((state) => [state.projectId, state]));
  const entriesBySlug = new Map((workspace.entries || []).map((entry) => [entry.slug, entry]));
  const selectedEvidence = (workspace.entries || []).filter((entry) => selectedSet.has(entry.research) && entry.type === "evidence");

  const claims = [];
  const evidence = [];
  const projects = [];
  const issues = [];
  const unavailableProjects = [];

  for (const projectId of selected) {
    const label = projectLabel(workspace, projectId);
    const state = statesByProject.get(projectId);
    const canonicalEvidence = selectedEvidence.filter((entry) => entry.research === projectId);

    if (!state?.available || !state.projection) {
      const reason = state?.reason || "Claim projection unavailable";
      unavailableProjects.push({ projectId, label, reason });
      projects.push({
        id: projectId,
        label,
        available: false,
        canonicalEvidence: canonicalEvidence.length,
        claims: null,
        claimsWithEvidence: null,
        claimsWithoutEvidence: null,
        relations: null,
        linkedEvidence: null,
        relationIssues: null,
      });
      continue;
    }

    const projection = state.projection;
    const claimNodes = projection.nodes.filter((node) => node.kind === "claim");
    const semanticEdges = projection.edges.filter((edge) => edge.layer === "claim-evidence");
    const edgesByClaim = new Map();
    const edgesByEvidence = new Map();

    for (const edge of semanticEdges) {
      const claimEdges = edgesByClaim.get(edge.target) || [];
      claimEdges.push(edge);
      edgesByClaim.set(edge.target, claimEdges);

      const evidenceSlug = researchSlugFromNodeId(edge.source);
      if (!evidenceSlug) continue;
      const evidenceEdges = edgesByEvidence.get(evidenceSlug) || [];
      evidenceEdges.push(edge);
      edgesByEvidence.set(evidenceSlug, evidenceEdges);
    }

    const projectClaims = [];
    for (const node of claimNodes) {
      const edges = edgesByClaim.get(node.id) || [];
      const relationCounts = emptyRelationCounts();
      const evidenceSlugs = new Set();

      for (const edge of edges) {
        if (Object.hasOwn(relationCounts, edge.type)) relationCounts[edge.type] += 1;
        const slug = researchSlugFromNodeId(edge.source);
        if (slug) evidenceSlugs.add(slug);
      }

      const evidenceTargets = [...evidenceSlugs]
        .map((slug) => entriesBySlug.get(slug))
        .filter(Boolean)
        .map((entry) => ({ slug: entry.slug, title: entry.title || entry.slug }));
      const evidenceCount = evidenceTargets.length;
      const relationCount = edges.length;
      const row = {
        projectId,
        projectLabel: label,
        nodeId: node.id,
        claimId: node.claimId || node.label,
        file: node.file,
        line: node.anchorLine || node.line,
        section: node.section,
        excerpt: node.excerpt,
        href: node.href,
        relationCount,
        evidenceCount,
        evidenceTargets,
        relationCounts,
        hasSupport: relationCounts.supports > 0,
        hasContradiction: relationCounts.contradicts > 0,
        hasContext: relationCounts.contextualizes > 0,
        hasQualification: relationCounts.qualifies > 0,
        hasSupportAndContradiction: relationCounts.supports > 0 && relationCounts.contradicts > 0,
      };
      projectClaims.push(row);
      claims.push(row);
    }

    const projectEvidenceRows = canonicalEvidence.map((entry) => {
      const edges = edgesByEvidence.get(entry.slug) || [];
      const claimIds = new Set();
      const relationCounts = emptyRelationCounts();
      for (const edge of edges) {
        const claim = claimNodes.find((node) => node.id === edge.target);
        if (claim) claimIds.add(claim.claimId || claim.label);
        if (Object.hasOwn(relationCounts, edge.type)) relationCounts[edge.type] += 1;
      }
      return {
        projectId,
        projectLabel: label,
        slug: entry.slug,
        title: entry.title || entry.slug,
        href: `/progress/${entry.slug}`,
        claimCount: claimIds.size,
        relationCount: edges.length,
        claimIds: [...claimIds].sort(),
        relationCounts,
      };
    });
    evidence.push(...projectEvidenceRows);

    for (const issue of projection.issues || []) issues.push(issueRow(projectId, label, "claim", issue));
    for (const issue of projection.relationIssues || []) issues.push(issueRow(projectId, label, "claim-evidence", issue));

    const claimsWithEvidence = projectClaims.filter((claim) => claim.evidenceCount > 0).length;
    projects.push({
      id: projectId,
      label,
      available: true,
      canonicalEvidence: canonicalEvidence.length,
      claims: projectClaims.length,
      claimsWithEvidence,
      claimsWithoutEvidence: projectClaims.length - claimsWithEvidence,
      relations: semanticEdges.length,
      linkedEvidence: projectEvidenceRows.filter((item) => item.claimCount > 0).length,
      relationIssues: projection.relationIssues?.length || 0,
    });
  }

  const relationTotals = emptyRelationCounts();
  for (const claim of claims) {
    for (const type of MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS) relationTotals[type] += claim.relationCounts[type] || 0;
  }

  const claimsWithEvidence = claims.filter((claim) => claim.evidenceCount > 0).length;
  const linkedEvidence = evidence.filter((item) => item.claimCount > 0);
  const availableProjects = projects.filter((project) => project.available).length;

  const coverage = [
    { key: "none", label: "0 Evidence targets", value: claims.filter((claim) => claim.evidenceCount === 0).length },
    { key: "one", label: "1 Evidence target", value: claims.filter((claim) => claim.evidenceCount === 1).length },
    { key: "multiple", label: "2+ Evidence targets", value: claims.filter((claim) => claim.evidenceCount >= 2).length },
  ];

  const relationMix = MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((type) => ({
    key: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    value: relationTotals[type] || 0,
  }));

  const claimSignals = [
    { key: "support", label: "Claims with supports", value: claims.filter((claim) => claim.hasSupport).length },
    { key: "contradiction", label: "Claims with contradicts", value: claims.filter((claim) => claim.hasContradiction).length },
    { key: "support-contradiction", label: "Claims with both support + contradiction", value: claims.filter((claim) => claim.hasSupportAndContradiction).length },
    { key: "context", label: "Claims with contextualizes", value: claims.filter((claim) => claim.hasContext).length },
    { key: "qualification", label: "Claims with qualifies", value: claims.filter((claim) => claim.hasQualification).length },
  ];

  const evidenceReuse = linkedEvidence
    .slice()
    .sort((a, b) => b.claimCount - a.claimCount || b.relationCount - a.relationCount || a.title.localeCompare(b.title))
    .map((item) => ({ key: `${item.projectId}:${item.slug}`, label: item.title, value: item.claimCount, slug: item.slug, projectId: item.projectId }));

  claims.sort((a, b) => a.evidenceCount - b.evidenceCount || b.relationCount - a.relationCount || a.projectLabel.localeCompare(b.projectLabel) || a.claimId.localeCompare(b.claimId));
  evidence.sort((a, b) => a.claimCount - b.claimCount || a.projectLabel.localeCompare(b.projectLabel) || a.title.localeCompare(b.title));
  issues.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel) || String(a.file || "").localeCompare(String(b.file || "")) || (a.line || 0) - (b.line || 0));

  return {
    researchIds: selected,
    availableProjects,
    unavailableProjects,
    totals: {
      claims: claims.length,
      claimsWithEvidence,
      claimsWithoutEvidence: claims.length - claimsWithEvidence,
      relations: relationMix.reduce((sum, item) => sum + item.value, 0),
      linkedEvidence: linkedEvidence.length,
      canonicalEvidence: evidence.length,
      evidenceWithoutClaimLinks: evidence.filter((item) => item.claimCount === 0).length,
      claimsWithSupportAndContradiction: claims.filter((claim) => claim.hasSupportAndContradiction).length,
      claimIssues: issues.filter((issue) => issue.category === "claim").length,
      relationIssues: issues.filter((issue) => issue.category === "claim-evidence").length,
    },
    coverage,
    relationMix,
    claimSignals,
    evidenceReuse,
    projects,
    claims,
    evidence,
    issues,
  };
}

export async function loadClaimEvidenceAudit({ rootDir = process.cwd(), workspace, researchIds = [] } = {}) {
  const selected = selectedResearchIds(workspace, researchIds);
  const results = await Promise.allSettled(selected.map((projectId) => loadManuscriptClaimProjection({
    rootDir,
    projectId,
    researchEntries: workspace.entries || [],
  })));

  const projectStates = results.map((result, index) => {
    const projectId = selected[index];
    if (result.status === "rejected") return { projectId, available: false, reason: "Claim projection unavailable" };
    const projection = result.value;
    if ((projection.stats?.manuscriptFiles || 0) === 0) {
      return { projectId, available: false, projection, reason: "No visible editable manuscript sources" };
    }
    return { projectId, available: true, projection };
  });

  return buildClaimEvidenceAudit({ workspace, researchIds: selected, projectStates });
}
