import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace } from "./compiler.mjs";

const SCHEMA_VERSION = 1;
const ANNOTATION_TYPES = new Set([
  "highlight",
  "comment",
  "evidence",
  "claim",
  "question",
  "limitation",
  "method",
  "definition",
  "important",
]);
const MAX_COMMENT_BYTES = 32_000;
const MAX_QUOTE_BYTES = 64_000;
const MAX_TAGS = 32;
const MAX_RECTS = 256;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cleanString(value, max = 500) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function safeRelativePath(value) {
  const raw = String(value ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!raw) throw new Error("A PDF path is required.");
  const normalized = path.posix.normalize(raw);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
  ) {
    throw new Error("PDF path must stay inside the research workspace.");
  }
  return normalized;
}

function safeConfiguredDir(root, value, fallback) {
  const configured = typeof value === "string" && value.trim() ? value.trim() : fallback;
  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) {
    throw new Error(`${fallback} directory must stay inside the repository.`);
  }
  return resolved;
}

function projectForPaper(workspace, paperPath) {
  const matches = workspace.projects
    .filter((project) => project.directory && (paperPath === project.directory || paperPath.startsWith(`${project.directory}/`)))
    .sort((a, b) => (b.directory?.length ?? 0) - (a.directory?.length ?? 0));
  return matches[0] ?? workspace.projects.find((project) => project.id === "default") ?? workspace.projects[0];
}

async function resolvePaper(rootDir, paperPath) {
  const root = path.resolve(rootDir);
  const cleanPath = safeRelativePath(paperPath);
  if (path.posix.extname(cleanPath).toLowerCase() !== ".pdf") throw new Error("Annotations can only target PDF files.");
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const asset = workspace.assets.find((item) => item.path === cleanPath && item.extension === ".pdf");
  if (!asset) {
    const error = new Error("PDF does not exist in the research workspace.");
    error.code = "ANNOTATION_PDF_NOT_FOUND";
    throw error;
  }
  const project = projectForPaper(workspace, cleanPath);
  const annotationRoot = safeConfiguredDir(root, workspace.config.annotationDir, "annotations");
  const projectId = project?.id ?? "default";
  const stateDir = path.join(annotationRoot, projectId);
  const key = sha256(cleanPath).slice(0, 32);
  const statePath = path.join(stateDir, `${key}.json`);
  const pdfPath = path.join(workspace.progressRoot, ...cleanPath.split("/"));
  return { root, workspace, asset, projectId, cleanPath, stateDir, statePath, pdfPath };
}

function emptyState({ cleanPath, projectId, asset }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    paper: { path: cleanPath, project: projectId, size: asset.size },
    updatedAt: null,
    annotations: [],
  };
}

async function readState(resolved) {
  try {
    const raw = await fs.readFile(resolved.statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.annotations)) {
      throw new Error("Annotation sidecar uses an unsupported schema.");
    }
    if (parsed.paper?.path !== resolved.cleanPath) throw new Error("Annotation sidecar is bound to a different PDF.");
    return {
      ...parsed,
      revision: Number.isInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return emptyState(resolved);
    throw error;
  }
}

async function writeState(resolved, state) {
  await fs.mkdir(resolved.stateDir, { recursive: true });
  const next = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  const temporary = `${resolved.statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  await fs.rename(temporary, resolved.statePath);
  return next;
}

async function acquireLock(lockPath) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${process.pid} ${Date.now()}\n`, "utf8");
      return async () => {
        await handle.close().catch(() => null);
        await fs.rm(lockPath, { force: true }).catch(() => null);
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > 15_000) await fs.rm(lockPath, { force: true });
      } catch {
        // Another writer may have released the lock between stat and retry.
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("Annotation store is busy. Retry the edit.");
}

function cleanType(value) {
  const type = cleanString(value, 32).toLowerCase();
  if (!ANNOTATION_TYPES.has(type)) throw new Error("Choose a supported annotation type.");
  return type;
}

function cleanTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Annotation tags must be a list.");
  return [...new Set(value.map((tag) => cleanString(tag, 80)).filter(Boolean))].slice(0, MAX_TAGS);
}

function cleanQuote(value) {
  const quote = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const exact = cleanString(quote.exact, MAX_QUOTE_BYTES);
  const prefix = cleanString(quote.prefix, 512);
  const suffix = cleanString(quote.suffix, 512);
  return { exact, ...(prefix ? { prefix } : {}), ...(suffix ? { suffix } : {}) };
}

function cleanRects(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RECTS) {
    throw new Error("Annotation requires one or more bounded PDF rectangles.");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Annotation rectangle is invalid.");
    const x = Number(item.x);
    const y = Number(item.y);
    const width = Number(item.width);
    const height = Number(item.height);
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.002 || y + height > 1.002) {
      throw new Error("Annotation rectangles must use normalized page coordinates between 0 and 1.");
    }
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      width: Math.max(0.0001, Math.min(1, width)),
      height: Math.max(0.0001, Math.min(1, height)),
    };
  });
}

function cleanColor(value) {
  const color = cleanString(value, 20);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "#f4c95d";
}

function cleanComment(value) {
  const comment = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (Buffer.byteLength(comment, "utf8") > MAX_COMMENT_BYTES) throw new Error("Annotation comment is too large.");
  return comment;
}

function revisionCheck(state, expectedRevision) {
  if (expectedRevision === undefined || expectedRevision === null || expectedRevision === "") return;
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected) || expected !== state.revision) {
    const error = new Error("Annotations changed after this PDF was opened. Reload annotations and retry.");
    error.code = "ANNOTATION_STALE";
    error.revision = state.revision;
    throw error;
  }
}

function publicState(state, includeDeleted) {
  const annotations = state.annotations.filter((annotation) => includeDeleted || !annotation.deletedAt);
  return {
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    paper: state.paper,
    updatedAt: state.updatedAt,
    annotations,
    hiddenCount: state.annotations.filter((annotation) => Boolean(annotation.deletedAt)).length,
  };
}

export async function listPdfAnnotations({ rootDir = process.cwd(), paperPath, includeDeleted = false } = {}) {
  const resolved = await resolvePaper(rootDir, paperPath);
  const state = await readState(resolved);
  return { ...publicState(state, includeDeleted), project: resolved.projectId };
}

export async function createPdfAnnotation({ rootDir = process.cwd(), paperPath, expectedRevision, annotation } = {}) {
  const resolved = await resolvePaper(rootDir, paperPath);
  const release = await acquireLock(`${resolved.statePath}.lock`);
  try {
    const state = await readState(resolved);
    revisionCheck(state, expectedRevision);
    const now = new Date().toISOString();
    const page = Number(annotation?.page);
    if (!Number.isInteger(page) || page < 1) throw new Error("Annotation page must be a positive integer.");
    const type = cleanType(annotation?.type ?? "highlight");
    const comment = cleanComment(annotation?.comment);
    if (type === "comment" && !comment) throw new Error("Comment annotations need text.");
    const nextAnnotation = {
      id: `ann-${crypto.randomUUID()}`,
      type,
      page,
      quote: cleanQuote(annotation?.quote),
      rects: cleanRects(annotation?.rects),
      comment,
      tags: cleanTags(annotation?.tags),
      color: cleanColor(annotation?.color),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const next = await writeState(resolved, {
      ...state,
      revision: state.revision + 1,
      annotations: [...state.annotations, nextAnnotation],
    });
    return { ...publicState(next, true), annotation: nextAnnotation, project: resolved.projectId };
  } finally {
    await release();
  }
}

export async function updatePdfAnnotation({ rootDir = process.cwd(), paperPath, id, expectedRevision, patch: annotationPatch } = {}) {
  const resolved = await resolvePaper(rootDir, paperPath);
  const release = await acquireLock(`${resolved.statePath}.lock`);
  try {
    const state = await readState(resolved);
    revisionCheck(state, expectedRevision);
    const index = state.annotations.findIndex((annotation) => annotation.id === id);
    if (index < 0) {
      const error = new Error("Annotation does not exist.");
      error.code = "ANNOTATION_NOT_FOUND";
      throw error;
    }
    const current = state.annotations[index];
    if (current.deletedAt) throw new Error("Restore the annotation before editing it.");
    const nextAnnotation = {
      ...current,
      ...(annotationPatch?.type !== undefined ? { type: cleanType(annotationPatch.type) } : {}),
      ...(annotationPatch?.comment !== undefined ? { comment: cleanComment(annotationPatch.comment) } : {}),
      ...(annotationPatch?.tags !== undefined ? { tags: cleanTags(annotationPatch.tags) } : {}),
      ...(annotationPatch?.color !== undefined ? { color: cleanColor(annotationPatch.color) } : {}),
      updatedAt: new Date().toISOString(),
    };
    const annotations = [...state.annotations];
    annotations[index] = nextAnnotation;
    const next = await writeState(resolved, { ...state, revision: state.revision + 1, annotations });
    return { ...publicState(next, true), annotation: nextAnnotation, project: resolved.projectId };
  } finally {
    await release();
  }
}

async function setDeleted({ rootDir, paperPath, id, expectedRevision, deleted }) {
  const resolved = await resolvePaper(rootDir, paperPath);
  const release = await acquireLock(`${resolved.statePath}.lock`);
  try {
    const state = await readState(resolved);
    revisionCheck(state, expectedRevision);
    const index = state.annotations.findIndex((annotation) => annotation.id === id);
    if (index < 0) {
      const error = new Error("Annotation does not exist.");
      error.code = "ANNOTATION_NOT_FOUND";
      throw error;
    }
    const current = state.annotations[index];
    const nextAnnotation = {
      ...current,
      deletedAt: deleted ? current.deletedAt ?? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    const annotations = [...state.annotations];
    annotations[index] = nextAnnotation;
    const next = await writeState(resolved, { ...state, revision: state.revision + 1, annotations });
    return { ...publicState(next, true), annotation: nextAnnotation, project: resolved.projectId };
  } finally {
    await release();
  }
}

export function softDeletePdfAnnotation(options = {}) {
  return setDeleted({ ...options, deleted: true });
}

export function restorePdfAnnotation(options = {}) {
  return setDeleted({ ...options, deleted: false });
}

export const pdfAnnotationTypes = [...ANNOTATION_TYPES];
