import type { Metadata } from "next";
import Link from "next/link";
import GithubSlugger from "github-slugger";
import { notFound, redirect } from "next/navigation";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ResearchNav } from "@/components/ResearchNav";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { CodexPanel } from "@/components/CodexPanel";
import { getProgressEntries, getProgressEntry } from "@/lib/progress";

export async function generateStaticParams() {
  const entries = await getProgressEntries();
  const slugs = new Set(entries.flatMap((entry) => [entry.slug, ...entry.aliases]));
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getProgressEntry(slug);
  return entry ? { title: `${entry.title} · Research Observer`, description: entry.summary } : {};
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
  const entries = await getProgressEntries();
  const entry = entries.find((item) => item.slug === slug || item.aliases.includes(slug)) ?? null;
  if (!entry) notFound();
  if (slug !== entry.slug) redirect(`/progress/${entry.slug}`);

  const index = entries.findIndex((item) => item.slug === entry.slug);
  const previous = index > 0 ? entries[index - 1] : null;
  const next = index < entries.length - 1 ? entries[index + 1] : null;
  const references = entries.filter((item) => entry.linkedSlugs.includes(item.slug));
  const backlinks = entries.filter((item) => entry.backlinks.includes(item.slug));
  const neighbors = [previous, next].filter(Boolean);
  const linkMap = Object.fromEntries(
    entries.flatMap((item) => [
      [item.fileSlug, item.slug],
      [item.slug, item.slug],
      ...item.aliases.map((alias) => [alias, item.slug]),
    ]),
  );
  const bodyContent = stripLeadingTitle(entry.content, entry.title);
  const headings = extractHeadings(bodyContent);

  return (
    <div className="site-shell">
      <WorkspaceHeader
        entries={entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }))}
        active="notes"
        showWorkspaceControls
      />

      <section className="note-overview panel">
        <div className="note-heading-row">
          <div>
            <p className="eyebrow">Research progress / {String(entry.order).padStart(2, "0")}</p>
            <h1>{entry.title}</h1>
            {entry.summary && <p className="note-summary">{entry.summary}</p>}
          </div>
          {entry.status && <span className="status-chip">{entry.status}</span>}
        </div>
        <div className="note-meta">
          {entry.date && <span>{entry.date}</span>}
          {entry.type && <span>{entry.type}</span>}
          <span>{entry.words.toLocaleString()} words</span>
          <span>{entry.readingMinutes} min read</span>
          {entry.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
        </div>
      </section>

      <main className="workspace-grid">
        <ResearchNav entries={entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }))} activeSlug={entry.slug} />

        <section className="reader panel">
          <div className="reader-toolbar">
            <div><span className="file-chip">MD</span><code>{entry.filename}</code></div>
            <span className="readonly">source of truth</span>
          </div>
          <article><MarkdownRenderer content={bodyContent} linkMap={linkMap} /></article>
          <footer className="reader-footer">
            <span>{entry.words.toLocaleString()} words</span><span>·</span><span>{entry.readingMinutes} min</span>
            <div className="page-arrows">
              {previous && <Link href={`/progress/${previous.slug}`}>← {String(previous.order).padStart(2, "0")}</Link>}
              {next && <Link href={`/progress/${next.slug}`}>{String(next.order).padStart(2, "0")} →</Link>}
            </div>
          </footer>
        </section>

        <aside className="right-rail">
          <section className="side-card panel">
            <span className="kicker">On this page</span>
            <nav className="outline-list">
              {headings.length ? headings.map((heading) => <a key={`${heading.id}-${heading.level}`} className={`level-${heading.level}`} href={`#${heading.id}`}>{heading.title}</a>) : <span className="quiet">No headings yet.</span>}
            </nav>
          </section>

          <section className="side-card panel">
            <span className="kicker">Connections</span>
            <h3>Research relationships</h3>

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

          <section className="side-card panel codex-side-card">
            <CodexPanel context={{ note: { slug: entry.slug, title: entry.title, filename: entry.filename } }} />
          </section>

          <section className="side-card panel syntax-card">
            <span className="kicker">Media support</span>
            <p>Use normal Markdown image syntax for PNG, JPG, SVG, GIF, WebP, AVIF, PDF, MP4/WebM, MP3/WAV and more.</p>
            <code>![caption](figures/result.svg)</code>
          </section>
        </aside>
      </main>

      <footer className="site-footer"><span>RESEARCH OBSERVER</span><span>Markdown + GFM + KaTeX · ordered by filename</span></footer>
    </div>
  );
}
