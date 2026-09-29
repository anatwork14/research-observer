import { listLatexWorkspace, readLatexSource } from "./latex-ide.mjs";
import {
  claimPassageIdentity,
  manuscriptClaimNodeId,
  parseManuscriptClaimAnchors,
} from "./manuscript-claims.mjs";

function manuscriptNodeId(projectId, file) {
  return `manuscript:${projectId}:${file}`;
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

export function buildManuscriptClaimProjection({ projectId = "default", mainFile = "", files = [] } = {}) {
  const nodes = new Map();
  const edges = [];
  const issues = [];
  const occurrences = [];

  for (const item of files) {
    const parsed = parseManuscriptClaimAnchors(item.content || "");
    for (const issue of parsed.issues) issues.push({ ...issue, file: item.file });
    for (const claim of parsed.claims) occurrences.push({ ...claim, file: item.file });
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

  for (const claim of occurrences) {
    if (duplicateIds.has(claim.claimId)) continue;
    const manuscriptId = manuscriptNodeId(projectId, claim.file);
    const passage = passageNode(projectId, claim.file, claim);
    const claimId = manuscriptClaimNodeId(projectId, claim.claimId);

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

  const nodeList = [...nodes.values()];
  return {
    projectId,
    nodes: nodeList,
    edges,
    issues,
    stats: {
      manuscriptFiles: nodeList.filter((node) => node.kind === "manuscript").length,
      claims: nodeList.filter((node) => node.kind === "claim").length,
      claimIssues: issues.length,
      duplicates: issues.filter((issue) => issue.type === "duplicate").length,
      invalid: issues.filter((issue) => issue.type === "invalid-id").length,
      orphan: issues.filter((issue) => issue.type === "orphan").length,
    },
  };
}

export async function loadManuscriptClaimProjection({ rootDir = process.cwd(), projectId = "default" } = {}) {
  const workspace = await listLatexWorkspace({ rootDir, projectId });
  const files = [];
  for (const item of workspace.files.filter((file) => file.editable && !file.hidden && file.extension === ".tex")) {
    const source = await readLatexSource({ rootDir, projectId, file: item.path });
    files.push({ file: item.path, content: source.content });
  }
  return buildManuscriptClaimProjection({ projectId, mainFile: workspace.mainFile, files });
}
