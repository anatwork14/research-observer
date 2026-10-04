import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";
import { listPdfAnnotations } from "./pdf-annotations.mjs";

const SNAPSHOT_FENCE = "observaire-pdf-annotation-v1";
const BLOCKED_EMBED = /<\/?(?:script|iframe|object|embed|video|audio)\b|javascript:/i;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function yaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function clean(value, max = 64000) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function slugPart(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "paper";
}

function quoteBlock(value) {
  return String(value).split(/\r?\n/).map((line) => `> ${line}`).join("\n");
}

function sourcePathFromProject(directory, sourcePath) {
  if (!directory) return sourcePath;
  const relative = path.posix.relative(directory.replace(/\\/g, "/"), sourcePath.replace(/\\/g, "/"));
  if (!relative || relative === ".." || relative.startsWith("../") || path.posix.isAbsolute(relative)) {
    throw new Error("PDF annotation source does not belong to the resolved research project.");
  }
  return relative;
}

function storedFilename(directory, basename) {
  return directory ? path.posix.join(directory, basename) : basename;
}

function roundRect(rect) {
  const value = (number) => Math.round(Number(number) * 1_000_000) / 1_000_000;
  return { x: value(rect.x), y: value(rect.y), width: value(rect.width), height: value(rect.height) };
}

function snapshotFor(annotation, document) {
  return {
    schemaVersion: 1,
    annotationId: annotation.id,
    annotationType: annotation.type,
    anchorKind: annotation.anchorKind,
    page: annotation.page,
    rects: annotation.rects.map(roundRect),
    documentSha256: document.sha256,
    anchorDocumentSha256: annotation.anchor?.documentSha256 || document.sha256,
    ...(annotation.sourceText ? {
      sourceText: {
        kind: annotation.sourceText.kind,
        sha256: annotation.sourceText.sha256,
        verifiedAt: annotation.sourceText.verifiedAt,
        anchorDocumentSha256: annotation.sourceText.anchorDocumentSha256,
        anchorPage: annotation.sourceText.anchorPage,
      },
    } : {}),
    ...(annotation.tags?.length ? { tags: [...annotation.tags] } : {}),
  };
}

function validateSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== 1) return null;
  if (typeof value.annotationId !== "string" || !value.annotationId.startsWith("ann-")) return null;
  if (value.anchorKind !== "text" && value.anchorKind !== "region") return null;
  if (!Number.isInteger(value.page) || value.page < 1 || !Array.isArray(value.rects) || !value.rects.length) return null;
  if (typeof value.documentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.documentSha256)) return null;
  const rects = value.rects.flatMap((rect) => {
    if (!rect || typeof rect !== "object" || Array.isArray(rect)) return [];
    const x = Number(rect.x); const y = Number(rect.y); const width = Number(rect.width); const height = Number(rect.height);
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.002 || y + height > 1.002) return [];
    return [{ x, y, width, height }];
  });
  if (rects.length !== value.rects.length) return null;
  return { ...value, rects };
}

export function parsePdfAnnotationPromotionSnapshot(content) {
  const match = String(content ?? "").match(new RegExp("```" + SNAPSHOT_FENCE + "\\s*\\n([\\s\\S]*?)\\n```"));
  if (!match) return null;
  try {
    return validateSnapshot(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function diagnosticKey(item) {
  return [item.severity, item.code, item.file || "", item.message].join("|");
}

function evidenceTextFor(annotation) {
  if (annotation.anchorKind === "region") {
    if (!annotation.sourceText?.text?.trim() || annotation.sourceText.reviewRequired) {
      throw new Error("Region annotations need reviewed caption/OCR/transcription text before Evidence review.");
    }
    if (annotation.sourceText.anchorPage !== annotation.page || annotation.sourceText.anchorDocumentSha256 !== annotation.anchor?.documentSha256) {
      throw new Error("Region source text must be re-reviewed against the current region anchor before Evidence review.");
    }
    return clean(annotation.sourceText.text, 64000);
  }
  const quote = clean(annotation.quote?.exact, 64000);
  if (quote.length < 3) throw new Error("Text annotations need at least three selected characters before Evidence review.");
  return quote;
}

function buildContent({ annotation, snapshot, paperName, sourcePdf, evidenceText, research, directory, id }) {
  const titleSuffix = annotation.anchorKind === "region" ? ` · ${annotation.type}` : "";
  const title = `Evidence: ${paperName.replace(/\.pdf$/i, "")} p. ${annotation.page}${titleSuffix}`;
  const lines = [
    "---",
    `id: ${id}`,
    `title: ${yaml(title)}`,
    `summary: ${yaml(annotation.anchorKind === "region" ? `Reviewed ${annotation.type} region from ${paperName}, page ${annotation.page}.` : `Evidence excerpt from ${paperName}, page ${annotation.page}.`)}`,
    "type: evidence",
    "status: complete",
    ...(!directory && research !== "default" ? [`research: ${research}`] : []),
    "source:",
    "  kind: pdf",
    `  pdf: ${yaml(sourcePdf)}`,
    `  page: ${annotation.page}`,
    "---",
    "",
    `# ${title}`,
    "",
    annotation.anchorKind === "region" ? "## Reviewed region source text" : "## Evidence excerpt",
    "",
    quoteBlock(evidenceText),
    "",
  ];
  if (annotation.comment?.trim()) lines.push("## Research note", "", annotation.comment.trim(), "");
  lines.push(
    "## Spatial provenance",
    "",
    `**Observaire source annotation:** \`${annotation.id}\``,
    "",
    `**Annotation type:** ${annotation.type}`,
    "",
    `**Anchor kind:** ${annotation.anchorKind}`,
    "",
    `**Document SHA-256:** ${snapshot.documentSha256}`,
    "",
    `**Page:** ${annotation.page}`,
    "",
    `**Normalized rectangles:** ${snapshot.rects.length}`,
    "",
  );
  if (snapshot.sourceText) {
    lines.push(
      `**Region source text kind:** ${snapshot.sourceText.kind}`,
      "",
      `**Region source text SHA-256:** ${snapshot.sourceText.sha256}`,
      "",
      `**Region source text verified:** ${snapshot.sourceText.verifiedAt}`,
      "",
    );
  }
  if (snapshot.tags?.length) lines.push(`**Annotation tags:** ${snapshot.tags.map((tag) => `#${tag}`).join(" ")}`, "");
  lines.push(
    "The JSON block below is the immutable promotion snapshot used to reconstruct the reviewed page region without consulting the private annotation sidecar.",
    "",
    `\`\`\`${SNAPSHOT_FENCE}`,
    JSON.stringify(snapshot, null, 2),
    "```",
    "",
  );
  return { title, content: lines.join("\n") };
}

export function pdfEvidenceReviewWritable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export async function previewPdfAnnotationEvidence({ rootDir = process.cwd(), paperPath, id, expectedRevision } = {}) {
  const root = path.resolve(rootDir);
  const state = await listPdfAnnotations({ rootDir: root, paperPath, includeDeleted: true });
  if (expectedRevision !== undefined && Number(expectedRevision) !== state.revision) {
    throw Object.assign(new Error("Annotations changed after this Evidence review started. Reload and review again."), { code: "PDF_EVIDENCE_REVIEW_STALE", revision: state.revision });
  }
  const annotation = state.annotations.find((item) => item.id === id);
  if (!annotation) throw Object.assign(new Error("Annotation does not exist."), { code: "ANNOTATION_NOT_FOUND" });
  if (annotation.deletedAt) throw new Error("Restore the annotation before reviewing it as Evidence.");
  if (annotation.evidence) throw Object.assign(new Error("This annotation already has durable Evidence."), { code: "PDF_EVIDENCE_EXISTS", evidence: annotation.evidence });
  if (annotation.anchorStatus !== "current") throw new Error(`Re-anchor this ${annotation.anchorStatus || "legacy"} annotation against the current PDF before Evidence review.`);
  if (!state.document?.sha256 || annotation.anchor?.documentSha256 !== state.document.sha256) throw new Error("Annotation document fingerprint is not current.");

  const evidenceText = evidenceTextFor(annotation);
  if (BLOCKED_EMBED.test(evidenceText) || BLOCKED_EMBED.test(annotation.comment || "")) {
    throw new Error("Embedded or executable content is not allowed in promoted Evidence text.");
  }
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const project = workspace.projects.find((item) => item.id === state.project);
  if (!project) throw new Error("The annotation research project no longer exists.");
  const canonicalPaperPath = state.paper?.path || paperPath;
  const sourcePdf = sourcePathFromProject(project.directory || "", canonicalPaperPath);
  const projectEntries = workspace.entries.filter((entry) => entry.research === project.id);
  const order = projectEntries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  const snapshot = snapshotFor(annotation, state.document);
  const stableSeed = sha256(JSON.stringify({ paper: canonicalPaperPath, snapshot }));
  const suffix = stableSeed.slice(0, 8);
  const paperName = path.posix.basename(canonicalPaperPath);
  const base = slugPart(paperName);
  const idValue = `evidence-${base}-p${annotation.page}-${suffix}`;
  const basename = `${String(order).padStart(2, "0")}_evidence_${base}_p${annotation.page}_${suffix}.md`;
  const filename = storedFilename(project.directory || "", basename);
  const built = buildContent({
    annotation,
    snapshot,
    paperName,
    sourcePdf,
    evidenceText,
    research: project.id,
    directory: project.directory || "",
    id: idValue,
  });
  const proposalHash = sha256(JSON.stringify({
    workspaceSignature: workspace.signature,
    annotationRevision: state.revision,
    documentSha256: state.document.sha256,
    filename,
    content: built.content,
  }));
  return {
    workspaceSignature: workspace.signature,
    annotationRevision: state.revision,
    documentSha256: state.document.sha256,
    proposalHash,
    project: { id: project.id, label: project.label, directory: project.directory || "" },
    annotation: {
      id: annotation.id,
      type: annotation.type,
      anchorKind: annotation.anchorKind,
      page: annotation.page,
      rects: snapshot.rects,
      sourceText: snapshot.sourceText || null,
    },
    snapshot,
    file: { id: idValue, title: built.title, filename, content: built.content },
  };
}

export async function applyPdfAnnotationEvidence({ rootDir = process.cwd(), paperPath, id, expectedRevision, expectedWorkspaceSignature, expectedDocumentSha256, expectedProposalHash } = {}) {
  if (!pdfEvidenceReviewWritable()) {
    throw Object.assign(new Error("PDF Evidence Apply is disabled in this environment."), { code: "PDF_EVIDENCE_REVIEW_DISABLED" });
  }
  const root = path.resolve(rootDir);
  const latest = await listPdfAnnotations({ rootDir: root, paperPath, includeDeleted: true });
  if (Number(expectedRevision) !== latest.revision || !expectedDocumentSha256 || latest.document?.sha256 !== expectedDocumentSha256) {
    throw Object.assign(new Error("The annotation or PDF changed after review. Build a fresh Evidence preview before applying."), { code: "PDF_EVIDENCE_REVIEW_STALE", revision: latest.revision });
  }
  const before = await compileResearchWorkspace({ rootDir: root, fresh: true });
  if (!expectedWorkspaceSignature || before.signature !== expectedWorkspaceSignature) {
    throw Object.assign(new Error("The research workspace changed after review. Build a fresh Evidence preview before applying."), { code: "PDF_EVIDENCE_REVIEW_STALE", revision: latest.revision });
  }
  const preview = await previewPdfAnnotationEvidence({ rootDir: root, paperPath, id, expectedRevision: latest.revision });
  if (!expectedProposalHash || preview.proposalHash !== expectedProposalHash) {
    throw Object.assign(new Error("The PDF Evidence proposal changed after review. Build a fresh preview before applying."), { code: "PDF_EVIDENCE_REVIEW_CHANGED" });
  }

  const absolute = path.resolve(before.progressRoot, ...preview.file.filename.split("/"));
  const relative = path.relative(before.progressRoot, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("PDF Evidence proposal escaped the configured research root.");
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
    if (introduced.length) throw new Error("The reviewed PDF Evidence introduced validation errors: " + introduced.slice(0, 6).map((item) => item.message).join(" "));
    const entry = compiled.entries.find((item) => item.filename === preview.file.filename);
    if (!entry) throw new Error("The research compiler did not index the reviewed PDF Evidence note.");
    return {
      slug: entry.slug,
      filename: entry.filename,
      title: entry.title,
      research: entry.research,
      snapshot: preview.snapshot,
      workspaceSignature: compiled.signature,
    };
  } catch (error) {
    await fs.rm(absolute, { force: true }).catch(() => null);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
