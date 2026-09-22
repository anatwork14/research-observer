import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

const terminalStatuses = new Set(["complete", "archived"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp"]);

export default async function Home() {
  const workspace = await getResearchWorkspace();
  const { entries, assets, diagnostics, stats } = workspace;
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  const active = entries.filter((entry) => !terminalStatuses.has(entry.status ?? ""));
  const questions = entries.filter((entry) => entry.type === "question");
  const experiments = entries.filter((entry) => entry.type === "experiment");
  const results = entries.filter((entry) => entry.type === "result");
  const decisions = entries.filter((entry) => entry.type === "decision");
  const papers = assets.filter((asset) => asset.extension === ".pdf");
  const figures = assets.filter((asset) => imageExtensions.has(asset.extension));
  const recent = [...entries]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.order - a.order)
    .slice(0, 5);

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="overview" />

      <main className="dashboard-shell">
        <section className="dashboard-hero panel">
          <div>
            <p className="eyebrow">Research workspace</p>
            <h1>Observe the state of the research.</h1>
            <p>
              Markdown remains the source of truth. This overview surfaces the questions, experiments,
              evidence, decisions, and integrity signals already present in the workspace.
            </p>
          </div>
          <div className="dashboard-health" aria-label="Workspace health">
            <span className={stats.errors ? "health-dot error" : "health-dot"} />
            <strong>{stats.errors ? `${stats.errors} integrity errors` : "Workspace integrity clear"}</strong>
            <small>{stats.warnings} warnings · {stats.links} research links</small>
          </div>
        </section>

        <section className="metric-grid" aria-label="Research summary">
          <Link href="/progress" className="metric-card panel"><span>Notes</span><strong>{entries.length}</strong><small>{active.length} active</small></Link>
          <Link href="/progress?type=question" className="metric-card panel"><span>Questions</span><strong>{questions.length}</strong><small>research prompts</small></Link>
          <Link href="/progress?type=experiment" className="metric-card panel"><span>Experiments</span><strong>{experiments.length}</strong><small>{results.length} results</small></Link>
          <Link href="/papers" className="metric-card panel"><span>Papers</span><strong>{papers.length}</strong><small>PDF sources</small></Link>
          <Link href="/evidence" className="metric-card panel"><span>Evidence</span><strong>{figures.length}</strong><small>{assets.length} total assets</small></Link>
          <div className="metric-card panel"><span>Decisions</span><strong>{decisions.length}</strong><small>recorded choices</small></div>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-card panel">
            <div className="dashboard-card-heading"><div><span className="kicker">Now</span><h2>Active research</h2></div><Link href="/progress">Open log →</Link></div>
            <div className="dashboard-list">
              {(active.length ? active : entries).slice(0, 6).map((entry) => (
                <Link key={entry.slug} href={`/progress/${entry.slug}`}>
                  <span className="dashboard-order">{String(entry.order).padStart(2, "0")}</span>
                  <span><strong>{entry.title}</strong><small>{entry.summary || entry.type || "research note"}</small></span>
                  <em>{entry.status ?? entry.type ?? "note"}</em>
                </Link>
              ))}
              {!entries.length && <p className="quiet">Add <code>progress/00_start.md</code> to begin.</p>}
            </div>
          </div>

          <div className="dashboard-card panel">
            <div className="dashboard-card-heading"><div><span className="kicker">Recent</span><h2>Latest research</h2></div></div>
            <div className="dashboard-list compact">
              {recent.map((entry) => (
                <Link key={entry.slug} href={`/progress/${entry.slug}`}>
                  <span className="dashboard-order">{entry.date?.slice(5) ?? String(entry.order).padStart(2, "0")}</span>
                  <span><strong>{entry.title}</strong><small>{entry.type ?? "note"}</small></span>
                </Link>
              ))}
            </div>
          </div>

          <div className="dashboard-card panel">
            <div className="dashboard-card-heading"><div><span className="kicker">Integrity</span><h2>Workspace diagnostics</h2></div></div>
            <div className="diagnostic-list">
              {diagnostics.slice(0, 7).map((item, index) => (
                <div key={`${item.code}-${item.file ?? index}`} className={`diagnostic-row ${item.severity}`}>
                  <span>{item.severity === "error" ? "×" : "!"}</span>
                  <div><strong>{item.code}</strong><small>{item.file ? `${item.file} · ` : ""}{item.message}</small></div>
                </div>
              ))}
              {!diagnostics.length && <div className="diagnostic-row"><span>✓</span><div><strong>No diagnostics</strong><small>The compiler found no workspace integrity issues.</small></div></div>}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><span>RESEARCH OBSERVER</span><span>Observe · Read · Connect · Act</span></footer>
    </div>
  );
}
