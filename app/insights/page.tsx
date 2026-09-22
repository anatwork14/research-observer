import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import {
  ActivityLineChart,
  CrossProjectMatrix,
  DonutChart,
  HealthHeatmap,
  HorizontalBarChart,
  InsightCard,
  PipelineChart,
  ProjectCompositionChart,
} from "@/components/ResearchAnalyticsCharts";
import { ResearchTimeline } from "@/components/ResearchTimeline";
import { ResearchVersionExplorer } from "@/components/ResearchVersionExplorer";
import { buildResearchAnalytics } from "@/lib/research/analytics.mjs";
import { getResearchWorkspace } from "@/lib/progress";

type View = "overview" | "analytics" | "timeline" | "versions";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function projectSelection(value: string | string[] | undefined) {
  const raw = one(value);
  return raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function scopeHref(view: View, ids: string[], base?: string, compare?: string) {
  const params = new URLSearchParams();
  if (view !== "overview") params.set("view", view);
  if (ids.length) params.set("research", ids.join(","));
  if (view === "versions" && base) params.set("base", base);
  if (view === "versions" && compare) params.set("compare", compare);
  const query = params.toString();
  return `/insights${query ? `?${query}` : ""}`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workspace = await getResearchWorkspace();
  const requested = projectSelection(params.research);
  const rawView = one(params.view);
  const view: View = rawView === "analytics" || rawView === "timeline" || rawView === "versions" ? rawView : "overview";
  const analytics = buildResearchAnalytics(workspace, requested);
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const availableProjects = workspace.projects.filter((project) => project.notes > 0);
  const explicitlyScoped = requested.length > 0;
  const selected = new Set(analytics.researchIds);
  const base = one(params.base);
  const compare = one(params.compare);

  function toggled(projectId: string) {
    if (!explicitlyScoped) return [projectId];
    const next = new Set(analytics.researchIds);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    const values = next.size ? [...next] : availableProjects.map((project) => project.id);
    return values.length === availableProjects.length ? [] : values;
  }

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="insights" />

      <main className="collection-shell intelligence-shell">
        <header className="collection-heading intelligence-heading">
          <div>
            <p className="eyebrow">Research intelligence</p>
            <h1>See the portfolio, evolution, and evidence structure.</h1>
            <p>
              Explore one research project or several at once. Charts stay linked to the same project scope,
              while Timeline and Versions reveal how ideas evolve instead of flattening research into a single score.
            </p>
          </div>
          <span className="collection-count">{analytics.projects.length} project{analytics.projects.length === 1 ? "" : "s"} · {analytics.totals.notes} objects</span>
        </header>

        <section className="intelligence-controls panel">
          <nav className="intelligence-view-tabs" aria-label="Research intelligence view">
            {([
              ["overview", "Overview"],
              ["analytics", "Analytics"],
              ["timeline", "Timeline"],
              ["versions", "Versions"],
            ] as Array<[View, string]>).map(([key, label]) => (
              <Link key={key} href={scopeHref(key, explicitlyScoped ? analytics.researchIds : [], base, compare)} className={view === key ? "active" : undefined} aria-current={view === key ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>

          <div className="research-scope" aria-label="Research project scope">
            <span>Scope</span>
            <Link href={scopeHref(view, [], base, compare)} className={!explicitlyScoped ? "active" : undefined}>All projects</Link>
            {availableProjects.map((project) => (
              <Link
                key={project.id}
                href={scopeHref(view, toggled(project.id), base, compare)}
                className={explicitlyScoped && selected.has(project.id) ? "active" : undefined}
                title={project.description}
              >
                {project.label}
                <small>{project.notes}</small>
              </Link>
            ))}
          </div>
        </section>

        {view === "overview" && (
          <>
            <section className="intelligence-kpis" aria-label="Selected research statistics">
              <article className="panel"><span>Research objects</span><strong>{analytics.totals.notes}</strong><small>{analytics.totals.active} active</small></article>
              <article className="panel"><span>Evidence</span><strong>{analytics.totals.evidence}</strong><small>{analytics.totals.papers} literature notes</small></article>
              <article className="panel"><span>Typed relations</span><strong>{analytics.totals.relationships}</strong><small>{analytics.totals.crossProjectRelationships} cross-project</small></article>
              <article className="panel"><span>Research volume</span><strong>{compactNumber(analytics.totals.words)}</strong><small>words in source notes</small></article>
              <article className="panel"><span>Dated objects</span><strong>{analytics.totals.dated}</strong><small>{analytics.undatedEntries.length} outside timeline</small></article>
              <article className="panel"><span>Version chains</span><strong>{analytics.versionGroups.length}</strong><small>explicit supersedes lineages</small></article>
            </section>

            <section className="portfolio-project-grid">
              {analytics.projects.map((project) => (
                <Link key={project.id} href={scopeHref("analytics", [project.id])} className="portfolio-project-card panel">
                  <div className="portfolio-project-topline"><span>{project.label}</span><em>{project.active} active</em></div>
                  <strong>{project.notes} research objects</strong>
                  <div className="portfolio-progress" aria-label={`${project.completion}% complete or archived`}><i style={{ width: `${project.completion}%` }} /></div>
                  <div className="portfolio-project-stats">
                    <span><b>{project.questions}</b> questions</span>
                    <span><b>{project.experiments}</b> experiments</span>
                    <span><b>{project.results}</b> results</span>
                    <span><b>{project.evidence}</b> evidence</span>
                  </div>
                  <small>{project.latestDate ? `Latest dated work ${project.latestDate}` : "No dated work yet"} · {project.warnings} warnings</small>
                </Link>
              ))}
            </section>

            <section className="insight-chart-grid overview">
              <InsightCard eyebrow="Trend" title="Research activity" description="Dated objects over time; missing months remain visible rather than being compressed." className="wide">
                <ActivityLineChart data={analytics.activity} />
              </InsightCard>
              <InsightCard eyebrow="Portfolio" title="Project composition" description="Compare research-stage volume without collapsing projects into one composite score.">
                <ProjectCompositionChart projects={analytics.projects} />
              </InsightCard>
              <InsightCard eyebrow="Integrity" title="Health matrix" description="Counts of factual compiler health conditions by research project.">
                <HealthHeatmap rows={analytics.healthRows} />
              </InsightCard>
            </section>
          </>
        )}

        {view === "analytics" && (
          <section className="insight-chart-grid analytics">
            <InsightCard eyebrow="Composition" title="Research object types" description="What the selected research is made of.">
              <HorizontalBarChart data={analytics.types} ariaLabel="Research object type distribution" />
            </InsightCard>

            <InsightCard eyebrow="State" title="Status composition" description="Current workflow states across the selected portfolio.">
              <DonutChart data={analytics.statuses} ariaLabel="Research status composition" />
            </InsightCard>

            <InsightCard eyebrow="Flow" title="Research pipeline" description="Questions → hypotheses → experiments → results → evidence → decisions." className="wide">
              <PipelineChart data={analytics.pipeline} />
            </InsightCard>

            <InsightCard eyebrow="Semantics" title="Typed relationship mix" description="How research objects support, answer, derive from, contradict, or supersede one another.">
              <HorizontalBarChart data={analytics.relationships} ariaLabel="Typed relationship distribution" />
            </InsightCard>

            <InsightCard eyebrow="Trend" title="Research activity over time" description="Linked to the same project scope as every chart on this page." className="wide">
              <ActivityLineChart data={analytics.activity} />
            </InsightCard>

            <InsightCard eyebrow="Projects" title="Cross-project composition" description="Stacked stage counts make multiple researches comparable without hiding their structure." className="wide">
              <ProjectCompositionChart projects={analytics.projects} />
            </InsightCard>

            <InsightCard eyebrow="Integrity" title="Health heatmap" description="Darker cells indicate more compiler-detected conditions, not subjective quality.">
              <HealthHeatmap rows={analytics.healthRows} />
            </InsightCard>

            <InsightCard eyebrow="Connections" title="Cross-project dependency matrix" description="Typed relationships that cross research-project boundaries.">
              <CrossProjectMatrix projects={analytics.projects} edges={analytics.crossProject} />
            </InsightCard>
          </section>
        )}

        {view === "timeline" && (
          <section className="intelligence-timeline">
            <div className="intelligence-section-intro">
              <div><span className="kicker">Time + parallel work</span><h2>Research timeline</h2></div>
              <p>Aligned project lanes make overlaps and idea evolution visible. Dotted segments indicate explicit <code>supersedes</code> version lineage.</p>
            </div>
            <ResearchTimeline entries={analytics.timelineEntries} projects={analytics.projects} undatedEntries={analytics.undatedEntries} />
          </section>
        )}

        {view === "versions" && (
          <section className="intelligence-versions">
            <div className="intelligence-section-intro">
              <div><span className="kicker">Idea evolution</span><h2>Semantic version comparison</h2></div>
              <p>Research versions are explicit intellectual revisions linked with <code>supersedes</code>. Git remains the technical file history; this view focuses on how the research idea changed.</p>
            </div>
            <ResearchVersionExplorer groups={analytics.versionGroups} baseSlug={base} compareSlug={compare} selectedResearch={analytics.researchIds} />
          </section>
        )}
      </main>

      <footer className="site-footer"><span>RESEARCH OBSERVER</span><span>Portfolio · Analytics · Timeline · Versions</span></footer>
    </div>
  );
}
