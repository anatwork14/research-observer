import Link from "next/link";
import {
  buildManuscriptClaimActivity,
  isManuscriptClaimHistoryEventType,
  isManuscriptClaimHistoryRelation,
} from "@/lib/research/manuscript-claim-activity.mjs";
import type { ManuscriptClaimEvolution } from "@/lib/research/manuscript-claim-history.mjs";
import styles from "./ManuscriptRevisionActivity.module.css";

type ManuscriptRevisionActivityProps = {
  evolution: ManuscriptClaimEvolution;
  projectId: string;
  baseCommit?: string;
  compareCommit?: string;
  claimId?: string;
  evidenceSlug?: string;
  eventType?: string;
  relationType?: string;
  changedMode?: string;
};

function formatRevisionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Unknown commit time";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function historyHref({
  projectId,
  baseCommit,
  compareCommit,
  claimId,
  evidenceSlug,
  eventType,
  relationType,
  changedOnly,
}: {
  projectId: string;
  baseCommit: string;
  compareCommit: string;
  claimId?: string;
  evidenceSlug?: string;
  eventType?: string;
  relationType?: string;
  changedOnly?: boolean;
}) {
  const params = new URLSearchParams({
    research: projectId,
    view: "timeline",
    claimBase: baseCommit,
    claimCompare: compareCommit,
  });
  if (claimId) params.set("claimHistory", claimId);
  if (evidenceSlug) params.set("evidenceHistory", evidenceSlug);
  if (eventType) params.set("historyEvent", eventType);
  if (relationType) params.set("historyRelation", relationType);
  if (changedOnly) params.set("historyChanged", "only");
  return `/graph?${params.toString()}`;
}

export function ManuscriptRevisionActivity({
  evolution,
  projectId,
  baseCommit,
  compareCommit,
  claimId,
  evidenceSlug,
  eventType,
  relationType,
  changedMode,
}: ManuscriptRevisionActivityProps) {
  if (!evolution.available || evolution.transitions.length === 0 || evolution.snapshots.length < 2) return null;

  const snapshots = evolution.snapshots;
  const snapshotByCommit = new Map(snapshots.map((snapshot) => [snapshot.commit, snapshot]));
  const claimIds = new Set(snapshots.flatMap((snapshot) => snapshot.claims.map((claim) => claim.claimId)));
  const evidenceSlugs = new Set(snapshots.flatMap((snapshot) => snapshot.links.map((link) => link.evidenceSlug)));
  const selectedClaim = claimId && claimIds.has(claimId) ? claimId : "";
  const selectedEvidence = evidenceSlug && evidenceSlugs.has(evidenceSlug) ? evidenceSlug : "";
  const selectedEvent = isManuscriptClaimHistoryEventType(eventType) ? eventType : "";
  const selectedRelation = isManuscriptClaimHistoryRelation(relationType) ? relationType : "";
  const changedOnly = changedMode === "only";

  const latest = snapshots.at(-1)!;
  const previous = snapshots.at(-2)!;
  const resolvedBase = snapshotByCommit.get(baseCommit ?? "") ?? previous;
  const resolvedCompare = snapshotByCommit.get(compareCommit ?? "") ?? latest;
  const activity = buildManuscriptClaimActivity(evolution.transitions, {
    limit: 12,
    claimId: selectedClaim,
    evidenceSlug: selectedEvidence,
    eventType: selectedEvent,
    relationType: selectedRelation,
  });
  const scale = Math.max(1, activity.stats.maxEvents);
  const focusLabels = [
    selectedClaim ? `Claim ${selectedClaim}` : "",
    selectedEvidence ? `Evidence ${selectedEvidence}` : "",
    selectedEvent ? `Event ${selectedEvent}` : "",
    selectedRelation ? `Relation ${selectedRelation}` : "",
  ].filter(Boolean);

  return (
    <section className={`${styles.shell} panel`} aria-labelledby="claim-revision-activity-title">
      <div className={styles.heading}>
        <div>
          <span className="kicker">Revision scan</span>
          <h2 id="claim-revision-activity-title">Explicit change activity</h2>
          <p>
            Scan the latest {activity.stats.transitions} adjacent committed revision pairs. Bar length is the number of matching explicit authored events, not a research-quality or confidence score.
          </p>
        </div>
        <div className={styles.stats} aria-label="Visible revision activity summary">
          <span><strong>{activity.stats.events}</strong> matching events</span>
          <span><strong>{activity.stats.claims}</strong> Claims touched</span>
        </div>
      </div>

      <div className={styles.legend} aria-label="Change activity legend">
        <span><i className={styles.claimLegend} />Claim state</span>
        <span><i className={styles.evidenceLegend} />Evidence target</span>
        <span><i className={styles.relationLegend} />Relationship</span>
      </div>

      <p className={styles.scopeNote}>
        {focusLabels.length > 0
          ? <>Exact focus: <strong>{focusLabels.join(" · ")}</strong>. Filters combine with strict AND semantics.</>
          : <>No semantic history filters are active; all explicit event types are counted.</>}
        {changedOnly ? " Changed-only remains a Base → Compare row-list mode and does not alter this multi-revision overview." : ""}
      </p>

      <ol className={styles.rows}>
        {activity.rows.map((row) => {
          const from = snapshotByCommit.get(row.fromCommit);
          const to = snapshotByCommit.get(row.toCommit);
          const selected = resolvedBase.commit === row.fromCommit && resolvedCompare.commit === row.toCommit;
          const width = row.events > 0 ? Math.max(5, (row.events / scale) * 100) : 0;
          const rowHref = historyHref({
            projectId,
            baseCommit: row.fromCommit,
            compareCommit: row.toCommit,
            claimId: selectedClaim,
            evidenceSlug: selectedEvidence,
            eventType: selectedEvent,
            relationType: selectedRelation,
            changedOnly,
          });

          return (
            <li className={`${styles.row}${selected ? ` ${styles.selected}` : ""}`} key={`${row.fromCommit}-${row.toCommit}`}>
              <div className={styles.revisionMeta}>
                <Link href={rowHref} aria-current={selected ? "page" : undefined}>
                  <code>{from?.shortCommit ?? row.fromCommit.slice(0, 7)} → {to?.shortCommit ?? row.toCommit.slice(0, 7)}</code>
                  <span>{row.subject || to?.subject || "Committed manuscript revision"}</span>
                </Link>
                <small>{formatRevisionTime(row.at)}</small>
              </div>

              <div className={styles.activityCell}>
                <div
                  className={styles.track}
                  role="img"
                  aria-label={`${row.events} matching explicit events: ${row.claimState} Claim-state, ${row.evidenceTargets} Evidence-target, ${row.relations} relationship events`}
                >
                  <div className={styles.bar} style={{ width: `${width}%` }}>
                    {row.claimState > 0 && <span className={styles.claimSegment} style={{ flexGrow: row.claimState }} />}
                    {row.evidenceTargets > 0 && <span className={styles.evidenceSegment} style={{ flexGrow: row.evidenceTargets }} />}
                    {row.relations > 0 && <span className={styles.relationSegment} style={{ flexGrow: row.relations }} />}
                  </div>
                </div>
                <div className={styles.activityMeta}>
                  <strong>{row.events} event{row.events === 1 ? "" : "s"}</strong>
                  <span>{row.claimIds.length} Claim{row.claimIds.length === 1 ? "" : "s"}</span>
                  <Link href={rowHref}>{selected ? "Selected pair" : "Compare pair"}</Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
