"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./ResearchVersionCompare.module.css";

type Comparison = {
  id: string;
  older: { slug: string; title: string; date?: string; status?: string; words: number; href: string };
  newer: { slug: string; title: string; date?: string; status?: string; words: number; href: string };
  wordDelta: number;
  headings: { added: string[]; removed: string[] };
  diff: Array<{ kind: "unchanged" | "added" | "removed" | "ellipsis"; text: string }>;
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  truncated: boolean;
};

export function ResearchVersionCompare({ comparisons }: { comparisons: Comparison[] }) {
  const [selectedId, setSelectedId] = useState(comparisons[0]?.id || "");
  const selected = useMemo(
    () => comparisons.find((comparison) => comparison.id === selectedId) || comparisons[0],
    [comparisons, selectedId],
  );

  if (!selected) {
    return (
      <section className={styles.shell}>
        <div className={styles.empty}>
          <strong>No explicit version pairs yet.</strong>
          <p>Add a <code>supersedes</code> relationship between research objects in the same project to enable body and heading comparison.</p>
        </div>
      </section>
    );
  }

  const delta = selected.wordDelta > 0 ? `+${selected.wordDelta}` : String(selected.wordDelta);

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Version comparison</span>
          <h2>Compare the content behind an explicit <code>supersedes</code> edge.</h2>
        </div>
        <label>
          <span>Version pair</span>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {comparisons.map((comparison) => (
              <option key={comparison.id} value={comparison.id}>{comparison.older.title} → {comparison.newer.title}</option>
            ))}
          </select>
        </label>
      </header>

      <div className={styles.pair}>
        <Link href={selected.older.href} className={styles.version} data-side="older">
          <small>Previous version</small>
          <strong>{selected.older.title}</strong>
          <span>{[selected.older.date, selected.older.status, `${selected.older.words} words`].filter(Boolean).join(" · ")}</span>
        </Link>
        <span className={styles.transition}>superseded by →</span>
        <Link href={selected.newer.href} className={styles.version} data-side="newer">
          <small>New version</small>
          <strong>{selected.newer.title}</strong>
          <span>{[selected.newer.date, selected.newer.status, `${selected.newer.words} words`].filter(Boolean).join(" · ")}</span>
        </Link>
      </div>

      <div className={styles.metrics}>
        <div><span>Word delta</span><strong>{delta}</strong></div>
        <div><span>Added lines</span><strong>+{selected.addedLines}</strong></div>
        <div><span>Removed lines</span><strong>−{selected.removedLines}</strong></div>
        <div><span>Stable lines</span><strong>{selected.unchangedLines}</strong></div>
      </div>

      {(selected.headings.added.length > 0 || selected.headings.removed.length > 0) && (
        <div className={styles.headingChanges}>
          <div>
            <span>Added sections</span>
            <div>{selected.headings.added.map((heading) => <strong key={`added-${heading}`}>+ {heading}</strong>)}</div>
          </div>
          <div>
            <span>Removed sections</span>
            <div>{selected.headings.removed.map((heading) => <strong key={`removed-${heading}`}>− {heading}</strong>)}</div>
          </div>
        </div>
      )}

      <div className={styles.diff} role="region" aria-label="Research version content diff">
        {selected.diff.map((line, index) => (
          <div className={styles.diffLine} data-kind={line.kind} key={`${line.kind}-${index}`}>
            <span>{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : line.kind === "ellipsis" ? "⋯" : " "}</span>
            <code>{line.text || " "}</code>
          </div>
        ))}
      </div>
      {selected.truncated && <p className={styles.notice}>This comparison is bounded to the first 240 source lines per version. Open the source notes for the complete text.</p>}
    </section>
  );
}
