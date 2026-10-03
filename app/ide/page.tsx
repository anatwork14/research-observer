import type { Metadata } from "next";
import { LatexCitationLauncher } from "@/components/LatexCitationLauncher";
import { LatexCodexAssistant } from "@/components/LatexCodexAssistant";
import { LatexDeepLinkCursor } from "@/components/LatexDeepLinkCursor";
import { LatexEditorAssistant } from "@/components/LatexEditorAssistant";
import { LatexWorkbench } from "@/components/LatexWorkbench";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LaTeX IDE · Observaire",
  description: "Project-scoped LaTeX authoring, research citations, CodeMirror, optional TexLab language intelligence, Codex Ask/Draft plus reviewed Act patches, compilation, PDF preview, diagnostics, SyncTeX, and manuscript-location navigation.",
};

export default async function IdePage({
  searchParams,
}: {
  searchParams: Promise<{ research?: string; file?: string; line?: string }>;
}) {
  const [query, workspace] = await Promise.all([searchParams, getResearchWorkspace()]);
  const requested = typeof query.research === "string" ? query.research : "";
  const requestedFile = typeof query.file === "string" && query.file.trim() ? query.file.trim() : undefined;
  const parsedLine = typeof query.line === "string" ? Number.parseInt(query.line, 10) : Number.NaN;
  const initialLine = Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : undefined;
  const selectedProject = workspace.projects.find((project) => project.id === requested)
    ?? workspace.projects.find((project) => project.id === "default")
    ?? workspace.projects[0];
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const projectId = selectedProject?.id ?? "default";

  return (
    <div className="site-shell pdf-site-shell">
      <WorkspaceHeader entries={navEntries} active="ide" />
      <LatexWorkbench projectId={projectId} initialFile={requestedFile} initialLine={initialLine} />
      <LatexDeepLinkCursor file={requestedFile} line={initialLine} />
      <LatexEditorAssistant projectId={projectId} />
      <LatexCodexAssistant projectId={projectId} />
      <LatexCitationLauncher projectId={projectId} />
    </div>
  );
}
