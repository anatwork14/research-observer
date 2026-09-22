import Link from "next/link";
import type { ResearchEntry } from "@/lib/research/compiler.mjs";
import { diffResearchVersions } from "@/lib/research/analytics.mjs";

type VersionGroup = {
  id: string;
  title: string;
  research: string;
  versions: ResearchEntry[];
  edges: Array<{ newer: string; older: string }>;
};

function metricDelta(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function ResearchVersionExplorer({
  groups,
  baseSlug,
  compareSlug,
  selectedResearch,
}: {
  groups: VersionGroup[];
  baseSlug?: string;
  compareSlug?: string;
  selectedResearch: string[];
}) {
  if (!groups.length) {
    return (
      <div className="version-empty panel">
        <span className="kicker">Semantic versions</span>
        <h2>No explicit idea versions yet.</h2>
        <p>Use a typed <code>supersedes</code> relationship when a research object is a meaningful revision of an earlier idea. Research Observer will build the lineage and compare the Markdown versions here.</p>
        <pre>{`relationships:\n  - type: supersedes\n    target: earlier-hypothesis-id`}</pre>
      </div>
    );
  }

  const requestedSlug = compareSlug || baseSlug;
  const selectedGroup = groups.find((group) => requestedSlug && group.versions.some((entry) => entry.slug === requestedSlug)) ?? groups[0];
  const bySlug = new Map(selectedGroup.versions.map((entry) => [entry.slug, entry]));
  const base = (baseSlug && bySlug.get(baseSlug)) || selectedGroup.versions[0];
  const compare = (compareSlug && bySlug.get(compareSlug)) || selectedGroup.versions.at(-1)!;
  const diff = diffResearchVersions(base, compare);
  const selection = selectedResearch.join(",");

  return (
    <div className="version-workbench">
      <aside className="version-lineages panel">
        <div className="version-panel-heading"><span className="kicker">Lineages</span><h2>Idea evolution</h2><p>{groups.length} explicit version chain{groups.length === 1 ? "" : "s"}.</p></div>
        <nav>
          {groups.map((group) => (
            <div key={group.id} className="version-lineage">
              <div><strong>{group.title}</strong><small>{group.research} · {group.versions.length} versions</small></div>
              <div className="version-chain">
                {group.versions.map((entry, index) => (
                  <Link
                    key={entry.slug}
                    href={`/insights?view=versions&research=${encodeURIComponent(selection)}&base=${encodeURIComponent(group.versions[0].slug)}&compare=${encodeURIComponent(entry.slug)}`}
                    className={entry.slug === compare.slug ? "active" : ""}
                    title={entry.title}
                  >
                    <span>v{index + 1}</span>
                    <small>{entry.date ?? String(entry.order).padStart(2, "0")}</small>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <section className="version-compare panel">
        <header className="version-compare-heading">
          <div><span className="kicker">Compare versions</span><h2>{base.title} → {compare.title}</h2></div>
          <span>{diff.added} added · {diff.removed} removed</span>
        </header>

        <form className="version-selectors" method="get">
          <input type="hidden" name="view" value="versions" />
          <input type="hidden" name="research" value={selection} />
          <label><span>Base</span><select name="base" defaultValue={base.slug}>{selectedGroup.versions.map((entry) => <option value={entry.slug} key={entry.slug}>{entry.title} · {entry.date ?? entry.order}</option>)}</select></label>
          <span aria-hidden="true">→</span>
          <label><span>Compare</span><select name="compare" defaultValue={compare.slug}>{selectedGroup.versions.map((entry) => <option value={entry.slug} key={entry.slug}>{entry.title} · {entry.date ?? entry.order}</option>)}</select></label>
          <button type="submit">Compare</button>
        </form>

        <div className="version-delta-grid">
          <article><span>Words</span><strong>{base.words} → {compare.words}</strong><small>{metricDelta(compare.words - base.words)}</small></article>
          <article><span>Relationships</span><strong>{base.relationships.length} → {compare.relationships.length}</strong><small>{metricDelta(compare.relationships.length - base.relationships.length)}</small></article>
          <article><span>Assets</span><strong>{base.assets.length} → {compare.assets.length}</strong><small>{metricDelta(compare.assets.length - base.assets.length)}</small></article>
          <article><span>Status</span><strong>{base.status ?? "—"} → {compare.status ?? "—"}</strong><small>{base.research}</small></article>
        </div>

        <div className="version-diff-legend"><span className="added">+ Added</span><span className="removed">− Removed</span><span>Unchanged context</span>{diff.truncated && <em>Diff preview capped for robustness</em>}</div>
        <div className="version-diff" role="region" aria-label="Markdown version diff">
          {diff.lines.map((line, index) => (
            <div key={index} className={`version-diff-line ${line.type}`}>
              <span>{line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}</span>
              <code>{line.text || " "}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
