import crypto from "node:crypto";
import path from "node:path";
import { listLatexWorkspace, readLatexSource } from "./latex-ide.mjs";
import { resolveLatexCitationTokens } from "./latex-citations.mjs";

const PROMOTION_MARKER = /\*\*Observaire source annotation:\*\*\s*`([^`]+)`/i;
const ANNOTATION_TYPE = /\*\*Annotation type:\*\*\s*([^\n]+)/i;
const ANCHOR_KIND = /\*\*Anchor kind:\*\*\s*([^\n]+)/i;
const REGION_SOURCE_KIND = /\*\*Region source text kind:\*\*\s*([^\n]+)/i;

function researchNodeId(slug) {
  return `research:${slug}`;
}

function paperNodeId(pdf) {
  return `paper:${pdf}`;
}

function consensusPaperNodeId(identity) {
  const digest = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `paper:consensus:${digest}`;
}

function annotationNodeId(id) {
  return `annotation:${id}`;
}

function manuscriptNodeId(projectId, file) {
  return `manuscript:${projectId}:${file}`;
}

function citationNodeId(projectId, file, start, key) {
  return `citation:${projectId}:${file}:${start}:${key}`;
}

function cleanLineMatch(content, expression) {
  return content.match(expression)?.[1]?.trim() || undefined;
}

function safeAssetCandidate(raw) {
  const input = typeof raw === "string" ? raw.trim().replace(/\\/g, "/").replace(/^\.\//, "") : "";
  if (!input || /^https?:\/\//i.test(input) || path.posix.isAbsolute(input)) return "";
  const normalized = path.posix.normalize(input);
  if (normalized === ".." || normalized.startsWith("../")) return "";
  return normalized;
}

function resolveEntryPdf(assetPaths, entry) {
  const raw = entry.pdf || (entry.source?.kind === "pdf" ? entry.source.pdf : "");
  const candidate = safeAssetCandidate(raw);
  if (!candidate) return "";
  if (assetPaths.has(candidate)) return candidate;
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(entry.filename), candidate));
  return assetPaths.has(joined) ? joined : "";
}

function normalizeDoi(value) {
  return typeof value === "string"
    ? value.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").toLowerCase()
    : "";
}

function normalizeHttpsUrl(value) {
  if (typeof value !== "string" || !/^https:\/\//i.test(value.trim())) return "";
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function consensusSourceForEntry(entry) {
  if (entry.source?.kind !== "consensus") return null;
  const doi = normalizeDoi(entry.source.doi);
  const paperId = typeof entry.source.paperId === "string" ? entry.source.paperId.trim() : "";
  const url = normalizeHttpsUrl(entry.source.url);
  const identity = doi ? `doi:${doi}` : paperId ? `paper:${paperId}` : url ? `url:${url}` : "";
  if (!identity) return null;
  const fallbackLabel = doi || paperId || url;
  const label = String(entry.title || "").replace(/^Evidence:\s*/i, "").trim() || fallbackLabel;
  return {
    id: consensusPaperNodeId(identity),
    label,
    sourceKind: "consensus",
    doi: doi || undefined,
    url: url || undefined,
    paperId: paperId || undefined,
  };
}

function semanticRole(type) {
  if (type === "literature") return "source";
  if (type === "evidence") return "evidence";
  if (type === "hypothesis" || type === "result" || type === "decision") return "claim";
  if (type === "question") return "question";
  if (type === "experiment" || type === "evaluation" || type === "method") return "investigation";
  return "research";
}

function uniquePush(map, item) {
  if (!map.has(item.id)) map.set(item.id, item);
}

function edgeId(layer, type, source, target, suffix = "") {
  return `${layer}:${type}:${source}->${target}${suffix ? `:${suffix}` : ""}`;
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function lineageComponents(nodes, supersedes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map();
  for (const edge of supersedes) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }

  const visited = new Set();
  const components = [];
  for (const nodeId of adjacency.keys()) {
    if (visited.has(nodeId)) continue;
    const stack = [nodeId];
    const members = [];
    visited.add(nodeId);
    while (stack.length) {
      const current = stack.pop();
      members.push(current);
      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        stack.push(neighbor);
      }
    }
    components.push(members);
  }

  return components.map((members, index) => {
    const memberSet = new Set(members);
    const edges = supersedes.filter((edge) => memberSet.has(edge.source) && memberSet.has(edge.target));
    const outgoing = new Map(members.map((id) => [id, 0]));
    const incoming = new Map(members.map((id) => [id, 0]));
    for (const edge of edges) {
      outgoing.set(edge.source, (outgoing.get(edge.source) || 0) + 1);
      incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    }

    const color = new Map();
    let cyclic = false;
    function visit(id) {
      color.set(id, 1);
      for (const edge of edges.filter((item) => item.source === id)) {
        const next = edge.target;
        if (color.get(next) === 1) cyclic = true;
        else if (!color.get(next)) visit(next);
      }
      color.set(id, 2);
    }
    for (const id of members) if (!color.get(id)) visit(id);

    const ordered = members
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const ad = a.date || "";
        const bd = b.date || "";
        return ad.localeCompare(bd) || (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label);
      })
      .map((node) => node.id);

    return {
      id: `lineage:${index}:${ordered[0] || members[0]}`,
      members: ordered,
      newest: members.filter((id) => (incoming.get(id) || 0) === 0),
      oldest: members.filter((id) => (outgoing.get(id) || 0) === 0),
      cyclic,
    };
  });
}

export function buildResearchEvolutionProjection(workspace, { projectId } = {}) {
  const entries = workspace.entries.filter((entry) => !projectId || entry.research === projectId);
  const slugs = new Set(entries.map((entry) => entry.slug));
  const assetPaths = new Set((workspace.assets || []).filter((asset) => asset.extension === ".pdf").map((asset) => asset.path));
  const nodes = new Map();
  const edges = [];
  const timeline = [];

  for (const entry of entries) {
    const id = researchNodeId(entry.slug);
    uniquePush(nodes, {
      id,
      kind: "research",
      slug: entry.slug,
      label: entry.title,
      research: entry.research,
      type: entry.type,
      status: entry.status,
      role: semanticRole(entry.type),
      date: entry.date,
      order: entry.order,
      href: `/progress/${entry.slug}`,
    });

    if (entry.date) {
      timeline.push({
        id: `timeline:research:${entry.slug}:${entry.date}`,
        at: `${entry.date}T00:00:00.000Z`,
        kind: "research",
        nodeId: id,
        label: entry.title,
        research: entry.research,
        type: entry.type,
        status: entry.status,
      });
    }

    const pdf = resolveEntryPdf(assetPaths, entry);
    if (pdf) {
      const paperId = paperNodeId(pdf);
      uniquePush(nodes, {
        id: paperId,
        kind: "paper",
        label: pdf.split("/").pop() || pdf,
        research: entry.research,
        pdf,
        sourceKind: "pdf",
        role: "source",
        type: "local-pdf",
        href: `/papers/${pdf.split("/").map(encodeURIComponent).join("/")}`,
      });

      const annotationId = entry.type === "evidence" ? cleanLineMatch(entry.content || "", PROMOTION_MARKER) : undefined;
      if (annotationId) {
        const snapshotId = annotationNodeId(annotationId);
        uniquePush(nodes, {
          id: snapshotId,
          kind: "annotation",
          label: `Annotation ${annotationId}`,
          research: entry.research,
          annotationId,
          annotationType: cleanLineMatch(entry.content || "", ANNOTATION_TYPE),
          anchorKind: cleanLineMatch(entry.content || "", ANCHOR_KIND),
          sourceTextKind: cleanLineMatch(entry.content || "", REGION_SOURCE_KIND),
          page: entry.source?.page,
          role: "evidence-source",
          href: `/papers/${pdf.split("/").map(encodeURIComponent).join("/")}${entry.source?.page ? `?page=${entry.source.page}` : ""}`,
        });
        edges.push({
          id: edgeId("source", "annotated_as", paperId, snapshotId),
          source: paperId,
          target: snapshotId,
          type: "annotated_as",
          layer: "source",
          explicit: true,
        });
        edges.push({
          id: edgeId("source", "promoted_to", snapshotId, id),
          source: snapshotId,
          target: id,
          type: "promoted_to",
          layer: "source",
          explicit: true,
        });
      } else {
        edges.push({
          id: edgeId("source", entry.type === "literature" ? "described_by" : "source_of", paperId, id),
          source: paperId,
          target: id,
          type: entry.type === "literature" ? "described_by" : "source_of",
          layer: "source",
          explicit: true,
        });
      }
    } else {
      const external = consensusSourceForEntry(entry);
      if (external) {
        uniquePush(nodes, {
          ...external,
          kind: "paper",
          research: entry.research,
          role: "source",
          type: "consensus",
        });
        edges.push({
          id: edgeId("source", "source_of", external.id, id),
          source: external.id,
          target: id,
          type: "source_of",
          layer: "source",
          explicit: true,
        });
      }
    }
  }

  for (const edge of workspace.graph.edges) {
    if (!slugs.has(edge.source) || !slugs.has(edge.target)) continue;
    const source = researchNodeId(edge.source);
    const target = researchNodeId(edge.target);
    const layer = edge.type === "supersedes" && edge.explicit ? "version" : edge.explicit ? "semantic" : "reference";
    edges.push({
      id: edgeId(layer, edge.type, source, target),
      source,
      target,
      type: edge.type,
      layer,
      explicit: edge.explicit,
    });
  }

  for (const run of workspace.experiments || []) {
    if (projectId && run.project !== projectId) continue;
    for (const [name, raw] of Object.entries(run.timestamps || {})) {
      const at = parseDate(raw);
      if (!at) continue;
      timeline.push({
        id: `timeline:run:${run.id}:${name}:${at}`,
        at,
        kind: "run",
        label: run.label,
        research: run.project || projectId || "default",
        type: name,
        status: run.status,
        experimentSlug: run.experimentSlug,
        runId: run.id,
      });
    }
  }

  timeline.sort((a, b) => a.at.localeCompare(b.at) || a.label.localeCompare(b.label));
  const nodeList = [...nodes.values()];
  const versionEdges = edges.filter((edge) => edge.layer === "version");
  const lineages = lineageComponents(nodeList.filter((node) => node.kind === "research"), versionEdges);

  return {
    projectId: projectId || null,
    nodes: nodeList,
    edges,
    timeline,
    lineages,
    stats: {
      researchNodes: nodeList.filter((node) => node.kind === "research").length,
      paperNodes: nodeList.filter((node) => node.kind === "paper").length,
      annotationNodes: nodeList.filter((node) => node.kind === "annotation").length,
      semanticEdges: edges.filter((edge) => edge.layer === "semantic").length,
      referenceEdges: edges.filter((edge) => edge.layer === "reference").length,
      sourceEdges: edges.filter((edge) => edge.layer === "source").length,
      versionEdges: versionEdges.length,
      timelineEvents: timeline.length,
      versionLineages: lineages.length,
    },
  };
}

export function buildManuscriptCitationProjection({ projectId = "default", mainFile = "", files = [] } = {}) {
  const nodes = new Map();
  const edges = [];
  const unresolved = [];

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
      href: `/ide?research=${encodeURIComponent(projectId)}`,
    });

    for (const citation of item.citations || []) {
      const citationId = citationNodeId(projectId, item.file, citation.start, citation.key);
      uniquePush(nodes, {
        id: citationId,
        kind: "citation",
        label: citation.key,
        research: projectId,
        file: item.file,
        key: citation.key,
        start: citation.start,
        end: citation.end,
        status: citation.status,
        choices: (citation.choices || []).map((choice) => choice.slug),
        role: "citation",
        href: `/ide?research=${encodeURIComponent(projectId)}`,
      });
      edges.push({
        id: edgeId("citation", "appears_in", citationId, manuscriptId),
        source: citationId,
        target: manuscriptId,
        type: "appears_in",
        layer: "citation",
        explicit: true,
      });

      if (citation.status === "resolved" && citation.choices?.length === 1) {
        const target = researchNodeId(citation.choices[0].slug);
        edges.push({
          id: edgeId("citation", "cited_as", target, citationId),
          source: target,
          target: citationId,
          type: "cited_as",
          layer: "citation",
          explicit: true,
        });
      } else {
        unresolved.push({
          file: item.file,
          key: citation.key,
          status: citation.status,
          choices: (citation.choices || []).map((choice) => choice.slug),
        });
      }
    }
  }

  return {
    projectId,
    nodes: [...nodes.values()],
    edges,
    unresolved,
    stats: {
      manuscriptFiles: [...nodes.values()].filter((node) => node.kind === "manuscript").length,
      citations: [...nodes.values()].filter((node) => node.kind === "citation").length,
      resolved: edges.filter((edge) => edge.type === "cited_as").length,
      ambiguous: unresolved.filter((item) => item.status === "ambiguous").length,
      missing: unresolved.filter((item) => item.status === "missing").length,
    },
  };
}

export async function loadManuscriptCitationProjection({ rootDir = process.cwd(), projectId = "default" } = {}) {
  const workspace = await listLatexWorkspace({ rootDir, projectId });
  const files = [];
  for (const item of workspace.files.filter((file) => file.editable && !file.hidden && file.extension === ".tex")) {
    const source = await readLatexSource({ rootDir, projectId, file: item.path });
    const resolved = await resolveLatexCitationTokens({ rootDir, projectId, file: item.path, content: source.content });
    files.push({ file: item.path, citations: resolved.citations });
  }
  return buildManuscriptCitationProjection({ projectId, mainFile: workspace.mainFile, files });
}

export function mergeEvolutionProjections(research, manuscript) {
  const nodes = new Map(research.nodes.map((node) => [node.id, node]));
  for (const node of manuscript.nodes || []) uniquePush(nodes, node);
  const edges = [...research.edges, ...(manuscript.edges || [])]
    .filter((edge) => nodes.has(edge.source) && nodes.has(edge.target));
  return {
    ...research,
    nodes: [...nodes.values()],
    edges,
    manuscript,
    stats: {
      ...research.stats,
      manuscriptNodes: (manuscript.nodes || []).filter((node) => node.kind === "manuscript").length,
      citationNodes: (manuscript.nodes || []).filter((node) => node.kind === "citation").length,
      citationEdges: (manuscript.edges || []).length,
      unresolvedCitations: manuscript.unresolved?.length || 0,
    },
  };
}
