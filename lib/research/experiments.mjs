import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
export { compareRuns, detectConfounding, recommendVisualizations, resolveMetricColumn } from "./experiments-shared.mjs";

export const RUN_MANIFEST = ".observaire-run.json";
export const RUN_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const IMPORT_LIMITS = Object.freeze({ bytes: 25 * 1024 * 1024, rows: 100_000, columns: 256, jsonDepth: 32 });
const DIRECTIONS = new Set(["maximize", "minimize", "target"]);
const ROLES = new Set(["primary", "secondary", "guardrail", "diagnostic"]);
const AGGREGATIONS = new Set(["mean", "median", "sum", "min", "max", "count", "last", "first", "none"]);
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function validateRunId(id) {
  return typeof id === "string" && RUN_ID.test(id) && !id.includes("..") && !WINDOWS_RESERVED.test(id) ? id : null;
}

export function normalizeMetric(metric) {
  return metric && typeof metric === "object" && !Array.isArray(metric) ? {
    id: metric.id,
    label: metric.label,
    role: metric.role,
    direction: metric.direction,
    unit: metric.unit,
    aggregation: metric.aggregation,
    display: metric.display,
    aliases: Array.isArray(metric.aliases) ? metric.aliases : [],
    ...(metric.threshold !== undefined ? { threshold: metric.threshold } : {}),
    ...(typeof metric.description === "string" ? { description: metric.description } : {}),
  } : null;
}

export function validateEvaluationPlan(plan, file, diagnostics) {
  const report = (code, message) => diagnostics.push({ severity: "error", code, message, file });
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) { report("evaluation-invalid", "evaluationPlan must be an object."); return null; }
  if (plan.schemaVersion !== 1) report("evaluation-schema-version", "Structured evaluation plans must use schemaVersion 1.");
  const metrics = Array.isArray(plan.metrics) ? plan.metrics : [];
  if (!Array.isArray(plan.metrics)) report("evaluation-metrics-invalid", "Evaluation plans must define a metrics array.");
  const ids = new Set(), aliases = new Map();
  let primaryCount = 0;
  const normalized = metrics.map((candidate) => {
    const metric = normalizeMetric(candidate);
    if (!metric) { report("metric-invalid", "Each metric must be an object."); return null; }
    if (typeof metric.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metric.id)) report("metric-id-invalid", `Metric id "${String(metric.id)}" must use lowercase kebab-case.`);
    if (ids.has(metric.id)) report("metric-id-duplicate", `Duplicate metric id "${metric.id}".`);
    ids.add(metric.id);
    if (typeof metric.label !== "string" || !metric.label.trim()) report("metric-label-invalid", `Metric "${metric.id}" needs a label.`);
    if (!ROLES.has(metric.role)) report("metric-role-invalid", `Metric "${metric.id}" has an invalid role.`);
    if (metric.role === "primary") primaryCount++;
    if (!DIRECTIONS.has(metric.direction)) report("metric-direction-invalid", `Metric "${metric.id}" has an invalid direction.`);
    if (typeof metric.unit !== "string" || !metric.unit.trim()) report("metric-unit-invalid", `Metric "${metric.id}" needs a unit.`);
    if (!AGGREGATIONS.has(metric.aggregation)) report("metric-aggregation-invalid", `Metric "${metric.id}" has an invalid aggregation.`);
    if (typeof metric.display !== "string" || !metric.display.trim()) report("metric-display-invalid", `Metric "${metric.id}" needs a display format.`);
    if (!Array.isArray(metric.aliases) || metric.aliases.some((alias) => typeof alias !== "string" || !alias.trim())) report("metric-alias-invalid", `Metric "${metric.id}" aliases must be non-empty strings.`);
    for (const alias of metric.aliases) {
      const key = alias.trim().toLowerCase();
      if (aliases.has(key) || key === metric.id) report("metric-alias-collision", `Metric alias "${alias}" is ambiguous.`);
      aliases.set(key, metric.id);
    }
    if (metric.role === "guardrail" && metric.threshold === undefined) report("guardrail-threshold-missing", `Guardrail metric "${metric.id}" should define a threshold.`);
    return metric;
  }).filter(Boolean);
  if (normalized.length && primaryCount === 0) report("primary-metric-missing", "Evaluation plan must define a primary metric.");
  const metricIds = new Set(normalized.map((metric) => metric.id));
  for (const [alias, metricId] of aliases) if (metricIds.has(alias) && metricId !== alias) report("metric-alias-collision", `Metric alias "${alias}" collides with a canonical metric ID.`);
  for (const comparison of Array.isArray(plan.comparisons) ? plan.comparisons : []) {
    if (comparison?.metrics !== undefined && !Array.isArray(comparison.metrics)) report("comparison-metrics-invalid", `Comparison "${comparison?.id ?? "(unnamed)"}" metrics must be an array of canonical IDs.`);
    for (const id of Array.isArray(comparison?.metrics) ? comparison.metrics : []) if (!metricIds.has(id)) report("comparison-metric-unknown", `Comparison references unknown metric "${id}".`);
    if (!comparison?.baseline) report("comparison-baseline-missing", `Comparison "${comparison?.id ?? "(unnamed)"}" must specify a baseline.`);
    const units = new Set((comparison?.metrics ?? []).map((id) => normalized.find((metric) => metric.id === id)?.unit).filter(Boolean));
    if (units.size > 1) report("comparison-units-incompatible", `Comparison "${comparison?.id ?? "(unnamed)"}" combines incompatible metric units.`);
  }
  for (const ablation of Array.isArray(plan.ablations) ? plan.ablations : []) {
    if (!ablation?.baseline && !ablation?.control) report("ablation-baseline-missing", `Ablation "${ablation?.id ?? "(unnamed)"}" needs a baseline or control.`);
    if (!ablation?.factor) report("ablation-factor-missing", `Ablation "${ablation?.id ?? "(unnamed)"}" needs a changed factor.`);
  }
  return { ...plan, metrics: normalized, comparisons: Array.isArray(plan.comparisons) ? plan.comparisons : [], ablations: Array.isArray(plan.ablations) ? plan.ablations : [], successCriteria: Array.isArray(plan.successCriteria) ? plan.successCriteria : [] };
}

function safeDepth(value, depth = 0) {
  const stack = [[value, depth]];
  while (stack.length) {
    const [current, level] = stack.pop();
    if (level > IMPORT_LIMITS.jsonDepth) return false;
    if (current && typeof current === "object") for (const child of Object.values(current)) stack.push([child, level + 1]);
  }
  return true;
}

async function checkFile(file) {
  const info = await fs.lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Import must be a regular file, not a symlink.");
  if (info.size > IMPORT_LIMITS.bytes) throw new Error(`Import exceeds ${IMPORT_LIMITS.bytes} bytes.`);
}

async function jsonRows(file, jsonl) {
  await checkFile(file);
  const rows = [];
  if (!jsonl) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(file));
    const value = JSON.parse(text);
    if (!safeDepth(value)) throw new Error("JSON nesting limit exceeded.");
    const input = Array.isArray(value) ? value : Array.isArray(value.rows) ? value.rows : [value];
    rows.push(...input);
  } else {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let pending = "";
    let lineNumber = 0;
    const acceptLine = (line) => {
      lineNumber++;
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); }
      catch (error) { throw new Error(`JSONL line ${lineNumber} is invalid: ${error instanceof Error ? error.message : "could not parse JSON"}`); }
      if (!safeDepth(row)) throw new Error(`JSONL line ${lineNumber} exceeds the JSON nesting limit.`);
      rows.push(row);
      if (rows.length > IMPORT_LIMITS.rows) throw new Error("Import row limit exceeded.");
    };
    for await (const chunk of createReadStream(file)) { pending += decoder.decode(chunk, { stream: true }); const lines = pending.split(/\r?\n/); pending = lines.pop() ?? ""; for (const line of lines) acceptLine(line); }
    pending += decoder.decode();
    if (pending.length || lineNumber === 0) acceptLine(pending);
  }
  if (rows.length > IMPORT_LIMITS.rows) throw new Error("Import row limit exceeded.");
  return rows;
}

export async function parseImportFile(file, extension) {
  const ext = String(extension || path.extname(file)).toLowerCase();
  if (![".csv", ".tsv", ".json", ".jsonl"].includes(ext)) throw new Error("Supported imports are CSV, TSV, JSON, and JSONL.");
  await checkFile(file);
  if (ext === ".json") {
    const rows = await jsonRows(file, false);
    const columns = [...new Set(rows.flatMap((row) => row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : []))];
    if (columns.length > IMPORT_LIMITS.columns) throw new Error("Import column limit exceeded.");
    return { format: "json", columns, rows };
  }
  if (ext === ".jsonl") {
    const rows = await jsonRows(file, true);
    const columns = [...new Set(rows.flatMap((row) => row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row) : []))];
    if (columns.length > IMPORT_LIMITS.columns) throw new Error("Import column limit exceeded.");
    return { format: "jsonl", columns, rows };
  }
  const delimiter = ext === ".tsv" ? "\t" : ",", records = [];
  let row = [], field = "", quoted = false;
  const pushField = () => { row.push(field); field = ""; if (row.length > IMPORT_LIMITS.columns) throw new Error("Import column limit exceeded."); };
  const pushRow = () => { pushField(); records.push(row); row = []; if (records.length > IMPORT_LIMITS.rows + 1) throw new Error("Import row limit exceeded."); };
  let pendingQuote = false, afterQuote = false, firstChunk = true;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for await (const bytes of createReadStream(file)) {
    let chunk = decoder.decode(bytes, { stream: true });
    if (firstChunk) { chunk = chunk.replace(/^\uFEFF/, ""); firstChunk = false; }
    for (const ch of chunk) {
      if (quoted) {
        if (pendingQuote) {
          if (ch === '"') { field += '"'; pendingQuote = false; continue; }
          quoted = false; pendingQuote = false; afterQuote = true;
        } else if (ch === '"') { pendingQuote = true; continue; }
        else { field += ch; continue; }
      }
      if (afterQuote && ch !== delimiter && ch !== "\n" && ch !== "\r") throw new Error("Unexpected text after a quoted field.");
      if (ch === '"' && field === "" && !afterQuote) quoted = true;
      else if (ch === '"') throw new Error("Unexpected quote inside an unquoted field.");
      else if (ch === delimiter) { pushField(); afterQuote = false; }
      else if (ch === "\n") { pushRow(); afterQuote = false; }
      else if (ch === "\r") { /* CRLF is consumed by the line break. */ }
      else { field += ch; afterQuote = false; }
    }
  }
  decoder.decode();
  if (quoted && pendingQuote) { quoted = false; pendingQuote = false; afterQuote = true; }
  if (quoted) throw new Error("Malformed quoted field.");
  if (field || row.length || afterQuote) pushRow();
  if (!records.length) return { format: ext.slice(1), columns: [], rows: [] };
  const columns = records.shift().map((name) => name.trim());
  if (new Set(columns).size !== columns.length || columns.some((name) => !name)) throw new Error("Header names must be non-empty and unique.");
  for (const record of records) if (record.length > columns.length) throw new Error("A row contains more fields than the header.");
  return { format: ext.slice(1), columns, rows: records.filter((record) => record.some((value) => value !== "")).map((record) => Object.fromEntries(columns.map((name, i) => [name, record[i] ?? ""]))) };
}

export async function listRunManifests(progressRoot, diagnostics = []) {
  const manifests = [];
  async function visit(directory) {
    let items;
    try { items = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error?.code === "ENOENT") return; throw error; }
    for (const item of items) {
      const target = path.join(directory, item.name);
      if (item.isSymbolicLink()) { diagnostics.push({ severity: "error", code: "experiment-data-symlink", message: "Experiment data paths must not contain symlinks.", file: path.relative(progressRoot, target).split(path.sep).join("/") }); continue; }
      if (item.isDirectory()) { await visit(target); continue; }
      if (item.isFile() && item.name === RUN_MANIFEST) {
        try { const raw = await fs.readFile(target, "utf8"); if (raw.includes("\uFFFD")) throw new Error("Manifest is not valid UTF-8."); manifests.push({ file: target, relative: path.relative(progressRoot, target).split(path.sep).join("/"), data: JSON.parse(raw) }); }
        catch { diagnostics.push({ severity: "error", code: "run-manifest-invalid", message: "Run manifest is malformed JSON or invalid UTF-8.", file: path.relative(progressRoot, target).split(path.sep).join("/") }); }
      }
    }
  }
  await visit(progressRoot);
  return manifests;
}
