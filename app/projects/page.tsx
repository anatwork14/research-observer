import Link from "next/link";
import { ProjectImportPanel } from "@/components/ProjectImportPanel";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { projectImportReason, projectImportWritable } from "@/lib/research/project-import.mjs";
import { getResearchWorkspace } from "@/lib/progress";
import styles from "./projects.module.css";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const workspace = await getResearchWorkspace();
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const projects = workspace.projects.filter((project) => project.notes > 0 || project.autoIndexed);
  const autoIndexed = projects.filter((project) => project.autoIndexed).length;
  const storageDirectory = String(workspace.config.progressDir || "progress");

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="projects" />
      <main className={`collection-shell ${styles.shell}`}>
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Research projects</p>
            <h1>Folders are projects.</h1>
            <p>Drop a folder of numbered Markdown notes into Observaire or copy it directly into the mounted research directory. No central project registry edit is required.</p>
          </div>
          <span className="collection-count">{projects.length} projects · {autoIndexed} folder-indexed</span>
        </header>

        <ProjectImportPanel
          enabled={projectImportWritable()}
          reason={projectImportReason()}
          storageDirectory={storageDirectory}
        />

        <section className={styles.rules} aria-label="Project folder convention">
          <article className="panel">
            <span>01</span>
            <div><strong>Name the folder</strong><small><code>protein-folding/</code> or <code>My Research Project/</code>. Observaire derives a stable project ID automatically.</small></div>
          </article>
          <article className="panel">
            <span>02</span>
            <div><strong>Number the notes</strong><small><code>00_question.md</code>, <code>01_literature.md</code>, <code>02_experiment.md</code>. Ordering is independent inside each project.</small></div>
          </article>
          <article className="panel">
            <span>03</span>
            <div><strong>Keep assets beside the notes</strong><small>PDFs, figures, datasets, and media can stay inside the same project tree and relative Markdown paths continue to resolve.</small></div>
          </article>
        </section>

        <section className={styles.projectSection}>
          <div className={styles.sectionHeading}>
            <div><span className="kicker">Live index</span><h2>Discovered projects</h2></div>
            <p>Folder-backed projects are rescanned from disk; config-defined projects remain supported for backward compatibility.</p>
          </div>
          <div className={styles.grid}>
            {projects.map((project) => (
              <article key={project.id} className={`${styles.card} panel`}>
                <div className={styles.cardTopline}>
                  <span className={project.autoIndexed ? styles.autoBadge : styles.configBadge}>{project.autoIndexed ? "Auto-indexed" : "Configured"}</span>
                  <small>{project.notes} objects</small>
                </div>
                <h3>{project.label}</h3>
                <p>{project.description || "Research project"}</p>
                <dl>
                  <div><dt>Active</dt><dd>{project.active}</dd></div>
                  <div><dt>Evidence</dt><dd>{project.evidence}</dd></div>
                  <div><dt>Experiments</dt><dd>{project.experiments}</dd></div>
                  <div><dt>Results</dt><dd>{project.results}</dd></div>
                </dl>
                {project.directory && <code className={styles.path}>{storageDirectory}/{project.directory}/</code>}
                <div className={styles.actions}>
                  <Link href={`/progress?research=${encodeURIComponent(project.id)}`}>Open notes</Link>
                  <Link href={`/insights?research=${encodeURIComponent(project.id)}`}>Insights</Link>
                </div>
              </article>
            ))}
            {!projects.length && (
              <div className={`${styles.empty} panel`}>
                <strong>No research projects indexed yet.</strong>
                <p>Import a folder above or create <code>{storageDirectory}/my-project/00_question.md</code> on the host filesystem.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
