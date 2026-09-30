import { listLatexWorkspace, readLatexSource } from "./latex-ide.mjs";
import {
  claimPassageIdentity,
  manuscriptClaimNodeId,
  parseManuscriptClaimAnchors,
} from "./manuscript-claims.mjs";
import {
  manuscriptClaimEvidenceEdgeId,
  parseManuscriptClaimEvidenceRelations,
} from "./manuscript-claim-relations.mjs";

function manuscriptNodeId(projectId, file) {
  return `manuscript:${projectId}:${file}`;
}

function researchNodeId(slug) {
  return `research:${slug}`;
}

function manuscriptHref(projectId, file, line) {
  const params = new URLSearchParams({ research: projectId });
  if (file) params.set("file", file);
  if (Number.isFinite(line) && line > 0) params.set("line", String(Math.trunc(line)));
  return `/ide?${params.toString()}`;
}

function edgeId(type, source, target) {
  return `claim:${type}:${source}->${target}`;
}

function uniquePush(map, item) {
  if (!map.has(item.id)) map.set(item.id, item);
}

function passageNode(projectId, file, claim) {
  const passage = claim.passage;
  const lineLabel = passage.lineStart === passage.lineEnd
    ? `line ${passage.lineStart}`
    : `lines ${passage.lineStart}–${passage.lineEnd}`;
  return {
    id: claimPassageIdentity(projectId, file, claim),
    kind: "passage",
    label: passage.heading?.title ? `${passage.heading.title} · ${lineLabel}` : `${file} · ${lineLabel}`,
    research: projectId,
    file,
    role: "manuscript-passage",
    type: "passage",
    start: passage.start,
    end: passage.end,
    line: passage.lineStart,
    lineEnd: passage.lineEnd,
    section: passage.heading?.title,
    sectionLevel: passage.heading?.level,
    excerpt: passage.excerpt,
    href: manuscriptHref(projectId, file, passage.lineStart),
  };
}

export function buildManuscriptClaimProjection({
  projectId = "default",
  mainFile = "",
  files = [],
  researchEntries = [],
} = {}) {
  const nodes = new Map();
  const edges = [];
  const issues = [];
  const relationIssues = [];
  const occurrences = [];
  const relationOccurrences = [];

  for (const item of files) {
    const parsed = parseManuscriptClaimAnchors(item.content || "");
    for (const issue of parsed.issues) issues.push({ ...issue, file: item.file });
    for (const claim of parsed.claims) occurrences.push({ ...claim, file: item.file });

    const parsedRelations = parseManuscriptClaimEvidenceRelations(item.content || "");
    for (const issue of parsedRelations.issues) relationIssues.push({ ...issue, file: item.file });
    for (const relation of parsedRelations.relations) relationOccurrences.push({ ...relation, file: item.file });
  }

  const counts = new Map();
  for (const claim of occurrences) counts.set(claim.claimId, (counts.get(claim.claimId) || 0) + 1);
  const duplicateIds = new Set([...counts].filter(([, count]) => count > 1).map(([claimId]) => claimId));

  for (const claimId of duplicateIds) {
    for (const occurrence of occurrences.filter((claim) => claim.claimId === claimId)) {
      issues.push({
        type: "duplicate",
        claimId,
        file: occurrence.file,
        line: occurrence.markerLine,
        message: `Claim ID ${claimId} occurs more than once in this manuscript project.`,
      });
    }
  }

  for (const item of files) {
    const manuscriptId = manuscriptNodeId(projectId, item.file);
    uniquePush(nodes, {
      id: manuscriptId,
      kind: "manuscript",
      label: item.file,
      research: projectId,
      file: item.file,
      main: item.file === mainFile,
      role: "manuscript",
      href: manuscriptHref(projectId, item.file),
    });
  }

  const validClaimIds = new Set();
  for (const claim of occurrences) {
    if (duplicateIds.has(claim.claimId)) continue;
    const manuscriptId = manuscriptNodeId(projectId, claim.file);
    const passage = passageNode(projectId, claim.file, claim);
    const claimId = manuscriptClaimNodeId(projectId, claim.claimId);
    validClaimIds.add(claim.claimId);

    uniquePush(nodes, passage);
    uniquePush(nodes, {
      id: claimId,
      kind: "claim",
      label: claim.claimId,
      research: projectId,
      role: "explicit-manuscript-claim",
      type: "claim-anchor",
      claimId: claim.claimId,
      file: claim.file,
      anchorLine: claim.markerLine,
      line: claim.passage.lineStart,
      lineEnd: claim.passage.lineEnd,
      section: claim.passage.heading?.title,
      sectionLevel: claim.passage.heading?.level,
      excerpt: claim.passage.excerpt,
      href: manuscriptHref(projectId, claim.file, claim.markerLine),
    });

    edges.push({
      id: edgeId("anchors_claim", passage.id, claimId),
      source: passage.id,
      target: claimId,
      type: "anchors_claim",
      layer: "claim",
      explicit: true,
    });
    edges.push({
      id: edgeId("part_of", claimId, manuscriptId),
      source: claimId,
      target: manuscriptId,
      type: "part_of",
      layer: "claim",
      explicit: true,
    });
  }

  const entriesBySlug = new Map(researchEntries.map((entry) => [entry.slug, entry]));
  const relationCounts = new Map();
  for (const item of relationOccurrences) {
    const key = `${item.claimId}\u0000${item.relation}\u0000${item.evidenceSlug}`;
    relationCounts.set(key, (relationCounts.get(key) || 0) + 1);
  }
  const duplicateRelationKeys = new Set([...relationCounts].filter(([, count]) => count > 1).map(([key]) => key));
  for (const key of duplicateRelationKeys) {
    const [claimId, relation, evidenceSlug] = key.split("\u0000");
    for (const occurrence of relationOccurrences.filter((item) =>
      item.claimId === claimId && item.relation === relation && item.evidenceSlug === evidenceSlug)) {
      relationIssues.push({
        type: "duplicate-relation",
        file: occurrence.file,
        line: occurrence.line,
        claimId,
        relation,
        evidenceSlug,
        message: `Claim-evidence relation ${claimId} ${relation} ${evidenceSlug} is declared more than once.`,
      });
    }
  }

  const emittedRelations = new Set();
  for (const relation of relationOccurrences) {
    if (!validClaimIds.has(relation.claimId)) {
      relationIssues.push({
        type: "claim-unresolved",
        file: relation.file,
        line: relation.line,
        claimId: relation.claimId,
        relation: relation.relation,
        evidenceSlug: relation.evidenceSlug,
        message: `Claim-evidence relation references missing, invalid, or duplicate Claim '${relation.claimId}'.`,
      });
      continue;
    }

    const evidence = entriesBySlug.get(relation.evidenceSlug);
    if (!evidence) {
      relationIssues.push({
        type: "evidence-missing",
        file: relation.file,
        line: relation.line,
        claimId: relation.claimId,
        relation: relation.relation,
        evidenceSlug: relation.evidenceSlug,
        message: `Claim-evidence target '${relation.evidenceSlug}' does not resolve to a canonical research object.`,
      });
      continue;
    }
    if (evidence.research !== projectId) {
      relationIssues.push({
        type: "evidence-cross-project",
        file: relation.file,
        line: relation.line,
        claimId: relation.claimId,
        relation: relation.relation,
        evidenceSlug: relation.evidenceSlug,
        message: `Claim-evidence target '${relation.evidenceSlug}' belongs to research project '${evidence.research}', not '${projectId}'.`,
      });
      continue;
    }
    if (evidence.type !== "evidence") {
      relationIssues.push({
        type: "evidence-type",
        file: relation.file,
        line: relation.line,
        claimId: relation.claimId,
        relation: relation.relation,
        evidenceSlug: relation.evidenceSlug,
        message: `Claim-evidence target '${relation.evidenceSlug}' must be a canonical type:evidence object.`,
      });
      continue;
    }

    const relationKey = `${relation.claimId}\u0000${relation.relation}\u0000${relation.evidenceSlug}`;
    if (emittedRelations.has(relationKey)) continue;
    emittedRelations.add(relationKey);
    edges.push({
      id: manuscriptClaimEvidenceEdgeId(projectId, relation.claimId, relation.relation, relation.evidenceSlug),
      source: researchNodeId(relation.evidenceSlug),
      target: manuscriptClaimNodeId(projectId, relation.claimId),
      type: relation.relation,
      layer: "claim-evidence",
      explicit: true,
    });
  }

  const nodeList = [...nodes.values()];
  return {
    projectId,
    nodes: nodeList,
    edges,
    issues,
    relationIssues,
    stats: {
      manuscriptFiles: nodeList.filter((node) => node.kind === "manuscript").length,
      claims: nodeList.filter((node) => node.kind === "claim").length,
      claimIssues: issues.length,
      duplicates: issues.filter((issue) => issue.type === "duplicate").length,
      invalid: issues.filter((issue) => issue.type === "invalid-id").length,
      orphan: issues.filter((issue) => issue.type === "orphan").length,
      relations: edges.filter((edge) => edge.layer === "claim-evidence").length,
      relationIssues: relationIssues.length,
      relationDuplicates: relationIssues.filter((issue) => issue.type === "duplicate-relation").length,
      relationUnresolved: relationIssues.filter((issue) => ["claim-unresolved", "evidence-missing", "evidence-cross-project", "evidence-type"].includes(issue.type)).length,
    },
  };
}

export async function loadManuscriptClaimProjection({
  rootDir = process.cwd(),
  projectId = "default",
  researchEntries = [],
} = {}) {
  const workspace = await listLatexWorkspace({ rootDir, projectId });
  const files = [];
  for (const item of workspace.files.filter((file) => file.editable && !file.hidden && file.extension === ".tex")) {
    const source = await readLatexSource({ rootDir, projectId, file: item.path });
    files.push({ file: item.path, content: source.content });
  }
  return buildManuscriptClaimProjection({ projectId, mainFile: workspace.mainFile, files, researchEntries });
}
