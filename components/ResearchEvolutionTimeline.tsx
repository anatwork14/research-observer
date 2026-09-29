"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./ResearchEvolutionTimeline.module.css";

type EvolutionNode = {
  id: string;
  kind: string;
  label: string;
  research: string;
  href?: string;
  role?: string;
  type?: string;
  status?: string;
  date?: string;
  shortCommit?: string;
  author?: string;
};

type TimelineEvent = {
  id: string;
  at: string;
  kind: "research" | "run" | "manuscript";
  nodeId?: string;
  label: string;
  research: string;
  type?: string;
  status?: string;
  experimentSlug?: string;
  runId?: string;
  commit?: string;
};

type EvolutionLineage = {
  id: string;
  members: string[];
  newest: string[];
  oldest: string[];
  cyclic: boolean;
};

function monthKey(value: string) {
  return value.slice(0, 7);
}

function readableDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(value.includes("T") && !value.endsWith("T00:00:00.000Z") ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function eventLabel(event: TimelineEvent) {
  if (event.kind === "run") {
    const stage = event.type ? event.type.replace(/At$/, "").replace(/([A-Z])/g, " $1").trim() : "run";
    return `${stage}: ${event.label}`;
  }
  if (event.kind === "manuscript") return `revision: ${event.label}`;
  return event.label;
}

export function ResearchEvolutionTimeline({
  nodes,
  timeline,
  lineages,
}: {
  nodes: EvolutionNode[];
  timeline: TimelineEvent[];
  lineages: EvolutionLineage[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<Set<TimelineEvent["kind"]>>(new Set(["research", "run", "manuscript"]));
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return timeline.filter((event) => {
      if (!kinds.has(event.kind)) return false;
      if (!needle) return true;
      const node = event.nodeId ? nodeById.get(event.nodeId) : undefined;
      return [
        event.label,
        event.type || "",
        event.status || "",
        event.commit || "",
        node?.role || "",
        node?.type || "",
        node?.shortCommit || "",
        node?.author || "",
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [kinds, nodeById, query, timeline]);

  const monthCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of filtered) counts.set(monthKey(event.at), (counts.get(monthKey(event.at)) || 0) + 1);
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count, ratio: count / max }));
  }, [filtered]);

  const grouped = useMemo(() => {
    const groups: Array<{ month: string; events: TimelineEvent[] }> = [];
    for (const event of filtered) {
      const month = monthKey(event.at);
      const current = groups.at(-1);
      if (!current || current.month !== month) groups.push({ month, events: [event] });
      else current.events.push(event);
    }
    return groups;
  }, [filtered]);

  function toggleKind(kind: TimelineEvent["kind"]) {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  return (
    <section className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Evolution timeline</span>
          <h2>See when research changed—and when manuscript source was actually committed.</h2>
          <p>
            Research chronology comes only from explicit note dates and experiment-run timestamps. Manuscript revision events come only from real Git commits.
            Semantic version chains come only from explicit <code>supersedes</code> relationships.
          </p>
        </div>
        <div className={styles.controls}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter timeline…" aria-label="Filter research timeline" />
          <div>
            <button type="button" aria-pressed={kinds.has("research")} onClick={() => toggleKind("research")}>Research</button>
            <button type="button" aria-pressed={kinds.has("run")} onClick={() => toggleKind("run")}>Runs</button>
            <button type="button" aria-pressed={kinds.has("manuscript")} onClick={() => toggleKind("manuscript")}>Manuscript</button>
          </div>
        </div>
      </header>

      <div className={styles.density} aria-label="Timeline activity by month">
        {monthCounts.map((item) => (
          <div className={styles.densityItem} key={item.month}>
            <span>{item.month}</span>
            <div><i style={{ width: `${Math.max(8, item.ratio * 100)}%` }} /></div>
            <strong>{item.count}</strong>
          </div>
        ))}
        {!monthCounts.length && <p className={styles.empty}>No dated events match the current filters.</p>}
      </div>

      <div className={styles.body}>
        <div className={styles.timeline}>
          {grouped.map((group) => (
            <section className={styles.month} key={group.month}>
              <div className={styles.monthLabel}><span>{group.month}</span><strong>{group.events.length}</strong></div>
              <div className={styles.events}>
                {group.events.map((event) => {
                  const node = event.nodeId ? nodeById.get(event.nodeId) : undefined;
                  return (
                    <button
                      type="button"
                      className={styles.event}
                      data-kind={event.kind}
                      key={event.id}
                      onClick={() => node?.href && router.push(node.href)}
                      disabled={!node?.href}
                    >
                      <span className={styles.dot} />
                      <time>{readableDate(event.at)}</time>
                      <strong>{eventLabel(event)}</strong>
                      <small>{[event.kind, node?.role || node?.type, node?.shortCommit, event.status].filter(Boolean).join(" · ")}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {!grouped.length && <p className={styles.empty}>No timeline events match this view.</p>}
        </div>

        <aside className={styles.lineages}>
          <div className={styles.lineageHeading}>
            <span className={styles.kicker}>Semantic version lineages</span>
            <strong>{lineages.length} explicit chains</strong>
          </div>
          {lineages.map((lineage) => (
            <div className={styles.lineage} key={lineage.id} data-cyclic={lineage.cyclic}>
              {lineage.cyclic && <p className={styles.warning}>Cycle detected. Review the <code>supersedes</code> relationships.</p>}
              <div className={styles.versionFlow}>
                {lineage.members.map((id, index) => {
                  const node = nodeById.get(id);
                  if (!node) return null;
                  const newest = lineage.newest.includes(id);
                  const oldest = lineage.oldest.includes(id);
                  return (
                    <div className={styles.versionStep} key={id}>
                      <button type="button" onClick={() => node.href && router.push(node.href)}>
                        <small>{oldest ? "oldest" : newest ? "newest" : `version ${index + 1}`}</small>
                        <strong>{node.label}</strong>
                        <span>{[node.date, node.status].filter(Boolean).join(" · ")}</span>
                      </button>
                      {index < lineage.members.length - 1 && <span className={styles.arrow}>→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!lineages.length && <p className={styles.empty}>Add explicit <code>supersedes</code> relationships to compare semantic versions here.</p>}
        </aside>
      </div>
    </section>
  );
}
