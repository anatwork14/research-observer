import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export default async function HealthPage() {
  const workspace = await getResearchWorkspace();
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const bySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));

  const checks = [
    {
      key: "unansweredQuestions",
      title: "Unanswered questions",
      description: "Questions with no incoming answers relationship.",
      slugs: workspace.health.unansweredQuestions,
    },
    {
      key: "experimentsWithoutResults",
      title: "Experiments without results",
      description: "Experiments that do not explicitly produce a result.",
      slugs: workspace.health.experimentsWithoutResults,
    },
    {
      key: "resultsWithoutExperiment",
      title: "Results without producing experiment",
      description: "Results with no incoming produces relationship.",
      slugs: workspace.health.resultsWithoutExperiment,
    },
    {
      key: "decisionsWithoutBasis",
      title: "Decisions without basis",
      description: "Decisions that do not declare what evidence/result they are based on.",
      slugs: workspace.health.decisionsWithoutBasis,
    },
    {
      key: "literatureMissingPdf",
      title: "Literature without PDF",
      description: "Literature notes without a local paper companion.",
      slugs: workspace.health.literatureMissingPdf,
    },
    {
      key: "literatureMissingDoi",
      title: "Literature without DOI",
      description: "Literature notes where no verified DOI is recorded.",
      slugs: workspace.health.literatureMissingDoi,
    },
    {
      key: "evidenceMissingSource",
      title: "Evidence without source",
      description: "Evidence notes missing a PDF source path.",
      slugs: workspace.health.evidenceMissingSource,
    },
    {
      key: "missingStableIds",
      title: "Notes without stable IDs",
      description: "Notes whose route identity still depends on the filename.",
      slugs: workspace.health.missingStableIds,
    },
  ];

  const clear = checks.filter((check) => check.slugs.length === 0).length;
  const orphanAssets = workspace.diagnostics.filter((item) => item.code === "asset-orphan");

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="health" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Health</p>
            <h1>Research integrity, not a vanity score.</h1>
            <p>Every card is a factual, inspectable condition derived from Markdown, relationships, sources, and compiler diagnostics.</p>
          </div>
          <span className="collection-count">{clear}/{checks.length} checks clear</span>
        </header>

        <section className="health-summary panel">
          <div><span>Compiler errors</span><strong>{workspace.stats.errors}</strong></div>
          <div><span>Warnings</span><strong>{workspace.stats.warnings}</strong></div>
          <div><span>Typed relations</span><strong>{workspace.stats.relationships}</strong></div>
          <div><span>Orphan assets</span><strong>{orphanAssets.length}</strong></div>
        </section>

        <section className="health-grid">
          {checks.map((check) => (
            <article key={check.key} className={`health-card panel ${check.slugs.length ? "attention" : "clear"}`}>
              <div className="health-card-heading">
                <span>{check.slugs.length ? "!" : "✓"}</span>
                <div><h2>{check.title}</h2><p>{check.description}</p></div>
                <strong>{check.slugs.length}</strong>
              </div>
              {check.slugs.length > 0 && (
                <div className="health-items">
                  {check.slugs.slice(0, 8).map((slug) => {
                    const entry = bySlug.get(slug);
                    return entry ? <Link key={slug} href={`/progress/${slug}`}>{entry.title}<span>{entry.type ?? "note"}</span></Link> : null;
                  })}
                  {check.slugs.length > 8 && <small>+ {check.slugs.length - 8} more</small>}
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="dashboard-card panel health-diagnostics">
          <div className="dashboard-card-heading"><div><span className="kicker">Compiler</span><h2>Diagnostics</h2></div></div>
          <div className="diagnostic-list">
            {workspace.diagnostics.map((item, index) => (
              <div key={`${item.code}-${item.file ?? index}`} className={`diagnostic-row ${item.severity}`}>
                <span>{item.severity === "error" ? "×" : "!"}</span>
                <div><strong>{item.code}</strong><small>{item.file ? `${item.file} · ` : ""}{item.message}</small></div>
              </div>
            ))}
            {!workspace.diagnostics.length && <div className="diagnostic-row"><span>✓</span><div><strong>No diagnostics</strong><small>The compiler found no workspace integrity issues.</small></div></div>}
          </div>
        </section>
      </main>
    </div>
  );
}
