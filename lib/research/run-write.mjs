import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace } from "./compiler.mjs";
import { IMPORT_LIMITS, validateRunId } from "./experiments.mjs";

const RUN_STATUS = new Set(["complete", "running", "failed", "cancelled"]);
const FILE_NAME = /^[^\\/:*?"<>|\x00-\x1f]+$/;
const RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function fail(message) { throw new Error(message); }
function contained(root, target) { return target === root || target.startsWith(root + path.sep); }

async function assertNoSymlink(root, target) {
  if (!contained(root, target)) fail("Experiment data path escapes the research root.");
  const relative = path.relative(root, target), parts = relative ? relative.split(path.sep) : [];
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try { const stat = await fs.lstat(current); if (stat.isSymbolicLink()) fail("Experiment data paths cannot include symlinks."); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
}

function projectRootFor(workspace, entry) {
  const project = workspace.projects.find((item) => item.id === entry.research);
  return project?.directory ? path.join(workspace.progressRoot, project.directory) : workspace.progressRoot;
}

function validateMetrics(metrics, plan, importedFilename) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) fail("Metrics must be an object keyed by canonical metric IDs.");
  const definitions = new Map((plan?.metrics ?? []).map((metric) => [metric.id, metric]));
  for (const [id, measurement] of Object.entries(metrics)) {
    const definition = definitions.get(id);
    if (!definition) fail(`Unknown metric ID: ${id}`);
    if (!measurement || typeof measurement.value !== "number" || !Number.isFinite(measurement.value)) fail(`Metric ${id} must contain a finite numeric value.`);
    const source = measurement.source;
    if (!source || typeof source !== "object") fail(`Metric ${id} needs provenance.`);
    if (source.kind === "manual") { if (typeof source.note !== "string" || !source.note.trim()) fail(`Manual metric ${id} needs a provenance note.`); }
    else if (source.file) {
      if (typeof source.column !== "string" || !source.column || typeof source.aggregation !== "string" || !source.aggregation) fail(`Metric ${id} file provenance must include column and aggregation.`);
      if (importedFilename && source.file !== importedFilename) fail(`Metric ${id} must reference the preserved uploaded file.`);
    } else fail(`Metric ${id} provenance must be manual or identify an imported data file.`);
  }
}

export async function createExperimentRun({ rootDir = process.cwd(), projectId, experimentId, runId, label, status = "complete", parameters = {}, metrics = {}, notes, upload }) {
  const safeId = validateRunId(runId);
  if (!safeId) fail("Run ID must contain only portable lowercase letters, numbers, and hyphens.");
  if (!RUN_STATUS.has(status)) fail("Run status is invalid.");
  const workspace = await compileResearchWorkspace({ rootDir, fresh: true });
  const experiment = workspace.entries.find((entry) => entry.id === experimentId && entry.type === "experiment" && entry.research === projectId);
  if (!experiment?.experimentSpec) fail("Choose a structured experiment in this project.");
  const plan = workspace.entries.find((entry) => entry.id === experiment.experimentSpec.evaluationPlan && entry.type === "evaluation" && entry.research === projectId)?.evaluationPlan;
  if (!plan) fail("The experiment evaluation plan is unavailable.");
  const filename = upload?.filename;
  const bytes = upload?.bytes;
  if (upload && (!Buffer.isBuffer(bytes) || bytes.length > IMPORT_LIMITS.bytes || !FILE_NAME.test(filename) || filename === "." || filename === ".." || filename.length > 120 || /[. ]$/.test(filename) || RESERVED_FILE_NAME.test(filename))) fail("Uploaded data file name or size is invalid for portable project storage.");
  validateMetrics(metrics, plan, filename);
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) fail("Run parameters must be a JSON object.");
  if (notes !== undefined && typeof notes !== "string") fail("Run notes must be text.");

  const projectRoot = projectRootFor(workspace, experiment);
  const experimentsRoot = path.join(projectRoot, "experiments");
  const experimentRoot = path.join(experimentsRoot, experimentId);
  const runsRoot = path.join(experimentRoot, "runs");
  const runRoot = path.join(runsRoot, safeId);
  await assertNoSymlink(workspace.progressRoot, runRoot);
  await fs.mkdir(runsRoot, { recursive: true });
  await assertNoSymlink(workspace.progressRoot, runRoot);
  try { await fs.lstat(runRoot); fail(`Run "${safeId}" already exists; choose a new run ID.`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }

  const staging = path.join(runsRoot, `.observaire-run-stage-${crypto.randomUUID()}`);
  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    id: safeId,
    experimentId,
    label: String(label || safeId).slice(0, 160),
    status,
    timestamps: { createdAt: now, ...(status === "complete" || status === "failed" || status === "cancelled" ? { finishedAt: now } : {}) },
    parameters,
    metrics,
    dataFiles: filename ? [filename] : [],
    artifacts: [],
    ...(notes?.trim() ? { notes: notes.trim() } : {}),
  };
  let promoted = false;
  try {
    await fs.mkdir(staging, { recursive: false });
    if (upload) await fs.writeFile(path.join(staging, filename), bytes, { flag: "wx" });
    await fs.writeFile(path.join(staging, ".observaire-run.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    await fs.rename(staging, runRoot);
    promoted = true;
    const checked = await compileResearchWorkspace({ rootDir, fresh: true });
    const relatedErrors = checked.diagnostics.filter((item) => item.severity === "error" && item.file?.includes(`/runs/${safeId}/`));
    if (relatedErrors.length) fail(`Run failed validation: ${relatedErrors.map((item) => item.message).join(" ")}`);
    return { run: manifest, project: projectId, experimentId, manifestPath: path.relative(workspace.progressRoot, path.join(runRoot, ".observaire-run.json")).split(path.sep).join("/") };
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    if (promoted) await fs.rm(runRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function createExperimentRuns(options, runs) {
  if (!Array.isArray(runs) || !runs.length || runs.length > 1000) fail("Choose between 1 and 1000 imported runs.");
  const ids = runs.map((run) => validateRunId(run.runId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) fail("Imported run identifiers must be valid and unique.");
  const created = [];
  try {
    for (const run of runs) created.push(await createExperimentRun({ ...options, ...run }));
    return created;
  } catch (error) {
    const workspace = await compileResearchWorkspace({ rootDir: options.rootDir ?? process.cwd(), fresh: true });
    const experiment = workspace.entries.find((entry) => entry.id === options.experimentId && entry.type === "experiment");
    if (experiment) {
      const runRoot = path.join(projectRootFor(workspace, experiment), "experiments", options.experimentId, "runs");
      for (const item of created) await fs.rm(path.join(runRoot, item.run.id), { recursive: true, force: true });
    }
    throw error;
  }
}
