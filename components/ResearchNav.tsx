"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { slug: string; order: number; title: string; status?: string };

export function ResearchNav({
  entries,
  activeSlug,
  projectLabel,
}: {
  entries: Item[];
  activeSlug: string;
  projectLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => `${entry.order} ${entry.title} ${entry.status ?? ""}`.toLowerCase().includes(needle));
  }, [entries, query]);

  return (
    <aside className="left-rail panel" id="research-sidebar">
      <div className="rail-heading">
        <div><span className="kicker">Project progress</span><h2>{projectLabel || "Research log"}</h2></div>
        <span className="count-badge">{String(entries.length).padStart(2, "0")}</span>
      </div>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter project notes…" />
      </label>
      <nav className="progress-list" aria-label={projectLabel ? `${projectLabel} research progress` : "Research progress"}>
        {visible.map((entry) => (
          <Link key={entry.slug} href={`/progress/${entry.slug}`} className={`progress-link ${entry.slug === activeSlug ? "active" : ""}`}>
            <span className="progress-number">{String(entry.order).padStart(2, "0")}</span>
            <span className="progress-copy"><strong>{entry.title}</strong><small>{entry.status ?? "research note"}</small></span>
            <i aria-hidden="true" />
          </Link>
        ))}
        {!visible.length && <p className="quiet">No matching notes.</p>}
      </nav>
      <p className="rail-tip"><code>XX_name.md</code> controls ordering inside this project folder.</p>
    </aside>
  );
}
