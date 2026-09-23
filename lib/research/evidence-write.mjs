import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";

function yamlString(value) {
  return JSON.stringify(String(value));
}

function slugPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "paper";
}

function quoteBlock(value) {
  return String(value).split(/\r?\n/).map((line) => "> " + line).join("\n");
}

function cleanString(value, max = 12000) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function normalizeDoi(value) {
  return cleanString(value, 500)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

function cleanAuthors(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 80)
    : [];
}

function relationshipFor(workspace, relationship) {
  if (!relationship?.target) return {};
  const type = String(relationship.type ?? "").trim();
  const target = String(relationship.target ?? "").trim();
  if (!workspace.config.allowedRelationshipTypes.includes(type)) throw new Error("Unsupported relationship type.");
  const targetEntry = workspace.entries.find((entry) => entry.slug === target || entry.aliases.includes(target) || entry.fileSlug === target);
  if (!targetEntry) throw new Error("Relationship target does not exist.");
  return { relationship: { type, target: targetEntry.slug }, targetEntry };
}

function projectPlacement(workspace, research) {
  const project = workspace.projects.find((item) => item.id === research);
  const directory = project?.directory;
  const entries = workspace.entries.filter((entry) => entry.research === research);
  const nextOrder = entries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  return { project, directory, nextOrder };
}

function storedFilename(directory, basename) {
  return directory ? path.posix.join(directory, basename) : basename;
}

function sourcePathFromProject(directory, sourcePath) {
  if (!directory) return sourcePath;
  const relative = path.posix.relative(directory.replace(/\\/g, "/"), sourcePath.replace(/\\/g, "/"));
  return relative || path.posix.basename(sourcePath);
}

async function writeValidatedEvidence({ root, workspace, filename, lines, id, order, research, sourceKind }) {
  const absolute = path.join(workspace.progressRoot, ...filename.split("/"));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, lines.join("\n"), { encoding: "utf8", flag: "wx" });

  const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
  const introduced = compiled.diagnostics.filter((item) => item.severity === "error" && item.file === filename);
  if (introduced.length) {
    await fs.rm(absolute, { force: true });
    await writeResearchArtifacts({ rootDir: root, fresh: true });
    throw new Error("Evidence note failed validation: " + introduced.map((item) => item.message).join(" "));
  }

  return { id, slug: id, filename, order, research, sourceKind };
}

export async function createEvidenceNote({
  rootDir = process.cwd(),
  paperPath,
  page,
  quote,
  comment,
  relationship,
} = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const normalizedPaper = String(paperPath ?? "").trim().replace(/^\.\//, "").replace(/\\/g, "/");
  const sourceAsset = workspace.assets.find((asset) => asset.path === normalizedPaper && asset.extension === ".pdf");
  if (!sourceAsset) throw new Error("Evidence source must be an existing local PDF in progress/.");

  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Evidence page must be a positive integer.");

  const excerpt = cleanString(quote, 16001);
  if (excerpt.length < 3) throw new Error("Select at least three characters of evidence.");
  if (excerpt.length > 16000) throw new Error("Selected evidence is too large; capture a more focused excerpt.");

  const cleanComment = cleanString(comment, 12000);
  const { relationship: cleanRelationship, targetEntry: relationshipTargetEntry } = relationshipFor(workspace, relationship);

  const assetProject = workspace.projects.find((project) => project.directory && normalizedPaper.startsWith(`${project.directory}/`));
  const paperProjects = [...new Set(workspace.entries
    .filter((entry) => entry.pdf === normalizedPaper)
    .map((entry) => entry.research)
    .filter(Boolean))];
  const research = assetProject?.id || (paperProjects.length === 1 ? paperProjects[0] : relationshipTargetEntry?.research || "default");
  const placement = projectPlacement(workspace, research);

  const paperName = normalizedPaper.split("/").pop() ?? "paper";
  const base = slugPart(paperName);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const id = `evidence-${base}-p${pageNumber}-${suffix}`;
  const basename = `${String(placement.nextOrder).padStart(2, "0")}_evidence_${base}_p${pageNumber}_${suffix}.md`;
  const filename = storedFilename(placement.directory, basename);
  const sourcePdf = sourcePathFromProject(placement.directory, normalizedPaper);

  const lines = [
    "---",
    `id: ${id}`,
    `title: ${yamlString(`Evidence: ${paperName.replace(/\.pdf$/i, "")} p. ${pageNumber}`)}`,
    `summary: ${yamlString(`Evidence excerpt from ${paperName}, page ${pageNumber}.`)}`,
    "type: evidence",
    "status: complete",
    ...(!placement.directory && research !== "default" ? [`research: ${research}`] : []),
    "source:",
    "  kind: pdf",
    `  pdf: ${yamlString(sourcePdf)}`,
    `  page: ${pageNumber}`,
  ];

  if (cleanRelationship) {
    lines.push(
      "relationships:",
      `  - type: ${cleanRelationship.type}`,
      `    target: ${cleanRelationship.target}`,
    );
  }

  lines.push(
    "---",
    "",
    `# Evidence: ${paperName.replace(/\.pdf$/i, "")} p. ${pageNumber}`,
    "",
    quoteBlock(excerpt),
  );

  if (cleanComment) lines.push("", "## Research note", "", cleanComment);
  lines.push("");

  return writeValidatedEvidence({
    root,
    workspace,
    filename,
    lines,
    id,
    order: placement.nextOrder,
    research,
    sourceKind: "pdf",
  });
}

export async function createConsensusEvidenceNote({
  rootDir = process.cwd(),
  paper,
  query,
  research: requestedResearch,
  comment,
  relationship,
} = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  if (!paper || typeof paper !== "object" || Array.isArray(paper)) throw new Error("Consensus evidence requires a paper result.");

  const title = cleanString(paper.title, 1000);
  const url = cleanString(paper.url, 3000);
  const doi = normalizeDoi(paper.doi);
  const paperId = cleanString(paper.id, 500);
  const journal = cleanString(paper.journal, 1000);
  const studyType = cleanString(paper.studyType, 300);
  const takeaway = cleanString(paper.takeaway, 12000);
  const abstract = cleanString(paper.abstract, 16000);
  const searchQuery = cleanString(query, 1200);
  const authors = cleanAuthors(paper.authors);
  const yearNumber = Number(paper.year);
  const year = Number.isInteger(yearNumber) && yearNumber >= 1000 && yearNumber <= 9999 ? yearNumber : undefined;
  const citationNumber = Number(paper.citationCount);
  const citationCount = Number.isInteger(citationNumber) && citationNumber >= 0 ? citationNumber : undefined;

  if (!title) throw new Error("Consensus paper title is required.");
  if (!url && !doi && !paperId) throw new Error("Consensus paper must include a source URL, DOI, or paper id.");
  if (url && !/^https:\/\//i.test(url)) throw new Error("Consensus source URL must use HTTPS.");

  const { relationship: cleanRelationship, targetEntry: relationshipTargetEntry } = relationshipFor(workspace, relationship);
  const requested = cleanString(requestedResearch, 100);
  const declaredResearch = workspace.projects.some((project) => project.id === requested) ? requested : undefined;
  const research = relationshipTargetEntry?.research || declaredResearch || "default";
  const placement = projectPlacement(workspace, research);

  const chunksRaw = Array.isArray(paper.fullTextChunks) ? paper.fullTextChunks : [];
  const fullTextChunks = [];
  let fullTextLength = 0;
  for (const chunk of chunksRaw) {
    if (!chunk || typeof chunk !== "object") continue;
    const text = cleanString(chunk.text, 8000);
    if (!text) continue;
    const remaining = 12000 - fullTextLength;
    if (remaining <= 0) break;
    const clipped = text.slice(0, remaining);
    fullTextLength += clipped.length;
    fullTextChunks.push({ text: clipped, section: cleanString(chunk.section, 300) || undefined });
    if (fullTextChunks.length >= 3) break;
  }

  const context = takeaway || abstract;
  const base = slugPart(title);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const id = `evidence-consensus-${base}-${suffix}`;
  const basename = `${String(placement.nextOrder).padStart(2, "0")}_evidence_consensus_${base}_${suffix}.md`;
  const filename = storedFilename(placement.directory, basename);
  const summary = fullTextChunks.length
    ? `Reviewed Consensus paper with eligible full-text evidence: ${title}`
    : `Reviewed Consensus paper saved as discovery context: ${title}`;

  const lines = [
    "---",
    `id: ${id}`,
    `title: ${yamlString(`Evidence: ${title}`)}`,
    `summary: ${yamlString(summary)}`,
    "type: evidence",
    "status: complete",
    ...(!placement.directory && research !== "default" ? [`research: ${research}`] : []),
    ...(authors.length ? ["authors:", ...authors.map((author) => `  - ${yamlString(author)}`)] : []),
    ...(year ? [`year: ${year}`] : []),
    ...(doi ? [`doi: ${yamlString(doi)}`] : []),
    "source:",
    "  kind: consensus",
    ...(url ? [`  url: ${yamlString(url)}`] : []),
    ...(doi ? [`  doi: ${yamlString(doi)}`] : []),
    ...(paperId ? [`  paper_id: ${yamlString(paperId)}`] : []),
    ...(searchQuery ? [`  query: ${yamlString(searchQuery)}`] : []),
  ];

  if (cleanRelationship) {
    lines.push(
      "relationships:",
      `  - type: ${cleanRelationship.type}`,
      `    target: ${cleanRelationship.target}`,
    );
  }

  lines.push("---", "", `# Evidence: ${title}`, "");
  if (url) lines.push(`[Open original paper / Consensus source](${url})`, "");
  else if (doi) lines.push(`[Open DOI](https://doi.org/${doi})`, "");

  const metadata = [
    authors.length ? authors.join(", ") : "",
    year ? String(year) : "",
    journal,
    studyType,
    citationCount !== undefined ? `${citationCount} citations at discovery time` : "",
  ].filter(Boolean).join(" · ");
  if (metadata) lines.push(metadata, "");
  if (searchQuery) lines.push(`**Consensus search query:** ${searchQuery}`, "");

  if (fullTextChunks.length) {
    lines.push(
      "## Evidence excerpt",
      "",
      "The following text was returned by Consensus as eligible full-text content. Review the original paper before relying on it for a claim.",
      "",
    );
    for (const chunk of fullTextChunks) {
      if (chunk.section) lines.push(`**${chunk.section}**`, "");
      lines.push(quoteBlock(chunk.text), "");
    }
  } else if (context) {
    lines.push(
      "## Discovery context",
      "",
      "The text below is Consensus takeaway/abstract metadata, not a verified full-text quotation from the paper.",
      "",
      context,
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

  const cleanComment = cleanString(comment, 12000);
  if (cleanComment) lines.push("## Research note", "", cleanComment, "");

  return writeValidatedEvidence({
    root,
    workspace,
    filename,
    lines,
    id,
    order: placement.nextOrder,
    research,
    sourceKind: "consensus",
  });
}
