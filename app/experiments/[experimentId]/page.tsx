import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function ExperimentDetailPage({ params }: { params: Promise<{ experimentId: string }> }) {
  const [{ experimentId }, workspace] = await Promise.all([params, getResearchWorkspace()]);
  const experiment = workspace.entries.find((entry) => (entry.id === experimentId || entry.slug === experimentId) && entry.type === "experiment");
  if (!experiment) notFound();
  const plan = workspace.entries.find((entry) => entry.id === experiment.experimentSpec?.evaluationPlan && entry.type === "evaluation");
  const runs = (workspace.experiments ?? []).filter((run) => run.experimentId === experiment.id);
  const project = workspace.projects.find((item) => item.id === experiment.research);
  const metrics = plan?.evaluationPlan?.metrics ?? [];
  const factors = experiment.experimentSpec?.factors ?? [];
  const links = experiment.linkedSlugs.map((slug) => workspace.entries.find((entry) => entry.slug === slug)).filter(Boolean);
  const question = experiment.content.match(/^#{1,3}\s+(?:Question|Hypothesis)\s*\n+([\s\S]*?)(?=\n#{1,3}\s|$)/im)?.[1]?.trim();

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }))} active="projects" />
      <main className="collection-shell" style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
        <header className="collection-heading">
          <div><p className="eyebrow"><Link href={`/projects/${encodeURIComponent(experiment.research)}/experiments`}>{project?.label ?? experiment.research} · Experiments</Link></p><h1>{experiment.title}</h1><p>{experiment.summary}</p></div>
          <span className="collection-count">{runs.length} runs</span>
        </header>
        <section className="panel"><h2>Question / hypothesis</h2><p>{question || "See the related research note for the question this experiment addresses."}</p><p><Link href={`/progress/${encodeURIComponent(experiment.slug)}`}>Open related Markdown</Link></p></section>
        <section className="panel">
          <h2>Evaluation plan</h2>
          {plan ? <>
            <Link href={`/progress/${encodeURIComponent(plan.slug)}`}>{plan.title}</Link>
            <div style={{ overflowX: "auto", marginTop: ".75rem" }}><table><thead><tr><th>Metric</th><th>Role</th><th>Direction</th><th>Unit</th><th>Aggregation</th><th>Threshold</th></tr></thead>
              <tbody>{metrics.map((metric) => <tr key={metric.id}><th>{metric.label}<small>{metric.id}</small></th><td>{metric.role}</td><td>{metric.direction}</td><td>{metric.unit}</td><td>{metric.aggregation}</td><td>{metric.threshold === undefined ? "—" : String(metric.threshold)}</td></tr>)}</tbody>
            </table></div>
          </> : <p>This experiment has no structured evaluation plan yet.</p>}
        </section>
        <section className="panel">
          <h2>Variables and controls</h2><p><strong>Kind:</strong> {experiment.experimentSpec?.kind ?? "Legacy unstructured experiment"}</p>
          <h3>Factors</h3>
          {factors.length ? <ul>{factors.map((factor, index) => {
            const label = String(factor.label ?? factor.id ?? `Factor ${index + 1}`);
            const values = Array.isArray(factor.values) ? factor.values.map(String).join(", ") : "not specified";
            return <li key={index}>{label} · levels: {values}</li>;
          })}</ul> : <p>No structured factors defined.</p>}
          <h3>Controlled variables</h3>
          {experiment.experimentSpec?.controlledVariables?.length ? <ul>{experiment.experimentSpec.controlledVariables.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Not specified.</p>}
        </section>
        <section className="panel">
          <h2>Runs</h2>
          <p><Link href={`/projects/${encodeURIComponent(experiment.research)}/experiments?view=data`}>Add run or import data</Link> · <Link href={`/projects/${encodeURIComponent(experiment.research)}/experiments?view=compare`}>Compare runs</Link></p>
          {runs.map((run) => <article key={run.manifest} style={{ padding: ".6rem 0", borderTop: "1px solid var(--line)" }}>
            <Link href={`/experiments/${encodeURIComponent(experiment.id ?? experiment.slug)}/runs/${encodeURIComponent(run.id)}`}>{run.label}</Link>
            <small style={{ display: "block", color: "var(--muted)" }}>{run.status} · {run.timestamps?.createdAt}</small>
            <div>{Object.entries(run.metrics ?? {}).map(([id, value]) => <span key={id} style={{ marginRight: ".8rem" }}>{id}: {value.value}</span>)}</div>
          </article>)}
          {!runs.length && <p>No runs are recorded yet.</p>}
        </section>
        <section className="panel"><h2>Artifacts</h2>{runs.flatMap((run) => (run.artifacts ?? []).map((artifact, index) => <p key={`${run.id}-${index}`}>{String(artifact)}</p>))}{runs.every((run) => !(run.artifacts ?? []).length) && <p>No artifacts attached.</p>}</section>
        <section className="panel"><h2>Related Markdown</h2>{links.map((entry) => entry && <p key={entry.slug}><Link href={`/progress/${encodeURIComponent(entry.slug)}`}>{entry.title}</Link></p>)}{!links.length && <p>No body links found.</p>}</section>
      </main>
    </div>
  );
}
