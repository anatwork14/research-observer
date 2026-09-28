import type { Metadata } from "next";
import { LatexCitationLauncher } from "@/components/LatexCitationLauncher";
import { LatexWorkbench } from "@/components/LatexWorkbench";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LaTeX IDE · Observaire",
  description: "Project-scoped LaTeX authoring, research citations, compilation, PDF preview, diagnostics, and SyncTeX navigation.",
};

export default async function IdePage({
  searchParams,
}: {
  searchParams: Promise<{ research?: string }>;
}) {
  const [query, workspace] = await Promise.all([searchParams, getResearchWorkspace()]);
  const requested = typeof query.research === "string" ? query.research : "";
  const selectedProject = workspace.projects.find((project) => project.id === requested)
    ?? workspace.projects.find((project) => project.id === "default")
    ?? workspace.projects[0];
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const projectId = selectedProject?.id ?? "default";

  return (
    <div className="site-shell pdf-site-shell">
      <WorkspaceHeader entries={navEntries} active="ide" />
      <LatexWorkbench projectId={projectId} />
      <LatexCitationLauncher projectId={projectId} />
    </div>
  );
}
