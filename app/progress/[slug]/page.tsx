import type { Metadata } from "next";
import Link from "next/link";
import GithubSlugger from "github-slugger";
import { notFound, redirect } from "next/navigation";
import { NoteDirectEditor } from "@/components/NoteDirectEditor";
import { ResearchNav } from "@/components/ResearchNav";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { ResearchAssistPanel } from "@/components/ResearchAssistPanel";
import { getProgressEntries, getProgressEntry, getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const entries = await getProgressEntries();
  const slugs = new Set(entries.flatMap((entry) => [entry.slug, ...entry.aliases]));
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getProgressEntry(slug);
  return entry ? { title: `${entry.title} · Observaire`, description: entry.summary } : {};
}

function normalizeHeading(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function stripLeadingTitle(content: string, title: string) {
  const match = content.match(/^\s*#\s+(.+?)(?:\r?\n)+/);
  if (!match) return content;
  return normalizeHeading(match[1]) === normalizeHeading(title)
    ? content.slice(match[0].length)
    : content;
}

function extractHeadings(content: string) {
  const slugger = new GithubSlugger();
  return [...content.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => {
    const title = match[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    return { level: match[1].length, title, id: slugger.slug(title) };
  });
}

export default async function ProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getResearchWorkspace();
  const entries = workspace.entries;
  const entry = entries.find((item) => item.slug === slug || item.aliases.includes(slug)) ?? null;
  if (!entry) notFound();
  if (slug !== entry.slug) redirect(`/progress/${entry.slug}`);

  const project = workspace.projects.find((item) => item.id === entry.research);
  const projectEntries = entries.filter((item) => item.research === entry.research);
  const index = projectEntries.findIndex((item) => item.slug === entry.slug);
  const previous = index > 0 ? projectEntries[index - 1] : null;
  const next = index < projectEntries.length - 1 ? projectEntries[index + 1] : null;
  const references = entries.filter((item) => entry.linkedSlugs.includes(item.slug));
  const backlinks = entries.filter((item) => entry.backlinks.includes(item.slug));
  const outgoingTyped = entry.relationships
    .map((relation) => ({ relation, target: entries.find((item) => item.slug === relation.target) }))
    .filter((item) => item.target);
  const incomingTyped = entry.incomingRelationships
    .map((relation) => ({ relation, source: entries.find((item) => item.slug === relation.source) }))
    .filter((item) => item.source);
  const neighbors = [previous, next].filter(Boolean);
  const linkMap = Object.fromEntries([
    ...entries.flatMap((item) => [
      [item.slug, item.slug],
      ...item.aliases.map((alias) => [alias, item.slug]),
    ]),
    ...projectEntries.map((item) => [item.fileSlug, item.slug]),
  ]);
  const bodyContent = stripLeadingTitle(entry.content, entry.title);
  const headings = extractHeadings(bodyContent);

  return (
    <div className="site-shell">
      <WorkspaceHeader
        entries={entries.map(({ slug: itemSlug, order, title, status }) => ({ slug: itemSlug, order, title, status }))}
        active="notes"
        showWorkspaceControls
      />

      <section className="note-overview panel">
        <div className="note-heading-row">
          <div>
            <p className="eyebrow">{project?.label ?? entry.research} / {String(entry.order).padStart(2, "0")}</p>
            <h1>{entry.title}</h1>
            {entry.summary && <p className="note-summary">{entry.summary}</p>}
          </div>
          {entry.status && <span className="status-chip">{entry.status}</span>}
        </div>
        <div className="note-meta">
          {entry.date && <span>{entry.date}</span>}
          <Link href={`/insights?research=${encodeURIComponent(entry.research)}`} className="research-project-chip">{project?.label ?? entry.research}</Link>
          {entry.type && <span>{entry.type}</span>}
          <span>{entry.words.toLocaleString()} words</span>
          <span>{entry.readingMinutes} min read</span>
          {entry.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
        </div>
      </section>

      <main className="workspace-grid">
        <ResearchNav
          entries={projectEntries.map(({ slug: itemSlug, order, title, status }) => ({ slug: itemSlug, order, title, status }))}
          activeSlug={entry.slug}
          projectLabel={project?.label}
        />

        <section className="reader panel">
          <NoteDirectEditor
            slug={entry.slug}
            filename={entry.filename}
            displayContent={bodyContent}
            linkMap={linkMap}
          />
          <footer className="reader-footer">
            <span>{entry.words.toLocaleString()} words</span><span>·</span><span>{entry.readingMinutes} min</span>
            <div className="page-arrows">
              {previous && <Link href={`/progress/${previous.slug}`}>← {String(previous.order).padStart(2, "0")}</Link>}
              {next && <Link href={`/progress/${next.slug}`}>{String(next.order).padStart(2, "0")} →</Link>}
            </div>
          </footer>
        </section>

        <aside className="right-rail" id="research-context-sidebar">
          <section className="side-card panel">
            <span className="kicker">On this page</span>
            <nav className="outline-list">
              {headings.length ? headings.map((heading) => <a key={`${heading.id}-${heading.level}`} className={`level-${heading.level}`} href={`#${heading.id}`}>{heading.title}</a>) : <span className="quiet">No headings yet.</span>}
            </nav>
          </section>

          <section className="side-card panel">
            <span className="kicker">Connections</span>
            <h3>Research relationships</h3>

            <div className="connection-group typed-connections">
              <span className="connection-group-title">→ Typed relationships</span>
              <div className="typed-relationship-list">
                {outgoingTyped.length ? outgoingTyped.map(({ relation, target }) => target && (
                  <Link key={`${relation.type}-${target.slug}`} href={`/progress/${target.slug}`}>
                    <em>{relation.type}</em><span>{target.title}</span>
                  </Link>
                )) : <span className="connection-empty">No typed outgoing relationships.</span>}
              </div>
            </div>

            <div className="connection-group typed-connections">
              <span className="connection-group-title">← Incoming typed</span>
              <div className="typed-relationship-list">
                {incomingTyped.length ? incomingTyped.map(({ relation, source }) => source && (
                  <Link key={`${relation.type}-${source.slug}`} href={`/progress/${source.slug}`}>
                    <em>{relation.type}</em><span>{source.title}</span>
                  </Link>
                )) : <span className="connection-empty">No typed incoming relationships.</span>}
              </div>
            </div>

            <div className="connection-group">
              <span className="connection-group-title">← Referenced by</span>
              <div className="connection-list">
                {backlinks.length ? backlinks.map((item) => (
                  <Link key={item.slug} href={`/progress/${item.slug}`}><span>{String(item.order).padStart(2, "0")}</span>{item.title}</Link>
                )) : <span className="connection-empty">No backlinks yet.</span>}
              </div>
            </div>

            <div className="connection-group">
              <span className="connection-group-title">→ References</span>
              <div className="connection-list">
                {references.length ? references.map((item) => (
                  <Link key={item.slug} href={`/progress/${item.slug}`}><span>{String(item.order).padStart(2, "0")}</span>{item.title}</Link>
                )) : <span className="connection-empty">No explicit note links.</span>}
              </div>
            </div>

            <div className="connection-group">
              <span className="connection-group-title">≈ Sequence neighbors</span>
              <div className="connection-list">
                {neighbors.map((item) => item && (
                  <Link key={item.slug} href={`/progress/${item.slug}`}><span>{String(item.order).padStart(2, "0")}</span>{item.title}</Link>
                ))}
              </div>
            </div>
          </section>

          <ResearchAssistPanel
            defaultConsensusQuery={[entry.title, entry.summary].filter(Boolean).join(". ")}
            codexContext={{ note: { slug: entry.slug, title: entry.title, filename: entry.filename, research: entry.research } }}
          />

          <section className="side-card panel syntax-card">
            <span className="kicker">Media support</span>
            <p>Use normal Markdown image syntax for PNG, JPG, SVG, GIF, WebP, AVIF, PDF, MP4/WebM, MP3/WAV and more.</p>
            <code>![caption](figures/result.svg)</code>
          </section>
        </aside>
      </main>

      <footer className="site-footer"><span>OBSERVAIRE</span><span>Markdown + GFM + KaTeX · ordered per project folder</span></footer>
    </div>
  );
}
