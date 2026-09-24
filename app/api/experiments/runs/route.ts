import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileResearchWorkspace } from "@/lib/research/compiler.mjs";
import { parseImportFile } from "@/lib/research/experiments.mjs";
import { createExperimentRun, createExperimentRuns } from "@/lib/research/run-write.mjs";
import { assertImportBatchStorageWithinLimit, finiteNumericValue } from "@/lib/research/experiments-shared.mjs";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const writable = () => process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";

function aggregate(values: number[], operation: string) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  if (operation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (operation === "min") return Math.min(...values);
  if (operation === "max") return Math.max(...values);
  if (operation === "count") return values.length;
  if (operation === "first" || operation === "none") return values[0];
  if (operation === "last") return values.at(-1);
  if (operation === "median") return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeRunId(value: unknown, fallback: string) {
  const id = String(value ?? fallback).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
  return id || fallback;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin experiment writes are not allowed." }, { status: 403 });
  if (!writable()) return NextResponse.json({ error: "Run capture is disabled in this environment." }, { status: 503 });
  try {
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const body = await request.json();
      const result = await createExperimentRun(body);
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const form = await request.formData(), upload = form.get("file"), raw = form.get("mapping");
    if (!(upload instanceof File) || typeof raw !== "string") return NextResponse.json({ error: "Import confirmation needs the original file and approved column mapping." }, { status: 400 });
    if (upload.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Import is limited to 25 MB." }, { status: 413 });
    const mapping = JSON.parse(raw) as { projectId: string; experimentId: string; label?: string; rowMode: "runs" | "observations" | "time"; runIdColumn?: string; timeColumn?: string; parameterColumns?: string[]; metricMappings: Array<{ column: string; metricId: string }> };
    if (!new Set(["runs", "observations", "time"]).has(mapping.rowMode) || !Array.isArray(mapping.metricMappings) || !mapping.metricMappings.length) return NextResponse.json({ error: "Choose row semantics and map at least one metric column before confirming." }, { status: 422 });
    const workspace = await compileResearchWorkspace({ fresh: true });
    const experiment = workspace.entries.find((entry) => entry.id === mapping.experimentId && entry.type === "experiment" && entry.research === mapping.projectId);
    const plan = workspace.entries.find((entry) => entry.id === experiment?.experimentSpec?.evaluationPlan && entry.research === mapping.projectId)?.evaluationPlan;
    if (!plan) return NextResponse.json({ error: "Experiment has no valid evaluation plan." }, { status: 422 });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-import-confirm-")), extension = path.extname(upload.name).toLowerCase();
    try {
      const original = Buffer.from(await upload.arrayBuffer());
      const temporary = path.join(directory, `source${extension}`);
      await fs.writeFile(temporary, original, { flag: "wx" });
      const parsed = await parseImportFile(temporary, extension);
      for (const item of mapping.metricMappings) {
        if (!parsed.columns.includes(item.column) || !plan.metrics.some((metric: { id: string }) => metric.id === item.metricId)) throw new Error("Metric mapping references an unknown column or metric ID.");
      }
      const filename = path.basename(upload.name).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
      if (!filename || filename.startsWith(".")) throw new Error("Choose a file with a safe name.");
      const uploadSpec = { filename, bytes: original };
      if (mapping.rowMode === "runs") {
        assertImportBatchStorageWithinLimit(upload.size, parsed.rows.length);
        const runs = parsed.rows.map((row, index) => {
          const runId = safeRunId(mapping.runIdColumn ? row?.[mapping.runIdColumn] : "", `run-${index + 1}`);
          const metrics = Object.fromEntries(mapping.metricMappings.map(({ column, metricId }) => {
            const value = finiteNumericValue(row?.[column]);
            if (value === undefined) throw new Error(`Row ${index + 1} has a missing or nonnumeric value for ${column}.`);
            return [metricId, { value, source: { file: filename, column, aggregation: "none" } }];
          }));
          const parameters = Object.fromEntries((mapping.parameterColumns ?? []).filter((column) => parsed.columns.includes(column)).map((column) => [column, row?.[column]]));
          return { runId, label: String(row?.[mapping.runIdColumn ?? ""] ?? runId), parameters, metrics, upload: uploadSpec };
        });
        const created = await createExperimentRuns({ projectId: mapping.projectId, experimentId: mapping.experimentId }, runs);
        return NextResponse.json({ runs: created.map(({ run }) => run), count: created.length }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }
      const metrics = Object.fromEntries(mapping.metricMappings.map(({ column, metricId }) => {
        const values = parsed.rows.map((row) => finiteNumericValue(row?.[column])).filter((value): value is number => value !== undefined);
        const definition = plan.metrics.find((metric: { id: string }) => metric.id === metricId);
        const operation = definition?.aggregation ?? "mean", value = aggregate(values, operation);
        if (value === undefined) throw new Error(`Column ${column} contains no numeric values.`);
        return [metricId, { value, source: { file: filename, column, aggregation: operation } }];
      }));
      const parameters = { rowMode: mapping.rowMode, observationCount: parsed.rows.length, ...(mapping.timeColumn && parsed.columns.includes(mapping.timeColumn) ? { timeColumn: mapping.timeColumn } : {}), ...(mapping.parameterColumns ?? []).filter((column) => parsed.columns.includes(column)).reduce((values, column) => ({ ...values, [column]: [...new Set(parsed.rows.map((row) => row?.[column]))].slice(0, 100) }), {}) };
      const runId = safeRunId(mapping.label, `import-${Date.now()}`);
      const created = await createExperimentRun({ projectId: mapping.projectId, experimentId: mapping.experimentId, runId, label: mapping.label || `Imported ${mapping.rowMode}`, parameters, metrics, upload: uploadSpec });
      return NextResponse.json({ run: created.run, count: 1 }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save run." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
