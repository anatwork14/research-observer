import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const PROJECT_MANIFEST = ".observaire-project.json";
export const PROJECT_IMPORT_PREFIX = ".observaire-import-";
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORDERED_NOTE = /^\d+_.*\.md$/i;

export function projectIdFromFolder(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[đĐ]/g, (letter) => letter === "Đ" ? "D" : "d")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (normalized && ID.test(normalized)) return normalized;
  const suffix = crypto.createHash("sha256").update(raw || "project", "utf8").digest("hex").slice(0, 8);
  return `project-${suffix}`;
}

export function projectLabelFromFolder(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Untitled project";
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function projectDirectoryForFile(relativePath) {
  const normalized = String(relativePath ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : undefined;
}

function validManifest(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    typeof value.id === "string" && ID.test(value.id) &&
    typeof value.label === "string" && Boolean(value.label.trim()) &&
    (value.description === undefined || typeof value.description === "string");
}

export async function discoverProjectFolders({ progressRoot, files = [] } = {}) {
  const directories = [...new Set(files
    .filter((file) => ORDERED_NOTE.test(path.posix.basename(String(file.rel ?? ""))))
    .map((file) => projectDirectoryForFile(file.rel))
    .filter((directory) => directory && !directory.startsWith(".")))]
    .sort((a, b) => a.localeCompare(b));
  const projects = [];
  const byDirectory = new Map();
  const issues = [];
  const seenIds = new Map();

  for (const directory of directories) {
    let project = {
      id: projectIdFromFolder(directory),
      label: projectLabelFromFolder(directory),
      description: `Auto-indexed from the ${directory} research folder.`,
      directory,
      source: "folder",
    };
    const manifestPath = path.join(progressRoot, directory, PROJECT_MANIFEST);
    try {
      const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      if (!validManifest(parsed)) {
        issues.push({
          severity: "error",
          code: "project-manifest-invalid",
          message: `${PROJECT_MANIFEST} must contain { id, label, description? } with a lowercase kebab-case id.`,
          file: `${directory}/${PROJECT_MANIFEST}`,
        });
      } else {
        project = {
          id: parsed.id,
          label: parsed.label.trim(),
          ...(parsed.description?.trim() ? { description: parsed.description.trim() } : {}),
          directory,
          source: "folder",
        };
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        issues.push({
          severity: "error",
          code: "project-manifest-invalid",
          message: `Could not parse ${PROJECT_MANIFEST}.`,
          file: `${directory}/${PROJECT_MANIFEST}`,
        });
      }
    }

    const previousDirectory = seenIds.get(project.id);
    if (previousDirectory && previousDirectory !== directory) {
      issues.push({
        severity: "error",
        code: "project-folder-id-collision",
        message: `Project folders "${previousDirectory}" and "${directory}" resolve to the same project id "${project.id}". Add distinct ${PROJECT_MANIFEST} ids or rename one folder.`,
        file: directory,
      });
    } else {
      seenIds.set(project.id, directory);
    }
    projects.push(project);
    byDirectory.set(directory, project);
  }

  return { projects, byDirectory, issues };
}

export function projectManifest(project) {
  return JSON.stringify({
    schemaVersion: 1,
    id: project.id,
    label: project.label,
    ...(project.description ? { description: project.description } : {}),
  }, null, 2) + "\n";
}
