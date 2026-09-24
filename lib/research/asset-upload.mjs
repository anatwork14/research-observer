import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";

const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"]);
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

function cleanText(value, max = 500) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "";
}

function slugPart(value) {
  return String(value ?? "").toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "upload";
}

function safeExtension(filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".pdf" || IMAGE_TYPES.has(extension)) return extension;
  throw new Error("Choose a PDF or a PNG, JPG, GIF, WebP, AVIF, or BMP image.");
}

function verifySignature(buffer, extension) {
  const starts = (...bytes) => bytes.every((byte, index) => buffer[index] === byte);
  const valid = extension === ".pdf" ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    : extension === ".png" ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      : extension === ".jpg" || extension === ".jpeg" ? starts(0xff, 0xd8, 0xff)
        : extension === ".gif" ? ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))
          : extension === ".webp" ? buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
            : extension === ".bmp" ? buffer.subarray(0, 2).toString("ascii") === "BM"
              : extension === ".avif" ? buffer.subarray(4, 12).toString("ascii").includes("ftyp") && buffer.subarray(8, 12).toString("ascii").includes("avif")
                : false;
  if (!valid) throw new Error("The uploaded file content does not match its filename type.");
}

async function prepareUpload(rootDir, file, researchId = "") {
  const workspace = await compileResearchWorkspace({ rootDir, fresh: true });
  const project = researchId ? workspace.projects.find((item) => item.id === researchId) : undefined;
  if (researchId && !project) throw new Error("Choose a project that exists in this workspace.");
  const extension = safeExtension(file.name);
  const max = Math.min(MAX_UPLOAD_BYTES, Number(workspace.config.maxAssetBytes) || MAX_UPLOAD_BYTES);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (buffer.length > max) throw new Error(`File exceeds the ${Math.floor(max / 1024 / 1024)} MB upload limit.`);
  verifySignature(buffer, extension);
  if (!workspace.config.allowedMediaExtensions.includes(extension)) throw new Error(`This workspace does not allow ${extension} files.`);
  const base = slugPart(file.name);
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const filename = `${base}-${token}${extension}`;
  const relativePath = path.posix.join(project?.directory ?? "", "papers", filename);
  const absolutePath = path.join(workspace.progressRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer, { flag: "wx" });
  return { workspace, extension, filename, relativePath, absolutePath, bytes: buffer.length };
}

export async function uploadPaper({ rootDir = process.cwd(), file, research = "" } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose a PDF to upload.");
  if (safeExtension(file.name) !== ".pdf") throw new Error("Papers accepts PDF files only.");
  const prepared = await prepareUpload(path.resolve(rootDir), file, research);
  try {
    const compiled = await writeResearchArtifacts({ rootDir: path.resolve(rootDir), fresh: true });
    if (compiled.diagnostics.some((item) => item.severity === "error" && item.file === prepared.relativePath)) {
      throw new Error("The uploaded PDF failed workspace validation.");
    }
    return { path: prepared.relativePath, filename: prepared.filename, bytes: prepared.bytes };
  } catch (error) {
    await fs.rm(prepared.absolutePath, { force: true });
    await writeResearchArtifacts({ rootDir: path.resolve(rootDir), fresh: true }).catch(() => null);
    throw error;
  }
}

export async function uploadEvidence({ rootDir = process.cwd(), file, title, comment, research = "" } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose a PDF or image to submit as evidence.");
  const root = path.resolve(rootDir);
  const prepared = await prepareUpload(root, file, research);
  const cleanTitle = cleanText(title, 240) || path.basename(file.name, path.extname(file.name));
  const cleanComment = cleanText(comment, 4000);
  const project = research ? prepared.workspace.projects.find((item) => item.id === research) : undefined;
  const projectId = project?.id ?? "default";
  const entries = prepared.workspace.entries.filter((entry) => entry.research === projectId);
  const order = entries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  const id = `evidence-upload-${slugPart(cleanTitle)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const noteName = `${String(order).padStart(2, "0")}_evidence_${slugPart(cleanTitle)}_${id.slice(-8)}.md`;
  const notePath = path.join(prepared.workspace.progressRoot, ...(project?.directory ? [project.directory, noteName] : [noteName]));
  const noteLink = prepared.extension === ".pdf"
    ? `[Open uploaded PDF](papers/${prepared.filename})`
    : `![${cleanTitle.replace(/[\[\]]/g, "") || "Uploaded evidence image"}](papers/${prepared.filename})`;
  const yamlTitle = JSON.stringify(`Evidence: ${cleanTitle}`);
  const lines = [
    "---", `id: ${id}`, `title: ${yamlTitle}`,
    `summary: ${JSON.stringify(`Uploaded ${prepared.extension.slice(1).toUpperCase()} evidence artifact: ${cleanTitle}.`)}`,
    "type: evidence", "status: complete",
    ...(!project?.directory && projectId !== "default" ? [`research: ${projectId}`] : []),
    "---", "",
    `# Evidence: ${cleanTitle}`, "", noteLink,
  ];
  if (cleanComment) lines.push("", "## Research note", "", cleanComment);
  lines.push("");

  try {
    await fs.writeFile(notePath, lines.join("\n"), { encoding: "utf8", flag: "wx" });
    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const noteRelativePath = path.posix.join(project?.directory ?? "", noteName);
    const introduced = compiled.diagnostics.filter((item) => item.severity === "error" && item.file === noteRelativePath);
    if (introduced.length) throw new Error("Evidence failed workspace validation: " + introduced.map((item) => item.message).join(" "));
    return { slug: id, filename: noteRelativePath, assetPath: prepared.relativePath, bytes: prepared.bytes };
  } catch (error) {
    await Promise.all([fs.rm(notePath, { force: true }), fs.rm(prepared.absolutePath, { force: true })]);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
