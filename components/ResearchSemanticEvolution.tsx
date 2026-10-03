import type { ResearchEntry } from "@/lib/research/compiler.mjs";
import {
  buildResearchEvolutionTrail,
  diffResearchSemantics,
  type ResearchSemanticDiff,
  type SemanticIncomingRelation,
  type SemanticOutgoingRelation,
} from "@/lib/research/semantic-evolution.mjs";
import styles from "./ResearchSemanticEvolution.module.css";

type Relation = SemanticIncomingRelation | SemanticOutgoingRelation;

function endpoint(relation: Relation) {
  return "target" in relation ? relation.target : relation.source;
}

function relationLabel(relation: Relation) {
  const suffix = relation.note ? ` · ${relation.note}` : "";
  return `${relation.type} → ${endpoint(relation)}${suffix}`;
}

function ChangePills({ label, added, removed }: { label: string; added: string[]; removed: string[] }) {
  if (!added.length && !removed.length) return null;
  return (
    <div className={styles.changeGroup}>
      <span>{label}</span>
      <div className={styles.pills}>
        {added.map((value) => <strong key={`add-${label}-${value}`} data-kind="added">+ {value}</strong>)}
        {removed.map((value) => <strong key={`remove-${label}-${value}`} data-kind="removed">− {value}</strong>)}
      </div>
    </div>
  );
}

function RelationChanges({
  title,
  added,
  removed,
  empty,
}: {
  title: string;
  added: Relation[];
  removed: Relation[];
  empty: string;
}) {
  return (
    <section className={styles.relationPanel}>
      <header><span>{title}</span><strong>{added.length + removed.length}</strong></header>
      {!added.length && !removed.length ? <p>{empty}</p> : (
        <div className={styles.relationList}>
          {added.map((relation, index) => <code key={`add-${relationLabel(relation)}-${index}`} data-kind="added">+ {relationLabel(relation)}</code>)}
          {removed.map((relation, index) => <code key={`remove-${relationLabel(relation)}-${index}`} data-kind="removed">− {relationLabel(relation)}</code>)}
        </div>
      )}
    </section>
  );
}

function trailSummary(diff: ResearchSemanticDiff) {
  const parts = [];
  if (diff.summary.fieldChanges) parts.push(`${diff.summary.fieldChanges} field`);
  if (diff.summary.relationshipChanges) parts.push(`${diff.summary.relationshipChanges} relation`);
  if (diff.summary.evidenceSignalChanges) parts.push(`${diff.summary.evidenceSignalChanges} evidence signal`);
  if (diff.summary.headingChanges) parts.push(`${diff.summary.headingChanges} section`);
  if (diff.summary.tagChanges) parts.push(`${diff.summary.tagChanges} tag`);
  return parts.slice(0, 3).join(" · ") || "No semantic changes detected";
}

export function ResearchSemanticEvolution({
  versions,
  base,
  compare,
}: {
  versions: ResearchEntry[];
  base: ResearchEntry;
  compare: ResearchEntry;
}) {
  const selected = diffResearchSemantics(base, compare);
  const trail = buildResearchEvolutionTrail(versions);

  return (
    <section className={styles.shell} aria-labelledby="semantic-evolution-heading">
      <header className={styles.heading}>
        <div>
          <span className={styles.kicker}>Semantic evolution</span>
          <h3 id="semantic-evolution-heading">What changed beyond the Markdown text?</h3>
          <p>Compare normalized research metadata, structure, explicit relationships, and evidence-bearing incoming links. Version plumbing through <code>supersedes</code> is intentionally excluded.</p>
        </div>
        <span className={styles.dimensionBadge}>{selected.summary.changedDimensions} dimensions changed</span>
      </header>

      <div className={styles.summaryGrid}>
        <article><span>Fields</span><strong>{selected.summary.fieldChanges}</strong><small>title · summary · type · status · source</small></article>
        <article><span>Explicit relations</span><strong>{selected.summary.relationshipChanges}</strong><small>added + removed outgoing links</small></article>
        <article><span>Evidence signals</span><strong>{selected.summary.evidenceSignalChanges}</strong><small>supports · contradicts · answers</small></article>
        <article><span>Structure</span><strong>{selected.summary.headingChanges}</strong><small>section additions + removals</small></article>
      </div>

      {!selected.hasChanges ? (
        <div className={styles.noChange}>No normalized semantic change was detected between these two versions. The Markdown diff below may still contain wording-only edits.</div>
      ) : (
        <>
          {selected.fieldChanges.length > 0 && (
            <div className={styles.fieldChanges}>
              {selected.fieldChanges.map((change) => (
                <article key={change.field}>
                  <span>{change.label}</span>
                  <div><code>{change.before ?? "—"}</code><b aria-hidden="true">→</b><code>{change.after ?? "—"}</code></div>
                </article>
              ))}
            </div>
          )}

          <div className={styles.collectionChanges}>
            <ChangePills label="Tags" added={selected.tags.added} removed={selected.tags.removed} />
            <ChangePills label="Sections" added={selected.headings.added} removed={selected.headings.removed} />
            <ChangePills label="Assets" added={selected.assets.added} removed={selected.assets.removed} />
          </div>

          <div className={styles.relationGrid}>
            <RelationChanges
              title="Outgoing research relations"
              added={selected.relationships.added}
              removed={selected.relationships.removed}
              empty="No explicit outgoing research relationship changed."
            />
            <RelationChanges
              title="Incoming research context"
              added={selected.incomingRelationships.added}
              removed={selected.incomingRelationships.removed}
              empty="No incoming relationship changed."
            />
          </div>

          {(selected.incomingEvidence.added.length > 0 || selected.incomingEvidence.removed.length > 0) && (
            <RelationChanges
              title="Evidence-bearing changes"
              added={selected.incomingEvidence.added}
              removed={selected.incomingEvidence.removed}
              empty="No evidence-bearing relationship changed."
            />
          )}
        </>
      )}

      <div className={styles.trail}>
        <div className={styles.trailHeading}>
          <div><span>Full lineage</span><strong>Before → after → current</strong></div>
          <small>{trail.length} version{trail.length === 1 ? "" : "s"}</small>
        </div>
        <div className={styles.trailScroller} role="list" aria-label="Semantic research evolution trail">
          {trail.map((item) => (
            <article key={item.slug} className={styles.trailCard} role="listitem" data-selected={item.slug === compare.slug ? "true" : undefined}>
              <div className={styles.trailIndex}>v{item.index + 1}</div>
              <div className={styles.trailCopy}>
                <strong>{item.title}</strong>
                <span>{[item.date, item.status].filter(Boolean).join(" · ") || "Undated version"}</span>
                <small>{item.changes ? trailSummary(item.changes) : "Lineage baseline"}</small>
              </div>
              {item.changes && <b>{item.changes.summary.changedDimensions}</b>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
