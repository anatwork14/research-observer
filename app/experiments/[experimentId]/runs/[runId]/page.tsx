import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { RunMetricChart, type MeasurementPoint } from "@/components/RunMetricChart";
import { getResearchWorkspace } from "@/lib/progress";
import { parseImportFile } from "@/lib/research/experiments.mjs";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ experimentId: string; runId: string }> }) {
  const [{ experimentId, runId }, workspace] = await Promise.all([params, getResearchWorkspace()]);
  const experiment = workspace.entries.find((entry) => (entry.id === experimentId || entry.slug === experimentId) && entry.type === "experiment");
  const run = (workspace.experiments ?? []).find((item) => item.id === runId && item.experimentId === experiment?.id);
  if (!experiment || !run) notFound();
  const plan = workspace.entries.find((entry) => entry.id === experiment.experimentSpec?.evaluationPlan);
  const definitions = new Map((plan?.evaluationPlan?.metrics ?? []).map((metric) => [metric.id, metric]));
  const project = workspace.projects.find((item) => item.id === experiment.research);
  const runDirectory = path.resolve(workspace.progressRoot, path.dirname(run.manifest));
  const charts = await Promise.all(Object.entries(run.metrics ?? {}).map(async ([id, measurement]) => {
    const source = measurement.source;
    const sourceFile = source?.file;
    const sourceColumn = source?.column;
    if (typeof sourceFile !== "string" || typeof sourceColumn !== "string" || !run.dataFiles?.includes(sourceFile) || !["time", "observations"].includes(String(run.parameters?.rowMode))) return null;
    const file = path.resolve(runDirectory, ...sourceFile.replaceAll("\\", "/").split("/"));
    if (!(file === runDirectory || file.startsWith(runDirectory + path.sep))) return null;
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 25 * 1024 * 1024) return null;
      const parsed = await parseImportFile(file);
      if (!parsed.columns.includes(sourceColumn)) return null;
      const timeColumn = typeof run.parameters?.timeColumn === "string" ? run.parameters.timeColumn : "";
      const points = parsed.rows.flatMap((row, index) => {
        const value = Number(row[sourceColumn]);
        return Number.isFinite(value) ? [{ x: String(row[timeColumn] ?? index + 1), value }] : [];
      });
      return { id, unit: definitions.get(id)?.unit ?? "", mode: run.parameters?.rowMode === "time" ? "time" as const : "distribution" as const, points: points as MeasurementPoint[] };
    } catch { return null; }
  }));
  return <div className="site-shell"><WorkspaceHeader entries={workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }))} active="projects" /><main className="collection-shell" style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
    <header className="collection-heading"><div><p className="eyebrow"><Link href={`/projects/${encodeURIComponent(experiment.research)}/experiments`}>{project?.label ?? experiment.research} · Experiments</Link> / <Link href={`/experiments/${encodeURIComponent(experiment.id ?? experiment.slug)}`}>{experiment.title}</Link></p><h1>{run.label}</h1><p>{run.status} · {run.timestamps?.createdAt ?? "timestamp unavailable"}</p></div><Link href={`/projects/${encodeURIComponent(experiment.research)}/experiments?view=compare`}>Compare this run</Link></header>
    <section className="panel"><h2>Summary metrics and provenance</h2><div style={{ overflowX: "auto" }}><table><thead><tr><th>Metric</th><th>Value</th><th>Definition</th><th>Provenance</th></tr></thead><tbody>{Object.entries(run.metrics ?? {}).map(([id, item]) => { const definition = definitions.get(id); const source = item.source ?? {}; return <tr key={id}><th>{definition?.label ?? id}<small>{id}</small></th><td>{item.value} {definition?.unit ?? ""}</td><td>{definition ? `${definition.role} · ${definition.direction} · ${definition.aggregation}` : "Metric missing from plan"}</td><td>{source.kind === "manual" ? `Manual: ${String(source.note ?? "")}` : `${String(source.file ?? "source unavailable")} · ${String(source.column ?? "column unavailable")} · ${String(source.aggregation ?? "aggregation unavailable")}`}</td></tr>; })}</tbody></table></div></section>
    <section className="panel"><h2>Parameters</h2><dl>{Object.entries(run.parameters ?? {}).map(([name, value]) => <div key={name} style={{ display: "grid", gridTemplateColumns: "minmax(8rem, 1fr) 2fr", gap: ".7rem", padding: ".45rem 0", borderBottom: "1px solid var(--line)" }}><dt>{name}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{JSON.stringify(value)}</dd></div>)}</dl>{!Object.keys(run.parameters ?? {}).length && <p>No parameters recorded.</p>}</section>
    <section className="panel"><h2>Time series and distributions</h2>{charts.filter((chart): chart is NonNullable<typeof chart> => Boolean(chart)).map((chart) => <RunMetricChart key={chart.id} title={definitions.get(chart.id)?.label ?? chart.id} unit={chart.unit} mode={chart.mode} points={chart.points} />)}{!charts.some(Boolean) && <p>Import observation or time/step rows to show their source measurements here.</p>}</section>
    <section className="panel"><h2>Raw data files</h2>{(run.dataFiles ?? []).map((file) => { const relative = typeof file === "string" ? file : file.path; return <p key={relative}><Link href={`/api/experiments/runs/${encodeURIComponent(experiment.id ?? experiment.slug)}/${encodeURIComponent(run.id)}/${relative.split("/").map(encodeURIComponent).join("/")}`}>Download original {relative}</Link></p>; })}{!(run.dataFiles ?? []).length && <p>No raw data files recorded.</p>}<h3>Artifacts</h3>{(run.artifacts ?? []).map((item, index) => <p key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</p>)}{!(run.artifacts ?? []).length && <p>No artifacts recorded.</p>}</section>
    <section className="panel"><h2>Metric values</h2><div style={{ overflowX: "auto" }}><table><thead><tr><th>Metric</th><th>Value</th><th>Unit</th><th>Source</th></tr></thead><tbody>{Object.entries(run.metrics ?? {}).map(([id, item]) => <tr key={id}><th>{definitions.get(id)?.label ?? id}</th><td>{item.value}</td><td>{definitions.get(id)?.unit ?? "—"}</td><td>{String(item.source?.file ?? item.source?.kind ?? "—")}</td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Related experiment</h2><Link href={`/experiments/${encodeURIComponent(experiment.id ?? experiment.slug)}`}>{experiment.title}</Link><p>{experiment.summary}</p>{plan && <p>Evaluation plan: <Link href={`/progress/${encodeURIComponent(plan.slug)}`}>{plan.title}</Link></p>}{run.notes && <p>{run.notes}</p>}</section>
  </main></div>;
}
