import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileResearchWorkspace } from "@/lib/research/compiler.mjs";
import { parseImportFile, resolveMetricColumn } from "@/lib/research/experiments.mjs";
import { isSameOrigin } from "@/lib/http/same-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin imports are not allowed." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a CSV, TSV, JSON, or JSONL file." }, { status: 400 });
  const extension = path.extname(file.name).toLowerCase();
  if (!new Set([".csv", ".tsv", ".json", ".jsonl"]).has(extension)) return NextResponse.json({ error: "Supported imports are CSV, TSV, JSON, and JSONL." }, { status: 415 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Import is limited to 25 MB." }, { status: 413 });
  const projectId = String(form?.get("projectId") ?? ""), experimentId = String(form?.get("experimentId") ?? "");
  const workspace = await compileResearchWorkspace({ fresh: true });
  const experiment = workspace.entries.find((entry) => entry.id === experimentId && entry.research === projectId && entry.type === "experiment");
  const plan = workspace.entries.find((entry) => entry.id === experiment?.experimentSpec?.evaluationPlan && entry.research === projectId)?.evaluationPlan;
  if (!plan) return NextResponse.json({ error: "Experiment has no valid evaluation plan." }, { status: 422 });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-import-preview-"));
  const filename = `preview${extension}`;
  try {
    await fs.writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const parsed = await parseImportFile(path.join(directory, filename), extension);
    const types = Object.fromEntries(parsed.columns.map((column) => {
      const values = parsed.rows.slice(0, 100).map((row) => row?.[column]).filter((value) => value !== undefined && value !== "");
      const numeric = values.length > 0 && values.every((value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))));
      const boolean = values.length > 0 && values.every((value) => typeof value === "boolean" || ["true", "false"].includes(String(value).toLowerCase()));
      const time = values.length > 0 && values.every((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /[-/:T]/.test(value));
      return [column, numeric ? "number" : boolean ? "boolean" : time ? "time" : "text"];
    }));
    const suggestions = Object.fromEntries(parsed.columns.map((column) => [column, resolveMetricColumn(column, plan)]).filter(([, value]) => value));
    return NextResponse.json({ format: parsed.format, columns: parsed.columns, columnTypes: types, rows: parsed.rows.slice(0, 50), rowCount: parsed.rows.length, truncated: parsed.rows.length > 50, suggestions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not parse import file." }, { status: 422 });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
