import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";
import {
  PROJECT_IMPORT_PREFIX,
  PROJECT_MANIFEST,
  projectIdFromFolder,
  projectLabelFromFolder,
  projectManifest,
} from "./project-folders.mjs";

const ORDERED_NOTE = /^\d+_.*\.md$/i;
const JUNK_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function importError(message, code = "PROJECT_IMPORT_INVALID") {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function projectImportWritable() {
  if (process.env.RESEARCH_OBSERVER_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function projectImportReason() {
  return projectImportWritable()
    ? "Research project folder import is enabled. Files are written to the workspace progress directory."
    : "Project import is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.";
}

function safeDirectoryName(value) {
  const name = String(value ?? "").trim();
  if (!name || name === "." || name === "..") throw importError("A project folder name is required.");
  if (name.length > 120) throw importError("Project folder name is too long.");
  if (/[\x00-\x1f<>:"/\\|?*]/.test(name)) throw importError("Project folder name contains characters that are not portable across host filesystems.");
  if (/[. ]$/.test(name)) throw importError("Project folder name cannot end with a dot or space.");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) throw importError("Project folder name is reserved by Windows filesystems.");
  return name;
}

function safeRelativePath(value, projectName) {
  const raw = String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length > 1 && parts[0] !== projectName) {
    throw importError("All imported files must come from the selected project folder.");
  }
  if (parts[0] === projectName) parts.shift();
  if (!parts.length) throw importError("Imported files must live inside the selected project folder.");
  for (const segment of parts) {
    if (segment === "." || segment === "..") throw importError("Project files cannot escape the selected folder.");
    if (segment.length > 180 || /[\x00-\x1f]/.test(segment)) throw importError("A project file path contains an unsupported segment.");
  }
  const normalized = path.posix.normalize(parts.join("/"));
  if (!normalized || normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw importError("Project files cannot escape the selected folder.");
  }
  return normalized;
}

function allowedExtension(workspace, relativePath) {
  const basename = path.posix.basename(relativePath);
  if (basename === PROJECT_MANIFEST) return true;
  const extension = path.posix.extname(relativePath).toLowerCase();
  return extension === ".md" || workspace.config.allowedMediaExtensions.includes(extension);
}

function byteLength(file) {
  if (Buffer.isBuffer(file.data)) return file.data.byteLength;
  if (file.data instanceof Uint8Array) return file.data.byteLength;
  return Buffer.byteLength(String(file.data ?? ""), "utf8");
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value ?? ""), "utf8");
}

export async function importResearchProject({ rootDir = process.cwd(), projectName, files = [] } = {}) {
  if (!projectImportWritable()) throw importError("Research project import is disabled in this environment.", "PROJECT_IMPORT_DISABLED");
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const directory = safeDirectoryName(projectName);
  if (!Array.isArray(files) || !files.length) throw importError("Choose a project folder containing numbered Markdown files.");
  if (files.length > MAX_FILES) throw importError(`Project import is limited to ${MAX_FILES} files per folder.`);

  const prepared = [];
  let totalBytes = 0;
  for (const file of files) {
    const originalPath = String(file?.relativePath ?? file?.name ?? "");
    const basename = path.posix.basename(originalPath.replace(/\\/g, "/"));
    if (JUNK_FILES.has(basename)) continue;
    const relativePath = safeRelativePath(originalPath, directory);
    if (!allowedExtension(workspace, relativePath)) {
      throw importError(`Unsupported project file type: ${relativePath}`);
    }
    const size = byteLength(file);
    if (size > MAX_FILE_BYTES) throw importError(`Project file is too large for browser import: ${relativePath}`);
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) throw importError("Project folder is too large for browser import. Copy large assets directly into the mounted host folder instead.");
    prepared.push({ relativePath, data: asBuffer(file.data) });
  }
  if (!prepared.length) throw importError("The selected folder did not contain importable research files.");
  if (!prepared.some((file) => ORDERED_NOTE.test(path.posix.basename(file.relativePath)))) {
    throw importError("A research project folder must contain at least one numbered Markdown file such as 00_question.md.");
  }

  const finalDirectory = path.join(workspace.progressRoot, directory);
  try {
    const stat = await fs.stat(finalDirectory);
    if (stat) throw importError(`A project folder named "${directory}" already exists. Rename the folder or update it directly on disk.`, "PROJECT_IMPORT_EXISTS");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const stagingRoot = path.join(workspace.progressRoot, `${PROJECT_IMPORT_PREFIX}${crypto.randomUUID()}`);
  const stagingProject = path.join(stagingRoot, directory);
  await fs.mkdir(stagingProject, { recursive: true });
  let promoted = false;

  try {
    for (const file of prepared) {
      const destination = path.join(stagingProject, ...file.relativePath.split("/"));
      const relativeCheck = path.relative(stagingProject, destination);
      if (!relativeCheck || relativeCheck.startsWith("..") || path.isAbsolute(relativeCheck)) {
        throw importError("Project file path escaped the staging directory.");
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, file.data, { flag: "wx" });
    }

    const manifestPath = path.join(stagingProject, PROJECT_MANIFEST);
    try {
      await fs.access(manifestPath);
    } catch {
      await fs.writeFile(manifestPath, projectManifest({
        id: projectIdFromFolder(directory),
        label: projectLabelFromFolder(directory),
        description: `Imported from the ${directory} folder and auto-indexed by Observaire.`,
      }), "utf8");
    }

    await fs.rename(stagingProject, finalDirectory);
    promoted = true;
    await fs.rm(stagingRoot, { recursive: true, force: true });

    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const prefix = `${directory}/`;
    const errors = compiled.diagnostics.filter((item) => item.severity === "error" && item.file && (item.file === directory || item.file.startsWith(prefix)));
    if (errors.length) {
      throw importError("Imported project failed validation: " + errors.slice(0, 5).map((item) => item.message).join(" "), "PROJECT_IMPORT_VALIDATION");
    }
    const project = compiled.projects.find((item) => item.directory === directory) ?? compiled.projects.find((item) => item.id === projectIdFromFolder(directory));
    if (!project || !project.notes) throw importError("Imported folder did not produce any indexed research notes.", "PROJECT_IMPORT_EMPTY");

    return {
      imported: true,
      directory,
      project,
      files: prepared.length,
      bytes: totalBytes,
      storagePath: path.posix.join(compiled.config.progressDir || "progress", directory),
    };
  } catch (error) {
    if (promoted) await fs.rm(finalDirectory, { recursive: true, force: true }).catch(() => null);
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => null);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
