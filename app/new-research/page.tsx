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
            <h1>From peer-reviewed literature to a testable research plan.</h1>
            <p>
              Consensus supplies the scholarly evidence packet. You screen the papers. Codex then derives research gaps,
              falsifiable hypotheses, and experiment designs from only the selected literature.
            </p>
          </div>
          <span className="collection-count">Consensus → Codex</span>
        </header>
        <NewResearchWorkbench />
      </main>
    </div>
  );
}
