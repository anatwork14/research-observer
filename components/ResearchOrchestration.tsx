import Link from "next/link";
import type {
  ResearchOrchestration as ResearchOrchestrationModel,
  ResearchOrchestrationProject,
  ResearchOrchestrationStatus,
} from "@/lib/research/orchestration.mjs";
import styles from "./ResearchOrchestration.module.css";

const STATUS_LABELS: Record<ResearchOrchestrationStatus, string> = {
  active: "Active",
  queued: "Queued",
  blocked: "Blocked",
  done: "Done",
  untracked: "Untracked",
};

function ProjectCard({ project }: { project: ResearchOrchestrationProject }) {
  return (
    <article className={styles.card} data-status={project.orchestrationStatus}>
      <div className={styles.cardTopline}>
        <span className={styles.statusBadge}>{STATUS_LABELS[project.orchestrationStatus]}</span>
        <span className={styles.objectCount}>{project.notes} objects</span>
      </div>

      <div className={styles.cardTitle}>
        <h3>{project.label}</h3>
        {project.dependencyState !== "clear" && (
          <span className={styles.dependencyState} data-state={project.dependencyState}>
            {project.dependencyState === "waiting" ? `Waiting on ${project.waitingOn.length}` : "Dependency issue"}
          </span>
        )}
      </div>
      <p>{project.description || "Research project"}</p>

      {project.next && (
        <div className={styles.nextStep}>
          <span>Next declared step</span>
          <strong>{project.next}</strong>
        </div>
      )}
      {project.note && <p className={styles.note}>{project.note}</p>}

      {project.dependencies.length > 0 && (
        <div className={styles.dependencies}>
          <span>Depends on</span>
          <div>
            {project.dependencies.map((dependency) => (
              <span key={dependency.id} className={styles.dependencyChip} data-done={dependency.done || undefined} data-missing={dependency.status === "missing" || undefined}>
                <b>{dependency.label}</b>
                <small>{dependency.status}{!dependency.selected && dependency.status !== "missing" ? " · outside scope" : ""}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      {project.latestActivity.length > 0 && (
        <div className={styles.activity}>
          <span>Latest dated work</span>
          <div>
            {project.latestActivity.map((entry) => (
              <Link key={entry.slug} href={`/progress/${entry.slug}`}>
                <strong>{entry.title}</strong>
                <small>{entry.date}{entry.type ? ` · ${entry.type}` : ""}</small>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <Link href={`/progress?research=${encodeURIComponent(project.id)}`}>Notes</Link>
        <Link href={`/insights?research=${encodeURIComponent(project.id)}`}>Insights</Link>
        <Link href={`/projects/${encodeURIComponent(project.id)}/experiments`}>Experiments</Link>
      </div>
    </article>
  );
}

export function ResearchOrchestration({ orchestration }: { orchestration: ResearchOrchestrationModel }) {
  const { summary, groups, edges, issues, statusOrder } = orchestration;

  return (
    <section className={styles.section} aria-labelledby="research-orchestration-title">
      <div className={styles.heading}>
        <div>
          <span className="kicker">Portfolio control plane</span>
          <h2 id="research-orchestration-title">Research orchestration</h2>
          <p>
            Status, dependencies, next steps, and notes are explicit project metadata. Observaire shows dependency context but never changes a declared project status automatically.
          </p>
        </div>
        <code>research-observer.config.json</code>
      </div>

      <div className={styles.summary} aria-label="Research orchestration summary">
        <article><span>Tracked streams</span><strong>{summary.tracked}</strong><small>{summary.untracked} untracked</small></article>
        <article><span>Active</span><strong>{summary.active}</strong><small>{summary.queued} queued</small></article>
        <article><span>Waiting</span><strong>{summary.waiting}</strong><small>declared dependencies not done</small></article>
        <article><span>Blocked</span><strong>{summary.blocked}</strong><small>explicitly declared</small></article>
        <article><span>Done</span><strong>{summary.done}</strong><small>explicitly declared</small></article>
        <article data-attention={summary.invalid > 0 || undefined}><span>Dependency issues</span><strong>{summary.invalid}</strong><small>missing, self, or cycle</small></article>
      </div>

      <div className={styles.board} aria-label="Research streams by declared status">
        {statusOrder.map((status) => (
          <section className={styles.column} key={status} data-status={status}>
            <header>
              <div><span className={styles.columnDot} /><strong>{STATUS_LABELS[status]}</strong></div>
              <b>{groups[status].length}</b>
            </header>
            <div className={styles.columnBody}>
              {groups[status].map((project) => <ProjectCard key={project.id} project={project} />)}
              {!groups[status].length && <p className={styles.empty}>No projects in this declared state.</p>}
            </div>
          </section>
        ))}
      </div>

      {(edges.length > 0 || issues.length > 0) && (
        <div className={styles.lowerGrid}>
          {edges.length > 0 && (
            <section className={`${styles.flow} panel`}>
              <header><span className="kicker">Explicit dependencies</span><h3>Research flow</h3></header>
              <div>
                {edges.map((edge, index) => (
                  <div className={styles.edge} key={`${edge.source}-${edge.target}-${index}`}>
                    <Link href={`/insights?research=${encodeURIComponent(edge.source)}`}>{edge.sourceLabel}</Link>
                    <span>depends on</span>
                    <Link href={`/insights?research=${encodeURIComponent(edge.target)}`}>{edge.targetLabel}</Link>
                    <small data-done={edge.done || undefined}>{edge.targetStatus}{!edge.targetSelected ? " · outside current scope" : ""}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {issues.length > 0 && (
            <section className={`${styles.issues} panel`} aria-label="Orchestration configuration issues">
              <header><span className="kicker">Configuration</span><h3>Dependency issues</h3></header>
              <div>
                {issues.map((issue, index) => (
                  <article key={`${issue.code}-${issue.project ?? "graph"}-${index}`}>
                    <code>{issue.code}</code>
                    <p>{issue.message}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {summary.tracked === 0 && (
        <p className={styles.help}>
          All projects are currently untracked. Add an optional <code>orchestration</code> object to a project entry in <code>research-observer.config.json</code> when you want to coordinate that stream explicitly.
        </p>
      )}
    </section>
  );
}
