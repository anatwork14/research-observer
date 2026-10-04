import { NewResearchWorkbench } from "@/components/NewResearchWorkbench";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries } from "@/lib/progress";

export default async function NewResearchPage() {
  const entries = await getProgressEntries();
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="new-research" />
      <main className="collection-shell new-research-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">New Research</p>
            <h1>From peer-reviewed literature to a reviewed, testable research workspace.</h1>
            <p>
              Consensus supplies the scholarly discovery packet. You screen the papers. Codex proposes research gaps,
              falsifiable hypotheses, and experiment designs. A final review step shows the exact Markdown scaffold before
              anything is written into the workspace.
            </p>
          </div>
          <span className="collection-count">Consensus → Codex → Review</span>
        </header>
        <NewResearchWorkbench />
      </main>
    </div>
  );
}
