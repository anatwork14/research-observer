"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { detectConfounding, recommendVisualizations } from "@/lib/research/experiments-shared.mjs";
import styles from "./ExperimentWorkbench.module.css";

type Metric = { id: string; label: string; role: string; direction: string; unit: string; aggregation: string; display: string; aliases: string[]; threshold?: unknown; description?: string };
type Experiment = { id?: string; slug: string; title: string; summary: string; filename: string; experimentSpec?: { evaluationPlan: string; kind: string; factors?: Array<Record<string, unknown>>; controlledVariables?: string[]; datasets?: string[] } };
type Run = { id: string; experimentId: string; label: string; status: string; timestamps?: Record<string, string>; parameters?: Record<string, unknown>; metrics?: Record<string, { value: number; source: Record<string, unknown> }>; dataFiles?: Array<string | { path: string }>; artifacts?: unknown[]; manifest: string; experimentSlug?: string };
type Props = { projectId: string; projectLabel: string; view: string; experiments: Experiment[]; runs: Run[]; metrics: Array<{ metric: Metric; planId: string; experimentIds: string[] }>; entries: Array<{ id?: string; slug: string; title: string; type?: string; research: string; evaluationPlan?: { metrics?: Metric[]; successCriteria?: Array<Record<string, unknown>> }; candidateMetricDefinitions?: Array<{ heading: string; text: string }> }> };
type Preview = { format: string; columns: string[]; columnTypes: Record<string, string>; rows: Array<Record<string, unknown>>; rowCount: number; truncated: boolean; suggestions: Record<string, { metricId: string; reason: string }> };

const views = ["overview", "runs", "compare", "ablations", "metrics", "data"];
const finiteValue = (metric: { value: number } | number | undefined) => typeof metric === "number" ? metric : metric?.value;

function successSummary(run: Run, criteria: Array<Record<string, unknown>>) {
  if (!criteria.length) return "No predefined success criteria.";
  let met = 0, unresolved = 0;
  for (const criterion of criteria) {
    const id = String(criterion.metricId ?? criterion.metric ?? ""), value = finiteValue(run.metrics?.[id]), threshold = Number(criterion.value ?? criterion.threshold);
    const operator = String(criterion.operator ?? criterion.comparator ?? "");
    if (!id || !Number.isFinite(value) || !Number.isFinite(threshold)) { unresolved++; continue; }
    const passed = operator === ">=" ? value! >= threshold : operator === ">" ? value! > threshold : operator === "<=" ? value! <= threshold : operator === "<" ? value! < threshold : operator === "=" || operator === "==" ? value === threshold : false;
    if (passed) met++;
  }
  return `${met}/${criteria.length} predefined success criteria met${unresolved ? ` · ${unresolved} unresolved` : ""}`;
}

export function ExperimentWorkbench(props: Props) {
  const [selected, setSelected] = useState<string[]>([]), [baseline, setBaseline] = useState(""), [diffOnly, setDiffOnly] = useState(false);
  const [feedback, setFeedback] = useState("");
  const activeRuns = props.runs.filter((run) => props.experiments.some((experiment) => experiment.id === run.experimentId));
  const activeView = views.includes(props.view) ? props.view : "overview";
  const selectedRuns = activeRuns.filter((run) => selected.includes(run.id));
  const activeMetrics = props.metrics;
  const runStatuses = [...new Set(activeRuns.map((run) => run.status))].map((status) => [status, activeRuns.filter((run) => run.status === status).length] as const);
  const metricDefs = new Map<string, Array<Metric>>();
  for (const { metric } of activeMetrics) metricDefs.set(metric.id, [...(metricDefs.get(metric.id) ?? []), metric]);
  const incompatibleMetrics = [...metricDefs].filter(([, definitions]) => new Set(definitions.map((item) => `${item.unit}/${item.direction}/${item.aggregation}`)).size > 1).map(([id]) => id);
  const primary = activeMetrics.filter(({ metric }) => metric.role === "primary");
  const guardrails = activeMetrics.filter(({ metric }) => metric.role === "guardrail");
  const violations = activeRuns.flatMap((run) => guardrails.flatMap(({ metric }) => {
    const value = finiteValue(run.metrics?.[metric.id]);
    const threshold = Number(metric.threshold);
    if (!Number.isFinite(value) || !Number.isFinite(threshold)) return [];
    const numericValue = value as number;
    const violated = metric.direction === "minimize" ? numericValue > threshold : metric.direction === "maximize" ? numericValue < threshold : numericValue !== threshold;
    return violated ? [`${run.label}: ${metric.label}`] : [];
  }));

  function toggleRun(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function improvement(value: number | undefined, base: number | undefined, direction: string, threshold?: unknown) {
    if (!Number.isFinite(value) || !Number.isFinite(base)) return "—";
    const delta = (value as number) - (base as number);
    const target = Number(threshold);
    const outcome = direction === "target" ? Number.isFinite(target) ? Math.abs((value as number) - target) < Math.abs((base as number) - target) ? "improvement" : Math.abs((value as number) - target) > Math.abs((base as number) - target) ? "regression" : "unchanged" : "target not defined" : delta === 0 ? "unchanged" : (delta > 0) === (direction === "maximize") ? "improvement" : "regression";
    return <span className={outcome === "improvement" ? styles.good : outcome === "regression" ? styles.bad : ""}>{delta > 0 ? "+" : ""}{delta.toPrecision(4)} · {outcome}</span>;
  }
  const experimentTitle = (id: string) => props.experiments.find((item) => item.id === id)?.title ?? id;

  return <section className={styles.workbench}>
    <header className={styles.heading}><div><p className="eyebrow">Project · {props.projectLabel}</p><h1>Experiments</h1><p>Plans, runs, raw measurements, and comparisons stay in the project files.</p></div><span className="collection-count">{props.experiments.length} experiments · {activeRuns.length} runs</span></header>
    <nav className={styles.tabs} aria-label="Experiment views">{views.map((item) => <Link key={item} aria-current={activeView === item ? "page" : undefined} href={`/projects/${encodeURIComponent(props.projectId)}/experiments?view=${item}`}>{item[0].toUpperCase() + item.slice(1)}</Link>)}</nav>

    {activeView === "overview" && <>
      <div className={styles.cards}><article><small>Experiments</small><strong>{props.experiments.length}</strong><small className={styles.cardContext}>in this project</small></article><article><small>Runs</small><strong>{activeRuns.length}</strong><small className={styles.cardContext}>linked to indexed experiments</small></article><article><small>Primary metrics</small><strong>{primary.length}</strong><small className={styles.cardContext}>defined in evaluation plans</small></article><article><small>Guardrail checks</small><strong className={violations.length ? styles.bad : styles.good}>{violations.length ? `${violations.length} flagged` : "Within thresholds"}</strong><small className={styles.cardContext}>{violations.length ? "measurements requiring review" : "declared limits satisfied"}</small></article></div>
      <section className="panel"><h2>Run status</h2><p>{runStatuses.length ? runStatuses.map(([status, count]) => `${status}: ${count}`).join(" · ") : "No runs recorded."}</p><h3>Active evaluation plans</h3>{props.entries.filter((entry) => entry.type === "evaluation" && entry.evaluationPlan).map((entry) => <p key={entry.slug}><Link href={`/progress/${encodeURIComponent(entry.slug)}`}>{entry.title}</Link> · {(entry.evaluationPlan?.metrics ?? []).filter((metric) => metric.role === "primary").map((metric) => `${metric.label} (${metric.id})`).join(", ") || "Primary metric not configured"}</p>)}{!props.entries.some((entry) => entry.type === "evaluation" && entry.evaluationPlan) && <p>No structured evaluation plan is active.</p>}</section>
      <section className="panel"><h2>Recent experiments</h2>{props.experiments.slice(0, 8).map((experiment) => <div className={styles.listRow} key={experiment.slug}><div><Link href={`/experiments/${encodeURIComponent(experiment.id ?? experiment.slug)}`}>{experiment.title}</Link><small>{experiment.experimentSpec?.kind ?? "Legacy experiment"} · {experiment.summary}</small></div><span className={styles.monoMeta}>{activeRuns.filter((run) => run.experimentId === experiment.id).length} runs</span></div>)}{!props.experiments.length && <p>No experiments are indexed in this project yet.</p>}</section>
      {violations.length > 0 && <section className={styles.alert}><strong>Guardrail measurements requiring review</strong><p>{violations.slice(0, 6).join(" · ")}</p></section>}
      <section className="panel"><h2>Suggested views</h2>{props.experiments.map((experiment) => { const experimentRuns = activeRuns.filter((run) => run.experimentId === experiment.id); const experimentMetrics = activeMetrics.filter(({ experimentIds }) => experimentIds.includes(experiment.id ?? "")).map(({ metric }) => metric); const suggestions = recommendVisualizations(experimentRuns, experimentMetrics); return <p key={experiment.slug}><strong>{experiment.title}:</strong> {suggestions.length ? suggestions.join(" · ") : "Record more structured run data to recommend a chart"}. All measurements remain available in the run and metric tables.</p>; })}</section>
    </>}

    {activeView === "runs" && <section className="panel"><div className={styles.sectionHead}><h2>Runs</h2><span>{activeRuns.length} recorded</span></div>{activeRuns.map((run) => <div className={styles.listRow} key={run.manifest}><div><Link href={`/experiments/${encodeURIComponent(run.experimentId)}/runs/${encodeURIComponent(run.id)}`}>{run.label}</Link><code className={styles.runId}>{run.id}</code><span className={styles.runMeta}><span>{experimentTitle(run.experimentId)}</span><span>{run.status}</span><span>{run.timestamps?.createdAt ?? "timestamp unavailable"}</span></span></div><div>{Object.entries(run.metrics ?? {}).map(([id, value]) => <span className={styles.runMetric} key={id}>{id} <span>{value.value}</span></span>)}</div></div>)}{!activeRuns.length && <p>No run manifests yet. Add a run from the Data view.</p>}</section>}

    {activeView === "compare" && <section className="panel"><div className={styles.sectionHead}><div><h2>Compare runs</h2><p>Select two or more runs and choose the reference baseline.</p></div><button type="button" className={styles.secondaryAction} onClick={() => setSelected(activeRuns.map((run) => run.id))}>Select all</button></div><div className={styles.runChoices}>{activeRuns.map((run) => <label key={run.id}><input type="checkbox" checked={selected.includes(run.id)} onChange={() => toggleRun(run.id)} />{run.label} <small>({experimentTitle(run.experimentId)})</small></label>)}</div>{selectedRuns.length > 1 && <><label className={styles.baseline}>Baseline <select value={baseline && selected.includes(baseline) ? baseline : selectedRuns[0].id} onChange={(event) => setBaseline(event.target.value)}>{selectedRuns.map((run) => <option key={run.id} value={run.id}>{run.label}</option>)}</select></label><label className={styles.checkbox}><input type="checkbox" checked={diffOnly} onChange={(event) => setDiffOnly(event.target.checked)} />Diff only</label>{incompatibleMetrics.map((id) => <p className={styles.warning} key={id}>Compatibility warning: metric {id} uses incompatible units across evaluation plans.</p>)}<div className={styles.tableScroll}><table><thead><tr><th>Run</th>{activeMetrics.map(({ metric, planId }) => <th key={`${planId}-${metric.id}`}><span className={styles.metricIdentity}><strong>{metric.label}</strong><code>{metric.id}</code><small>{metric.direction} · {metric.unit}</small></span></th>)}</tr></thead><tbody>{selectedRuns.map((run) => { const baseRun = selectedRuns.find((item) => item.id === (baseline || selectedRuns[0].id)); const changed = activeMetrics.filter(({ metric }) => finiteValue(run.metrics?.[metric.id]) !== finiteValue(baseRun?.metrics?.[metric.id])); if (diffOnly && run.id !== baseRun?.id && !changed.length && JSON.stringify(run.parameters) === JSON.stringify(baseRun?.parameters)) return null; return <tr key={run.id} className={run.id === baseRun?.id ? styles.baselineRow : changed.length ? styles.changedRow : undefined}><th><span className={styles.metricIdentity}><strong>{run.label}</strong><code>{run.id}</code></span>{run.id === baseRun?.id && <span className={styles.baselineBadge}>Baseline</span>}<small>{successSummary(run, props.entries.find((entry) => entry.slug === props.experiments.find((experiment) => experiment.id === run.experimentId)?.experimentSpec?.evaluationPlan)?.evaluationPlan?.successCriteria ?? [])}</small>{run.id !== baseRun?.id && <small>Δ {baseRun?.label}: {activeMetrics.map(({ metric, planId }) => { const current = finiteValue(run.metrics?.[metric.id]), reference = finiteValue(baseRun?.metrics?.[metric.id]); if (diffOnly && current === reference) return null; const relative = Number.isFinite(current) && Number.isFinite(reference) && reference !== 0 ? ` (${(((current! - reference!) / Math.abs(reference!)) * 100).toFixed(2)}%)` : ""; return <span key={`${planId}-${metric.id}`}>{metric.id} {improvement(current, reference, metric.direction, metric.threshold)}{relative}; </span>; })}</small>}</th>{activeMetrics.map(({ metric, planId }) => { const value = finiteValue(run.metrics?.[metric.id]); return diffOnly && value === finiteValue(baseRun?.metrics?.[metric.id]) ? null : <td key={`${planId}-${metric.id}`}><span className={styles.metricValue}>{value ?? "—"}</span> <small>{metric.unit}</small></td>; })}</tr>; })}</tbody></table></div><div className={styles.diffOnly}><strong>Parameter diff</strong>{[...new Set(selectedRuns.flatMap((run) => Object.keys(run.parameters ?? {})))].map((key) => { const values = [...new Set(selectedRuns.map((run) => JSON.stringify(run.parameters?.[key] ?? null)))]; return values.length > 1 ? <span key={key}>{key}: {selectedRuns.map((run) => `${run.label}=${JSON.stringify(run.parameters?.[key] ?? null)}`).join(" · ")}</span> : null; })}</div><ControlledCheck runs={selectedRuns} experiments={props.experiments} baselineId={baseline || selectedRuns[0].id} /><p className={styles.note}>Measurements and predefined criteria are shown for review. Observaire does not choose an overall winner.</p></>}{selectedRuns.length < 2 && <p>Select at least two runs to build the metric matrix.</p>}</section>}

    {activeView === "ablations" && <section className="panel"><h2>Ablation plans</h2>{props.experiments.flatMap((experiment) => {
      const plan = props.entries.find((entry) => entry.slug === experiment.experimentSpec?.evaluationPlan);
      const definitions = (plan as typeof plan & { evaluationPlan?: { ablations?: Array<Record<string, unknown>> } })?.evaluationPlan?.ablations ?? [];
      return definitions.map((item, index) => {
        const controlled = Array.isArray(item.controlledVariables) ? item.controlledVariables : Array.isArray(item.controlledParameters) ? item.controlledParameters : [];
        return <article className={styles.ablation} key={`${experiment.slug}-${index}`}><span className="kicker">{experiment.title}</span><h3>{String(item.label ?? item.id ?? `Ablation ${index + 1}`)}</h3><p>Baseline/control: {String(item.baseline ?? item.control ?? "Not defined")}</p><p>Changed factor: {String(item.factor ?? "Not defined")}</p><p>Controlled variables: {controlled.length ? controlled.map(String).join(", ") : "Not defined"}</p><AblationDelta runs={activeRuns.filter((run) => run.experimentId === experiment.id)} factor={String(item.factor ?? "")} baseline={String(item.baseline ?? item.control ?? "")} controlled={controlled.map(String)} /></article>;
      });
    })}{!props.experiments.some((experiment) => props.entries.some((entry) => entry.slug === experiment.experimentSpec?.evaluationPlan && Boolean((entry as typeof entry & { evaluationPlan?: { ablations?: unknown[] } }).evaluationPlan?.ablations?.length))) && <p>Evaluation plans do not define ablations yet.</p>}</section>}

    {activeView === "metrics" && <section className="panel"><h2>Project metric dictionary</h2><div className={styles.tableScroll}><table><thead><tr><th>Metric</th><th>Role</th><th>Direction</th><th>Unit</th><th>Aggregation</th><th>Threshold</th><th>Experiments</th><th>Runs</th></tr></thead><tbody>{activeMetrics.map(({ metric, planId, experimentIds }) => <tr key={`${planId}-${metric.id}`}><th><span className={styles.metricIdentity}><a href={`#metric-${metric.id}`}>{metric.label}</a><code>{metric.id}</code><small>{metric.direction} · {metric.unit}</small><small>Aliases: {metric.aliases.join(", ") || "none"}</small></span></th><td>{metric.role}</td><td>{metric.direction}</td><td>{metric.unit}</td><td>{metric.aggregation}</td><td>{metric.threshold === undefined ? "—" : String(metric.threshold)}</td><td>{experimentIds.map((id) => <Link key={id} href={`/experiments/${encodeURIComponent(id)}`}>{experimentTitle(id)} </Link>)}</td><td>{activeRuns.filter((run) => run.experimentId && experimentIds.some((id) => id === run.experimentId) && run.metrics?.[metric.id]).length}</td></tr>)}</tbody></table></div>{activeMetrics.map(({ metric, planId, experimentIds }) => { const plan = props.entries.find((entry) => (entry.id ?? entry.slug) === planId); const history = activeRuns.filter((run) => experimentIds.includes(run.experimentId) && Boolean(run.metrics?.[metric.id])); return <article id={`metric-${metric.id}`} className={styles.metricDetail} key={`${planId}-${metric.id}`}><h3>{metric.label}</h3><p>{metric.description || `${metric.direction} · ${metric.unit} · ${metric.aggregation}`}</p><small>Definition from evaluation plan <Link href={`/progress/${encodeURIComponent(plan?.slug ?? planId)}`}>{plan?.title ?? planId}</Link></small><p>Experiments: {experimentIds.map((id) => <Link key={id} href={`/experiments/${encodeURIComponent(id)}`}>{experimentTitle(id)} </Link>)}</p><div className={styles.sparkline} role="img" aria-label={`${metric.label} values over ${history.length} runs`}>{history.map((run) => <span key={run.manifest} title={`${run.label}: ${run.metrics?.[metric.id]?.value} ${metric.unit}`} style={{ height: `${Math.min(100, Math.max(8, Math.abs(run.metrics?.[metric.id]?.value ?? 0) * 100))}%` }} />)}</div><div className={styles.tableScroll}><table><thead><tr><th>Run history</th><th>Value</th><th>Source</th></tr></thead><tbody>{history.map((run) => <tr key={run.manifest}><th><Link href={`/experiments/${encodeURIComponent(run.experimentId)}/runs/${encodeURIComponent(run.id)}`}>{run.label}</Link></th><td>{run.metrics?.[metric.id]?.value} {metric.unit}</td><td>{String(run.metrics?.[metric.id]?.source?.file ?? run.metrics?.[metric.id]?.source?.kind ?? "unknown")}</td></tr>)}</tbody></table></div></article>; })}
      <section className={styles.candidates}><h3>Candidate metric definitions</h3><p>Markdown discovery is advisory. Review the source and explicitly adopt a structured definition in an evaluation plan.</p>{props.entries.flatMap((entry) => (entry.candidateMetricDefinitions ?? []).map((candidate, index) => <article key={`${entry.slug}-${index}`}><strong>{candidate.heading}</strong><pre>{candidate.text}</pre><Link href={`/progress/${encodeURIComponent(entry.slug)}`}>Open {entry.title} to review and adopt</Link></article>))}{!props.entries.some((entry) => entry.candidateMetricDefinitions?.length) && <p>No Markdown candidates found.</p>}</section>
    </section>}

    {activeView === "data" && <DataPanel projectId={props.projectId} experiments={props.experiments} metrics={activeMetrics} onFeedback={setFeedback} />}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
  </section>;
}

function ControlledCheck({ runs, experiments, baselineId }: { runs: Run[]; experiments: Experiment[]; baselineId: string }) {
  const baseline = runs.find((run) => run.id === baselineId);
  const declared = new Set(runs.flatMap((run) => experiments.find((experiment) => experiment.id === run.experimentId)?.experimentSpec?.controlledVariables ?? []));
  const differing = [...declared].filter((name) => new Set(runs.map((run) => JSON.stringify(run.parameters?.[name] ?? null))).size > 1);
  const missing = [...declared].filter((name) => runs.some((run) => !(name in (run.parameters ?? {}))));
  const datasets = new Set(runs.map((run) => JSON.stringify(experiments.find((experiment) => experiment.id === run.experimentId)?.experimentSpec?.datasets ?? [])));
  return <div className={styles.diffOnly}><strong>Controlled-variable check</strong><span>Baseline: {baseline?.label ?? "unavailable"}</span>{differing.length || missing.length ? <span className={styles.bad}>Potentially confounded: {differing.length ? `declared controls differ: ${differing.join(", ")}` : ""}{differing.length && missing.length ? "; " : ""}{missing.length ? `declared controls are missing from run parameters: ${missing.join(", ")}` : ""}</span> : <span className={styles.good}>Declared controls match across the selected runs.</span>}{datasets.size > 1 && <span className={styles.bad}>Compatibility warning: selected experiments reference different evaluation datasets or populations.</span>}</div>;
}

function AblationDelta({ runs, factor, baseline, controlled }: { runs: Run[]; factor: string; baseline: string; controlled: string[] }) {
  if (!factor) return <p>Potentially confounded: the plan does not identify the changed factor.</p>;
  const groups = new Map<string, Run[]>();
  for (const run of runs) { const key = JSON.stringify(run.parameters?.[factor] ?? "(missing)"); groups.set(key, [...(groups.get(key) ?? []), run]); }
  if (groups.size < 2) return <p>Potentially confounded: fewer than two factor variants are recorded.</p>;
  const baselineRun = runs.find((run) => run.id === baseline || run.label === baseline) ?? runs[0];
  const confounding = detectConfounding(baselineRun, runs.filter((run) => run.id !== baselineRun.id), factor, controlled);
  return <div className={styles.diffOnly}><strong>Baseline run: {baselineRun.label}</strong>{[...groups].map(([value, group]) => <span key={value}>{factor}={value}: {group.map((run) => `${run.label} · ${Object.entries(run.metrics ?? {}).map(([id, metric]) => { const base = baselineRun.metrics?.[id]?.value, delta = Number.isFinite(base) ? metric.value - (base as number) : undefined; return `${id}=${metric.value}${delta === undefined ? "" : ` (Δ ${delta > 0 ? "+" : ""}${delta.toPrecision(4)})`}`; }).join(", ")}`).join(" | ")}</span>)}{confounding.potentiallyConfounded ? <span className={styles.bad}>Potentially confounded; unexpected differing variables: {confounding.differing.join(", ") || "none"}{confounding.missingControls.length ? `; declared controls not recorded: ${confounding.missingControls.join(", ")}` : ""}</span> : <span className={styles.good}>No unexpected parameter differences detected beyond the declared ablation factor.</span>}</div>;
}

function DataPanel({ projectId, experiments, metrics, onFeedback }: { projectId: string; experiments: Experiment[]; metrics: Props["metrics"]; onFeedback: (message: string) => void }) {
  const [mode, setMode] = useState<"manual" | "import">("manual"), [experimentId, setExperimentId] = useState(experiments[0]?.id ?? ""), [runId, setRunId] = useState(""), [runLabel, setRunLabel] = useState(""), [manual, setManual] = useState<Record<string, string>>({}), [parametersJson, setParametersJson] = useState("{}"), [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<Preview | null>(null), [rowMode, setRowMode] = useState(""), [runIdColumn, setRunIdColumn] = useState(""), [timeColumn, setTimeColumn] = useState(""), [metricMapping, setMetricMapping] = useState<Record<string, string>>({}), [parameterColumns, setParameterColumns] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const definitions = useMemo(() => metrics.filter(({ experimentIds }) => experimentIds.includes(experimentId)).map(({ metric }) => metric), [metrics, experimentId]);
  const selectedExperiment = experiments.find((item) => item.id === experimentId);

  async function previewImport() {
    if (!file || !selectedExperiment) return;
    setBusy(true); onFeedback("");
    try {
      const form = new FormData(); form.set("file", file); form.set("projectId", projectId); form.set("experimentId", experimentId);
      const response = await fetch("/api/experiments/import/preview", { method: "POST", body: form });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not preview file.");
      setPreview(body); setMetricMapping(Object.fromEntries(Object.entries(body.suggestions as Record<string, { metricId: string }>).map(([column, suggestion]) => [column, suggestion.metricId])));
      setRowMode("");
    } catch (error) { onFeedback(error instanceof Error ? error.message : "Import preview failed."); }
    finally { setBusy(false); }
  }
  async function saveManual() {
    if (!selectedExperiment) return;
    const metricsPayload = Object.fromEntries(definitions.filter((metric) => manual[metric.id] !== undefined && manual[metric.id] !== "").map((metric) => [metric.id, { value: Number(manual[metric.id]), source: { kind: "manual", note: notes.trim() || "Manually measured and entered by the researcher." } }]));
    if (!Object.keys(metricsPayload).length) { onFeedback("Enter at least one metric value."); return; }
    setBusy(true);
    try {
      const parameters = JSON.parse(parametersJson);
      if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) throw new Error("Parameters must be a JSON object.");
      const response = await fetch("/api/experiments/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, experimentId, runId: runId || `manual-${Date.now()}`, label: runLabel || "Manual run", status: "complete", parameters, metrics: metricsPayload, ...(notes ? { notes } : {}) }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save run.");
      onFeedback(`Saved run ${body.run.id}.`); setRunId(""); setManual({});
    } catch (error) { onFeedback(error instanceof Error ? error.message : "Manual run save failed."); }
    finally { setBusy(false); }
  }
  async function confirmImport() {
    if (!file || !preview || !selectedExperiment || !rowMode) { onFeedback("Preview the file, choose row semantics, and confirm metric mappings first."); return; }
    const metricMappings = Object.entries(metricMapping).filter(([, metricId]) => metricId).map(([column, metricId]) => ({ column, metricId }));
    if (!metricMappings.length) { onFeedback("Map at least one source column to a canonical metric ID."); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.set("file", file); form.set("mapping", JSON.stringify({ projectId, experimentId, label: runLabel, rowMode, runIdColumn, timeColumn, parameterColumns, metricMappings }));
      const response = await fetch("/api/experiments/runs", { method: "POST", body: form });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not save imported runs.");
      onFeedback(`Saved ${body.count} run${body.count === 1 ? "" : "s"}. The original ${file.name} file is retained with the run data.`); setPreview(null); setFile(null); setMetricMapping({});
    } catch (error) { onFeedback(error instanceof Error ? error.message : "Import save failed."); }
    finally { setBusy(false); }
  }
  return <section className="panel"><div className={styles.sectionHead}><div><h2>Run data</h2><p>Add a manual measurement or preview an import before confirming its durable write.</p></div><div className={styles.switch}><button className={mode === "manual" ? styles.selected : ""} onClick={() => setMode("manual")}>Manual</button><button className={mode === "import" ? styles.selected : ""} onClick={() => setMode("import")}>Import file</button></div></div>
    {!experiments.length && <p>Create a structured experiment and evaluation plan before recording runs.</p>}
    {experiments.length > 0 && <label className={styles.formField}>Experiment<select value={experimentId} onChange={(event) => { setExperimentId(event.target.value); setPreview(null); }} >{experiments.map((item) => <option key={item.slug} value={item.id}>{item.title}</option>)}</select></label>}
    {mode === "manual" && <div className={styles.formStack}><label className={styles.formField}>Run ID (lowercase letters, digits, hyphens)<input value={runId} onChange={(event) => setRunId(event.target.value)} placeholder="manual-run-01" /></label><label className={styles.formField}>Label<input value={runLabel} onChange={(event) => setRunLabel(event.target.value)} placeholder="Manual measurement" /></label>{definitions.map((metric) => <label className={styles.formField} key={metric.id}>{metric.label} · {metric.unit} · {metric.role}<input inputMode="decimal" type="number" step="any" value={manual[metric.id] ?? ""} onChange={(event) => setManual({ ...manual, [metric.id]: event.target.value })} /></label>)}<label className={styles.formField}>Parameters (JSON object)<textarea rows={4} value={parametersJson} onChange={(event) => setParametersJson(event.target.value)} /></label><label className={styles.formField}>Measurement notes / provenance<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Where and how these values were measured" /></label><button className={styles.primaryAction} disabled={busy || !selectedExperiment} onClick={() => void saveManual()}>Save run</button></div>}
    {mode === "import" && <div className={styles.formStack}><label className={styles.formField}>Original data file<input type="file" accept=".csv,.tsv,.json,.jsonl" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} /></label><button className={styles.secondaryAction} disabled={!file || busy || !selectedExperiment} onClick={() => void previewImport()}>{busy ? "Reading…" : "Preview rows"}</button>
      {preview && <>
        <p className={styles.note}>Detected {preview.format.toUpperCase()} · {preview.rowCount} rows · types are suggestions. Numeric columns are not treated as metrics automatically.</p>
        <div className={styles.tableScroll}><table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}<small>{preview.columnTypes[column]}</small></th>)}</tr></thead><tbody>{preview.rows.slice(0, 8).map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div>
        <label className={styles.formField}>Rows represent<select value={rowMode} onChange={(event) => setRowMode(event.target.value)}><option value="">Choose…</option><option value="runs">Runs (one run per row)</option><option value="observations">Observations / samples (aggregate into one run)</option><option value="time">Time / step measurements (keep original series and aggregate summary)</option></select></label>
        <label className={styles.formField}>Run label<input value={runLabel} onChange={(event) => setRunLabel(event.target.value)} placeholder="Imported evaluation" /></label>
        {rowMode === "runs" && <label className={styles.formField}>Run ID/label column (optional)<select value={runIdColumn} onChange={(event) => setRunIdColumn(event.target.value)}><option value="">Generate run-1, run-2…</option>{preview.columns.map((column) => <option key={column}>{column}</option>)}</select></label>}
        {rowMode === "time" && <label className={styles.formField}>Time/step column<select value={timeColumn} onChange={(event) => setTimeColumn(event.target.value)}><option value="">Use row number</option>{preview.columns.map((column) => <option key={column}>{column}</option>)}</select></label>}
        <h3>Map source columns to canonical metrics</h3>{preview.columns.map((column) => <label className={styles.formField} key={column}>{column} · {preview.columnTypes[column]}<select value={metricMapping[column] ?? ""} onChange={(event) => setMetricMapping({ ...metricMapping, [column]: event.target.value })}><option value="">Do not map as metric</option>{definitions.map((metric) => <option key={metric.id} value={metric.id}>{metric.id} · {metric.label}</option>)}</select></label>)}
        <h3>Parameter columns</h3>{preview.columns.map((column) => <label className={styles.checkbox} key={`param-${column}`}><input type="checkbox" checked={parameterColumns.includes(column)} onChange={() => setParameterColumns((current) => current.includes(column) ? current.filter((value) => value !== column) : [...current, column])} />Keep {column} as a parameter</label>)}
        <label className={styles.formField}>Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional import context" /></label>
        <p className={styles.note}>Review the preview, row meaning, and every metric mapping. The write happens only when you confirm.</p>
        <button className={styles.primaryAction} disabled={busy || !rowMode} onClick={() => void confirmImport()}>{busy ? "Saving…" : "Confirm and save run data"}</button>
      </>}
    </div>}
  </section>;
}
