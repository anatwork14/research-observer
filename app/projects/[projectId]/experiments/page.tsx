import { notFound } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { ExperimentWorkbench } from "@/components/ExperimentWorkbench";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function ProjectExperimentsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ view?: string }> }) {
  const [{ projectId }, query, workspace] = await Promise.all([params, searchParams, getResearchWorkspace()]);
  const project = workspace.projects.find((item) => item.id === projectId);
  if (!project) notFound();
  const entries = workspace.entries.filter((entry) => entry.research === projectId);
  const experiments = entries.filter((entry) => entry.type === "experiment");
  const runs = (workspace.experiments ?? []).filter((run) => run.project === projectId);
  const metrics = entries.filter((entry) => entry.type === "evaluation" && entry.evaluationPlan).flatMap((plan) => (plan.evaluationPlan?.metrics ?? []).map((metric) => ({ metric, planId: plan.id ?? plan.slug, experimentIds: experiments.filter((experiment) => experiment.experimentSpec?.evaluationPlan === plan.id).map((experiment) => experiment.id ?? experiment.slug) })));
  return <div className="site-shell"><WorkspaceHeader entries={workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }))} active="projects" /><main className="collection-shell"><ExperimentWorkbench projectId={projectId} projectLabel={project.label} view={query.view ?? "overview"} experiments={experiments} runs={runs} metrics={metrics} entries={entries} /></main></div>;
}
