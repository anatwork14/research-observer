import { SettingsPanel } from "@/components/SettingsPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const workspace = await getResearchWorkspace();
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="settings" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Profile and integrations</h1>
            <p>Manage local identity preferences, scholarly search, and Codex authorization from one controlled surface.</p>
          </div>
          <span className="collection-count">Profile · Consensus · Codex</span>
        </header>
        <SettingsPanel />
      </main>
    </div>
  );
}
