import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";

function yamlString(value) {
  return JSON.stringify(String(value));
}

function slugPart(value) {
  return value
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "paper";
}

function quoteBlock(value) {
  return value.split(/\r?\n/).map((line) => "> " + line).join("\n");
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
  const normalizedPaper = String(paperPath ?? "").trim().replace(/^\.\//, "");
  const sourceAsset = workspace.assets.find((asset) => asset.path === normalizedPaper && asset.extension === ".pdf");
  if (!sourceAsset) throw new Error("Evidence source must be an existing local PDF in progress/.");

  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Evidence page must be a positive integer.");

  const excerpt = String(quote ?? "").replace(/\r\n/g, "\n").trim();
  if (excerpt.length < 3) throw new Error("Select at least three characters of evidence.");
  if (excerpt.length > 16000) throw new Error("Selected evidence is too large; capture a more focused excerpt.");

  const cleanComment = String(comment ?? "").trim().slice(0, 12000);
  let cleanRelationship;
  let relationshipTargetEntry;
  if (relationship?.target) {
    const type = String(relationship.type ?? "").trim();
    const target = String(relationship.target ?? "").trim();
    if (!workspace.config.allowedRelationshipTypes.includes(type)) throw new Error("Unsupported relationship type.");
    const targetEntry = workspace.entries.find((entry) => entry.slug === target || entry.aliases.includes(target) || entry.fileSlug === target);
    if (!targetEntry) throw new Error("Relationship target does not exist.");
    relationshipTargetEntry = targetEntry;
    cleanRelationship = { type, target: targetEntry.slug };
  }

  const paperProjects = [...new Set(workspace.entries
    .filter((entry) => entry.pdf === normalizedPaper)
    .map((entry) => entry.research)
    .filter(Boolean))];
  const research = relationshipTargetEntry?.research || (paperProjects.length === 1 ? paperProjects[0] : "default");

  const nextOrder = workspace.entries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  const paperName = normalizedPaper.split("/").pop() ?? "paper";
  const base = slugPart(paperName);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const id = `evidence-${base}-p${pageNumber}-${suffix}`;
  const filename = `${String(nextOrder).padStart(2, "0")}_evidence_${base}_p${pageNumber}_${suffix}.md`;
  const absolute = path.join(workspace.progressRoot, filename);

  const lines = [
    "---",
    `id: ${id}`,
    `title: ${yamlString(`Evidence: ${paperName.replace(/\.pdf$/i, "")} p. ${pageNumber}`)}`,
    `summary: ${yamlString(`Evidence excerpt from ${paperName}, page ${pageNumber}.`)}`,
    "type: evidence",
    "status: complete",
    ...(research !== "default" ? [`research: ${research}`] : []),
    "source:",
    `  pdf: ${yamlString(normalizedPaper)}`,
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

  if (cleanComment) {
    lines.push("", "## Research note", "", cleanComment);
  }

  lines.push("");
  await fs.writeFile(absolute, lines.join("\n"), { encoding: "utf8", flag: "wx" });

  const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
  const introduced = compiled.diagnostics.filter((item) => item.severity === "error" && item.file === filename);
  if (introduced.length) {
    await fs.rm(absolute, { force: true });
    await writeResearchArtifacts({ rootDir: root, fresh: true });
    throw new Error("Evidence note failed validation: " + introduced.map((item) => item.message).join(" "));
  }

  return { id, slug: id, filename, order: nextOrder, research };
}
