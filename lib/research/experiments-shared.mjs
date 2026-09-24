// Browser-safe experiment helpers. Keep filesystem parsing and manifest access
// in experiments.mjs so client components never pull Node built-ins into chunks.
export const IMPORT_BATCH_STORAGE_LIMIT = 128 * 1024 * 1024;

export function assertImportBatchStorageWithinLimit(sourceBytes, runCount) {
  if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0 || !Number.isSafeInteger(runCount) || runCount < 0) throw new Error("Imported file size or run count is invalid.");
  if (BigInt(sourceBytes) * BigInt(runCount) > BigInt(IMPORT_BATCH_STORAGE_LIMIT)) {
    throw new Error("This import would retain more than 128 MB of duplicated source data. Import the rows as observations or time series, or split the file into smaller batches.");
  }
  return sourceBytes * runCount;
}

export function finiteNumericValue(value) {
  if (typeof value === "string" && !value.trim()) return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function resolveMetricColumn(column, plan, approvedMapping = {}) {
  const key = String(column).trim().toLowerCase();
  const metrics = plan?.metrics ?? [];
  const exact = metrics.find((metric) => metric.id === key);
  if (exact) return { metricId: exact.id, reason: "canonical-id" };
  const alias = metrics.find((metric) => metric.aliases.some((value) => value.trim().toLowerCase() === key));
  if (alias) return { metricId: alias.id, reason: "declared-alias" };
  if (approvedMapping[key] && metrics.some((metric) => metric.id === approvedMapping[key])) return { metricId: approvedMapping[key], reason: "approved-mapping" };
  return null;
}

export function compareRuns(runs, baselineId, metricDefinitions = []) {
  const baseline = runs.find((run) => run.id === baselineId);
  const byId = new Map(metricDefinitions.map((metric) => [metric.id, metric]));
  return runs.map((run) => ({ runId: run.id, metrics: Object.fromEntries(Object.entries(run.metrics ?? {}).map(([id, item]) => {
    const value = typeof item === "number" ? item : item?.value, baseItem = baseline?.metrics?.[id], base = typeof baseItem === "number" ? baseItem : baseItem?.value;
    const metric = byId.get(id), delta = Number.isFinite(value) && Number.isFinite(base) ? value - base : undefined;
    return [id, { value, baseline: base, ...(delta !== undefined ? { delta } : {}), ...(delta !== undefined && base !== 0 ? { relativeDelta: delta / Math.abs(base) } : {}), ...(delta !== undefined && metric?.direction !== "target" ? { outcome: (delta * (metric?.direction === "minimize" ? -1 : 1)) > 0 ? "improvement" : (delta * (metric?.direction === "minimize" ? -1 : 1)) < 0 ? "regression" : "unchanged" } : {}) }];
  })), parameterDiff: Object.fromEntries([...new Set(runs.flatMap((item) => Object.keys(item.parameters ?? {})))].map((key) => [key, [...new Set(runs.map((item) => JSON.stringify(item.parameters?.[key] ?? null)))].length > 1])) }));
}

export function recommendVisualizations(runs, metrics = []) {
  const choices = [];
  const parameters = new Set((runs ?? []).flatMap((run) => Object.keys(run.parameters ?? {})));
  if ((metrics ?? []).filter((metric) => metric.role === "primary").length > 1) choices.push("Pareto scatter");
  if ((runs ?? []).some((run) => run.parameters?.rowMode === "time" || run.parameters?.timeColumn)) choices.push("Line chart");
  if ((runs ?? []).some((run) => run.parameters?.rowMode === "observations")) choices.push("Distribution (box or histogram)");
  if (parameters.size && metrics.length) choices.push("Parameter × metric scatter");
  if (parameters.size >= 5) choices.push("Parallel coordinates");
  if (runs.length > 1 && metrics.length > 1) choices.push("Run × metric heatmap");
  if (runs.length > 1 && metrics.length === 1) choices.push("Scalar run comparison (dot or bar)");
  if (runs.length === 1 && metrics.length) choices.push("Run metric dot plot");
  if (runs.length > 1 && runs.some((run) => run.parameters?.ablation === true)) choices.push("Ablation delta plot");
  return [...new Set(choices)];
}

export function detectConfounding(baseline, variants, factor, controlled = []) {
  const parameters = baseline?.parameters ?? {}, names = new Set([ ...Object.keys(parameters), ...(variants ?? []).flatMap((run) => Object.keys(run.parameters ?? {})) ]);
  const differing = [...names].filter((name) => name !== factor && (variants ?? []).some((run) => JSON.stringify(run.parameters?.[name] ?? null) !== JSON.stringify(parameters[name] ?? null)));
  const missingControls = (controlled ?? []).filter((name) => !Object.hasOwn(parameters, name) || (variants ?? []).some((run) => !Object.hasOwn(run.parameters ?? {}, name)));
  return { potentiallyConfounded: differing.length > 0 || missingControls.length > 0, differing, missingControls };
}
