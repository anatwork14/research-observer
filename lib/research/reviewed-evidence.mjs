import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";

const REVIEW_RELATION_TYPES = new Set(["supports", "contradicts", "answers"]);
const EXECUTABLE_CONTENT = /<\/?(?:script|iframe|object|embed|video|audio)\b|javascript:/i;

function clean(value, max = 12000) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function cleanLine(value, max = 1000) {
  return clean(value, max).replace(/\s+/g, " ");
}

function assertSafeText(values) {
  for (const value of values) {
    if (typeof value === "string" && EXECUTABLE_CONTENT.test(value)) {
      throw new Error("Reviewed Evidence source text cannot contain embedded or executable content.");
    }
  }
}

function yaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function normalizeDoi(value) {
  return cleanLine(value, 500)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

function authors(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 80)
    : [];
}

function slugPart(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "paper";
}

function quoteBlock(value) {
  return String(value).split(/\r?\n/).map((line) => `> ${line}`).join("\n");
}

function normalizePaper(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A reviewed Consensus paper is required.");
  const title = cleanLine(value.title, 1000);
  const url = cleanLine(value.url, 3000);
  const doi = normalizeDoi(value.doi);
  const paperId = cleanLine(value.id, 500);
  if (!title) throw new Error("Consensus paper title is required.");
  if (!url && !doi && !paperId) throw new Error("Consensus paper must include a source URL, DOI, or paper id.");
  if (url && !/^https:\/\//i.test(url)) throw new Error("Consensus source URL must use HTTPS.");

  const chunks = [];
  let used = 0;
  for (const chunk of Array.isArray(value.fullTextChunks) ? value.fullTextChunks : []) {
    if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) continue;
    const text = clean(chunk.text, 8000);
    if (!text) continue;
    const remaining = 12000 - used;
    if (remaining <= 0 || chunks.length >= 3) break;
    const clipped = text.slice(0, remaining);
    used += clipped.length;
    chunks.push({ text: clipped, section: cleanLine(chunk.section, 300) || undefined });
  }

  const normalizedAuthors = authors(value.authors);
  const journal = cleanLine(value.journal, 1000);
  const studyType = cleanLine(value.studyType, 300);
  const takeaway = clean(value.takeaway, 12000);
  const abstract = clean(value.abstract, 16000);
  assertSafeText([
    title,
    journal,
    studyType,
    takeaway,
    abstract,
    ...normalizedAuthors,
    ...chunks.flatMap((chunk) => [chunk.section || "", chunk.text]),
  ]);

  const yearValue = Number(value.year);
  const citationValue = Number(value.citationCount);
  return {
    title,
    url,
    doi,
    paperId,
    authors: normalizedAuthors,
    year: Number.isInteger(yearValue) && yearValue >= 1000 && yearValue <= 9999 ? yearValue : undefined,
    journal,
    studyType,
    citationCount: Number.isInteger(citationValue) && citationValue >= 0 ? citationValue : undefined,
    takeaway,
    abstract,
    fullTextChunks: chunks,
  };
}

function sourceIdentity(paper) {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
  if (paper.paperId) return `paper:${paper.paperId}`;
  return `url:${paper.url}`;
}

function resolveTarget(workspace, targetSlug) {
  const requested = cleanLine(targetSlug, 240);
  if (!requested) return null;
  const direct = workspace.entries.find((entry) => entry.slug === requested || entry.id === requested || entry.aliases?.includes(requested));
  if (direct) return direct;
  const fileMatches = workspace.entries.filter((entry) => entry.fileSlug === requested);
  if (fileMatches.length > 1) throw new Error("Evidence relationship target is ambiguous. Use the canonical note slug.");
  if (fileMatches[0]) return fileMatches[0];
  throw new Error("Evidence relationship target does not exist.");
}

function normalizeRelation(workspace, relationType, targetSlug) {
  const type = cleanLine(relationType, 40);
  if (!type) return { relationship: null, target: resolveTarget(workspace, targetSlug) };
  if (!REVIEW_RELATION_TYPES.has(type)) throw new Error("Reviewed Consensus Evidence may only propose supports, contradicts, or answers.");
  if (!workspace.config.allowedRelationshipTypes.includes(type)) throw new Error(`Relationship type “${type}” is not allowed by this workspace.`);
  const target = resolveTarget(workspace, targetSlug);
  if (!target) throw new Error("Choose a current research note before proposing an Evidence relationship.");
  if (type === "answers" && target.type !== "question") throw new Error("An answers relationship must target a canonical question note.");
  return { relationship: { type, target: target.slug }, target };
}

function placementFor(workspace, requestedResearch, target) {
  const requested = cleanLine(requestedResearch, 120);
  const declared = workspace.projects.find((project) => project.id === requested);
  const research = target?.research || declared?.id || "default";
  const project = workspace.projects.find((item) => item.id === research);
  if (!project) throw new Error("The target research project no longer exists.");
  const entries = workspace.entries.filter((entry) => entry.research === research);
  const order = entries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  return { research, project, directory: project.directory || "", order };
}

function storedFilename(directory, basename) {
  return directory ? path.posix.join(directory, basename) : basename;
}

function buildContent({ paper, query, comment, relationship, placement, id, filename }) {
  const summary = paper.fullTextChunks.length
    ? `Reviewed Consensus paper with eligible full-text evidence: ${paper.title}`
    : `Reviewed Consensus paper saved as discovery context: ${paper.title}`;
  const lines = [
    "---",
    `id: ${id}`,
    `title: ${yaml(`Evidence: ${paper.title}`)}`,
    `summary: ${yaml(summary)}`,
    "type: evidence",
    "status: complete",
    ...(!placement.directory && placement.research !== "default" ? [`research: ${placement.research}`] : []),
    ...(paper.authors.length ? ["authors:", ...paper.authors.map((author) => `  - ${yaml(author)}`)] : []),
    ...(paper.year ? [`year: ${paper.year}`] : []),
    ...(paper.doi ? [`doi: ${yaml(paper.doi)}`] : []),
    "source:",
    "  kind: consensus",
    ...(paper.url ? [`  url: ${yaml(paper.url)}`] : []),
    ...(paper.doi ? [`  doi: ${yaml(paper.doi)}`] : []),
    ...(paper.paperId ? [`  paper_id: ${yaml(paper.paperId)}`] : []),
    ...(query ? [`  query: ${yaml(query)}`] : []),
  ];
  if (relationship) {
    lines.push("relationships:", `  - type: ${relationship.type}`, `    target: ${relationship.target}`);
  }
  lines.push("---", "", `# Evidence: ${paper.title}`, "");
  if (paper.url) lines.push(`[Open original paper / Consensus source](${paper.url})`, "");
  else if (paper.doi) lines.push(`[Open DOI](https://doi.org/${paper.doi})`, "");
  const metadata = [
    paper.authors.length ? paper.authors.join(", ") : "",
    paper.year ? String(paper.year) : "",
    paper.journal,
    paper.studyType,
    paper.citationCount !== undefined ? `${paper.citationCount} citations at discovery time` : "",
  ].filter(Boolean).join(" · ");
  if (metadata) lines.push(metadata, "");
  if (query) lines.push(`**Consensus search query:** ${query}`, "");

  if (paper.fullTextChunks.length) {
    lines.push(
      "## Evidence excerpt",
      "",
      "The following text was returned by Consensus as eligible full-text content. Review the original paper before relying on it for a claim.",
      "",
    );
    for (const chunk of paper.fullTextChunks) {
      if (chunk.section) lines.push(`**${chunk.section}**`, "");
      lines.push(quoteBlock(chunk.text), "");
    }
  } else if (paper.takeaway || paper.abstract) {
    lines.push(
      "## Discovery context",
      "",
      "The text below is Consensus takeaway/abstract metadata, not a verified full-text quotation from the paper.",
      "",
      paper.takeaway || paper.abstract,
      "",
    );
  } else {
    lines.push(
      "## Discovery context",
      "",
      "No abstract, takeaway, or eligible full-text excerpt was returned. Use the source link above to inspect the paper directly.",
      "",
    );
  }
  if (comment) lines.push("## Research note", "", comment, "");
  return { filename, content: lines.join("\n") };
}

function proposalHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function diagnosticKey(item) {
  return [item.severity, item.code, item.file || "", item.message].join("|");
}

export function reviewedEvidenceWritable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export async function previewReviewedConsensusEvidence({ rootDir = process.cwd(), paper, query = "", research = "", targetSlug = "", relationType = "", comment = "" } = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const normalizedPaper = normalizePaper(paper);
  const cleanQuery = cleanLine(query, 1200);
  const cleanComment = clean(comment, 12000);
  assertSafeText([cleanQuery, cleanComment]);
  const { relationship, target } = normalizeRelation(workspace, relationType, targetSlug);
  const placement = placementFor(workspace, research, target);
  const identity = sourceIdentity(normalizedPaper);
  const seed = proposalHash({ workspaceSignature: workspace.signature, identity, query: cleanQuery, comment: cleanComment, relationship, research: placement.research });
  const suffix = seed.slice(0, 8);
  const base = slugPart(normalizedPaper.title);
  const id = `evidence-consensus-${base}-${suffix}`;
  const basename = `${String(placement.order).padStart(2, "0")}_evidence_consensus_${base}_${suffix}.md`;
  const filename = storedFilename(placement.directory, basename);
  const file = buildContent({ paper: normalizedPaper, query: cleanQuery, comment: cleanComment, relationship, placement, id, filename });
  const hash = proposalHash({ workspaceSignature: workspace.signature, sourceIdentity: identity, relationship, targetSlug: target?.slug || "", file });
  return {
    workspaceSignature: workspace.signature,
    proposalHash: hash,
    sourceIdentity: identity,
    source: {
      title: normalizedPaper.title,
      doi: normalizedPaper.doi || undefined,
      paperId: normalizedPaper.paperId || undefined,
      url: normalizedPaper.url || undefined,
      hasFullTextExcerpt: normalizedPaper.fullTextChunks.length > 0,
    },
    project: { id: placement.project.id, label: placement.project.label, directory: placement.directory },
    target: target ? { slug: target.slug, title: target.title, type: target.type, research: target.research } : null,
    relationship,
    file: { id, filename: file.filename, content: file.content },
  };
}

export async function applyReviewedConsensusEvidence({ rootDir = process.cwd(), expectedWorkspaceSignature, expectedProposalHash, ...input } = {}) {
  if (!reviewedEvidenceWritable()) throw Object.assign(new Error("Reviewed Evidence writes are disabled in this environment."), { code: "EVIDENCE_REVIEW_DISABLED" });
  const root = path.resolve(rootDir);
  const before = await compileResearchWorkspace({ rootDir: root, fresh: true });
  if (!expectedWorkspaceSignature || before.signature !== expectedWorkspaceSignature) {
    throw Object.assign(new Error("The research workspace changed after Evidence review. Build a fresh preview before applying."), { code: "EVIDENCE_REVIEW_STALE" });
  }
  const preview = await previewReviewedConsensusEvidence({ rootDir: root, ...input });
  if (!expectedProposalHash || preview.proposalHash !== expectedProposalHash) {
    throw Object.assign(new Error("The reviewed Evidence proposal changed. Build a fresh preview before applying."), { code: "EVIDENCE_REVIEW_CHANGED" });
  }

  const absolute = path.resolve(before.progressRoot, ...preview.file.filename.split("/"));
  const relative = path.relative(before.progressRoot, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Evidence proposal escaped the configured research root.");
  try {
    await fs.stat(absolute);
    throw new Error("The reviewed Evidence target already exists. Build a fresh preview.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const baselineErrors = new Set(before.diagnostics.filter((item) => item.severity === "error").map(diagnosticKey));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  try {
    await fs.writeFile(absolute, preview.file.content, { encoding: "utf8", flag: "wx" });
    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const introduced = compiled.diagnostics.filter((item) => item.severity === "error" && !baselineErrors.has(diagnosticKey(item)));
    if (introduced.length) throw new Error("The reviewed Evidence proposal introduced validation errors: " + introduced.slice(0, 6).map((item) => item.message).join(" "));
    const entry = compiled.entries.find((item) => item.filename === preview.file.filename);
    if (!entry) throw new Error("The research compiler did not index the reviewed Evidence note.");
    return {
      slug: entry.slug,
      filename: entry.filename,
      title: entry.title,
      research: entry.research,
      relationship: preview.relationship,
      sourceIdentity: preview.sourceIdentity,
      workspaceSignature: compiled.signature,
    };
  } catch (error) {
    await fs.rm(absolute, { force: true }).catch(() => null);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
