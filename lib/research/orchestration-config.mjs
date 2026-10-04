import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";
import { buildResearchOrchestration } from "./orchestration.mjs";

const CONFIG_FILE = "research-observer.config.json";
const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(["queued", "active", "blocked", "done"]);
const MAX_DEPENDENCIES = 100;
const MAX_NEXT_LENGTH = 800;
const MAX_NOTE_LENGTH = 1600;

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function configError(message, code = "ORCHESTRATION_CONFIG_INVALID") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cleanText(value, field, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw configError(`${field} must be text.`);
  const result = value.trim();
  if (result.length > maxLength) throw configError(`${field} is too long.`);
  return result;
}

function cleanDraft(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw configError("Orchestration must be an object or null to return a project to Untracked.");
  }

  const status = typeof value.status === "string" ? value.status.trim() : "";
  if (!STATUSES.has(status)) {
    throw configError("Status must be queued, active, blocked, or done.", "ORCHESTRATION_STATUS_INVALID");
  }
  if (value.dependsOn !== undefined && (!Array.isArray(value.dependsOn) || value.dependsOn.some((item) => typeof item !== "string"))) {
    throw configError("dependsOn must be a list of project IDs.", "ORCHESTRATION_DEPENDENCIES_INVALID");
  }
  const dependsOn = [...new Set((value.dependsOn ?? []).map((item) => item.trim()).filter(Boolean))];
  if (dependsOn.length > MAX_DEPENDENCIES) throw configError(`dependsOn is limited to ${MAX_DEPENDENCIES} projects.`);
  for (const dependency of dependsOn) {
    if (!PROJECT_ID.test(dependency)) throw configError(`Invalid dependency project ID “${dependency}”.`, "ORCHESTRATION_DEPENDENCY_ID_INVALID");
  }

  const next = cleanText(value.next, "Next step", MAX_NEXT_LENGTH);
  const note = cleanText(value.note, "Coordination note", MAX_NOTE_LENGTH);
  return {
    status,
    dependsOn,
    ...(next ? { next } : {}),
    ...(note ? { note } : {}),
  };
}

function normalizeStoredOrchestration(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    status: typeof value.status === "string" ? value.status : "",
    dependsOn: Array.isArray(value.dependsOn) ? value.dependsOn.filter((item) => typeof item === "string") : [],
    next: typeof value.next === "string" ? value.next : "",
    note: typeof value.note === "string" ? value.note : "",
  };
}

async function readConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    raw = "{}\n";
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw configError(`${CONFIG_FILE} is not valid JSON. Fix it on disk before using the orchestration editor.`, "ORCHESTRATION_CONFIG_PARSE");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw configError(`${CONFIG_FILE} must contain a JSON object.`, "ORCHESTRATION_CONFIG_PARSE");
  }
  return { file, raw, parsed, sha256: sha256(raw) };
}

function rawProjects(config) {
  if (config.researchProjects === undefined) return [];
  if (!Array.isArray(config.researchProjects)) throw configError("researchProjects must be a JSON array before orchestration can be edited.");
  return config.researchProjects;
}

function mutateConfig({ parsed, workspace, projectId, orchestration }) {
  const project = workspace.projects.find((item) => item.id === projectId);
  if (!project) throw configError("Research project does not exist.", "ORCHESTRATION_PROJECT_MISSING");
  const projects = rawProjects(parsed).map((item) => (
    item && typeof item === "object" && !Array.isArray(item) ? { ...item } : item
  ));
  const index = projects.findIndex((item) => item && typeof item === "object" && !Array.isArray(item) && item.id === projectId);

  if (index >= 0) {
    const current = projects[index];
    if (orchestration === null) delete current.orchestration;
    else current.orchestration = orchestration;
  } else if (orchestration !== null) {
    projects.push({
      id: project.id,
      label: project.label,
      ...(project.description ? { description: project.description } : {}),
      orchestration,
    });
  }

  return { ...parsed, researchProjects: projects };
}

function effectiveWorkspace(workspace, nextConfig) {
  const authored = new Map(
    rawProjects(nextConfig)
      .filter((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
  const effective = workspace.config.researchProjects.map((project) => {
    const override = authored.get(project.id);
    return override ? { ...project, ...override } : { ...project, orchestration: undefined };
  });
  for (const item of authored.values()) {
    if (!effective.some((project) => project.id === item.id)) effective.push({ ...item });
  }
  return {
    ...workspace,
    config: { ...workspace.config, researchProjects: effective },
  };
}

function changesFor(before, after) {
  const fields = ["status", "dependsOn", "next", "note"];
  const normalizedBefore = before ?? { status: "untracked", dependsOn: [], next: "", note: "" };
  const normalizedAfter = after ?? { status: "untracked", dependsOn: [], next: "", note: "" };
  return fields.flatMap((field) => {
    const left = field === "dependsOn" ? [...(normalizedBefore[field] ?? [])] : normalizedBefore[field] ?? "";
    const right = field === "dependsOn" ? [...(normalizedAfter[field] ?? [])] : normalizedAfter[field] ?? "";
    if (JSON.stringify(left) === JSON.stringify(right)) return [];
    return [{ field, before: left, after: right }];
  });
}

function previewFrom({ workspace, currentConfig, projectId, orchestration }) {
  const nextConfig = mutateConfig({ parsed: currentConfig, workspace, projectId, orchestration });
  const nextWorkspace = effectiveWorkspace(workspace, nextConfig);
  const model = buildResearchOrchestration(nextWorkspace);
  const project = model.projects.find((item) => item.id === projectId);
  const currentProjectConfig = rawProjects(currentConfig).find((item) => item && typeof item === "object" && !Array.isArray(item) && item.id === projectId);
  const before = normalizeStoredOrchestration(currentProjectConfig?.orchestration);
  const issues = model.issues;
  return {
    valid: issues.length === 0,
    issues,
    changes: changesFor(before, orchestration),
    orchestration,
    project: project ? {
      id: project.id,
      label: project.label,
      status: project.orchestrationStatus,
      dependencyState: project.dependencyState,
      waitingOn: project.waitingOn.map((item) => ({ id: item.id, label: item.label, status: item.status })),
      dependencies: project.dependencies.map((item) => ({ id: item.id, label: item.label, status: item.status, done: item.done })),
    } : null,
    nextConfig,
  };
}

async function atomicWrite(file, content) {
  const directory = path.dirname(file);
  const temp = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, content, { encoding: "utf8", flag: "wx" });
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => null);
    throw error;
  }
}

export function orchestrationConfigWritable() {
  if (process.env.RESEARCH_OBSERVER_WRITES === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function orchestrationConfigReason() {
  return orchestrationConfigWritable()
    ? "Local orchestration editing is enabled with preview, validation, and stale-write protection."
    : "Orchestration editing is read-only in production unless RESEARCH_OBSERVER_WRITES=1 is explicitly configured.";
}

export async function readOrchestrationEditorState({ rootDir = process.cwd() } = {}) {
  const root = path.resolve(rootDir);
  const [config, workspace] = await Promise.all([
    readConfig(root),
    compileResearchWorkspace({ rootDir: root, fresh: true }),
  ]);
  const configured = new Map(
    rawProjects(config.parsed)
      .filter((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
  return {
    enabled: orchestrationConfigWritable(),
    reason: orchestrationConfigReason(),
    baseSha256: config.sha256,
    projects: workspace.projects.map((project) => {
      const authored = configured.get(project.id);
      return {
        id: project.id,
        label: project.label,
        description: project.description ?? "",
        notes: project.notes,
        autoIndexed: Boolean(project.autoIndexed),
        configured: Boolean(authored),
        orchestration: normalizeStoredOrchestration(authored?.orchestration),
      };
    }),
  };
}

export async function previewOrchestrationConfig({ rootDir = process.cwd(), projectId, orchestration, baseSha256 } = {}) {
  const root = path.resolve(rootDir);
  const cleanProjectId = String(projectId ?? "").trim();
  if (!PROJECT_ID.test(cleanProjectId)) throw configError("A valid research project ID is required.");
  const draft = cleanDraft(orchestration);
  const [config, workspace] = await Promise.all([
    readConfig(root),
    compileResearchWorkspace({ rootDir: root, fresh: true }),
  ]);
  if (!baseSha256 || config.sha256 !== String(baseSha256)) {
    throw configError("The orchestration config changed after this editor was opened. Reload current values before previewing.", "ORCHESTRATION_CONFIG_STALE");
  }
  const preview = previewFrom({ workspace, currentConfig: config.parsed, projectId: cleanProjectId, orchestration: draft });
  if (!preview.changes.length) throw configError("There are no orchestration changes to preview.", "ORCHESTRATION_CONFIG_NO_CHANGES");
  const { nextConfig: _nextConfig, ...safePreview } = preview;
  return { baseSha256: config.sha256, preview: safePreview };
}

export async function saveOrchestrationConfig({ rootDir = process.cwd(), projectId, orchestration, baseSha256 } = {}) {
  if (!orchestrationConfigWritable()) throw configError(orchestrationConfigReason(), "ORCHESTRATION_CONFIG_DISABLED");
  const root = path.resolve(rootDir);
  const cleanProjectId = String(projectId ?? "").trim();
  if (!PROJECT_ID.test(cleanProjectId)) throw configError("A valid research project ID is required.");
  const draft = cleanDraft(orchestration);
  const config = await readConfig(root);
  if (!baseSha256 || config.sha256 !== String(baseSha256)) {
    throw configError("The orchestration config changed after review. Reload current values before saving.", "ORCHESTRATION_CONFIG_STALE");
  }
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const preview = previewFrom({ workspace, currentConfig: config.parsed, projectId: cleanProjectId, orchestration: draft });
  if (!preview.changes.length) throw configError("There are no orchestration changes to save.", "ORCHESTRATION_CONFIG_NO_CHANGES");
  if (!preview.valid) {
    const error = configError("Orchestration changes contain dependency or configuration errors.", "ORCHESTRATION_CONFIG_VALIDATION");
    error.issues = preview.issues;
    throw error;
  }

  const nextRaw = JSON.stringify(preview.nextConfig, null, 2) + "\n";
  await atomicWrite(config.file, nextRaw);
  try {
    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const errors = compiled.diagnostics.filter((item) => item.severity === "error");
    if (errors.length) {
      const error = configError("The updated workspace failed compiler validation.", "ORCHESTRATION_CONFIG_COMPILER");
      error.issues = errors.slice(0, 20);
      throw error;
    }
  } catch (error) {
    await atomicWrite(config.file, config.raw).catch(() => null);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }

  const updatedRaw = await fs.readFile(config.file, "utf8");
  const { nextConfig: _nextConfig, ...safePreview } = preview;
  return {
    saved: true,
    baseSha256: sha256(updatedRaw),
    preview: safePreview,
  };
}
