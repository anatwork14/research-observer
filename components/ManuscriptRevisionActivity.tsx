import Link from "next/link";
import {
  buildManuscriptClaimActivity,
  buildManuscriptClaimActivityMatrix,
  buildManuscriptClaimEventComposition,
  isManuscriptClaimHistoryEventType,
  isManuscriptClaimHistoryRelation,
} from "@/lib/research/manuscript-claim-activity.mjs";
import {
  compareManuscriptClaimSnapshots,
  type ManuscriptClaimEvolution,
} from "@/lib/research/manuscript-claim-history.mjs";
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

function heatClass(events: number, maximum: number) {
  if (events <= 0 || maximum <= 0) return styles.heat0;
  const ratio = events / maximum;
  if (ratio <= 0.25) return styles.heat1;
  if (ratio <= 0.5) return styles.heat2;
  if (ratio <= 0.75) return styles.heat3;
  return styles.heat4;
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
  const activityFilters = {
    claimId: selectedClaim,
    evidenceSlug: selectedEvidence,
    eventType: selectedEvent,
    relationType: selectedRelation,
  };
  const activity = buildManuscriptClaimActivity(evolution.transitions, {
    limit: 12,
    ...activityFilters,
  });
  const matrix = buildManuscriptClaimActivityMatrix(evolution.transitions, {
    transitionLimit: 12,
    claimLimit: 20,
    ...activityFilters,
  });
  const selectedPairComparison = compareManuscriptClaimSnapshots(resolvedBase, resolvedCompare);
  const pairComposition = buildManuscriptClaimEventComposition(selectedPairComparison.events, activityFilters);
  const scale = Math.max(1, activity.stats.maxEvents);
  const pairScale = Math.max(1, pairComposition.stats.maxCount);
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

      <div className={styles.pairHeading}>
        <div>
          <span className="kicker">Selected pair</span>
          <h3>Event composition</h3>
        </div>
        <p>
          <code>{resolvedBase.shortCommit} → {resolvedCompare.shortCommit}</code> has {pairComposition.stats.events} matching explicit event{pairComposition.stats.events === 1 ? "" : "s"} across {pairComposition.stats.eventTypes} event type{pairComposition.stats.eventTypes === 1 ? "" : "s"}. Bar length is relative only to the largest matching event-type count in this selected pair; it is not a score.
        </p>
      </div>

      <div className={styles.pairCategorySummary} aria-label="Selected pair event category summary">
        <span><i className={styles.claimLegend} /><strong>{pairComposition.categories.claimState}</strong> Claim state</span>
        <span><i className={styles.evidenceLegend} /><strong>{pairComposition.categories.evidenceTargets}</strong> Evidence target</span>
        <span><i className={styles.relationLegend} /><strong>{pairComposition.categories.relations}</strong> Relationship</span>
      </div>

      {pairComposition.rows.length > 0 ? (
        <div className={styles.compositionRows}>
          {pairComposition.rows.map((row) => {
            const active = selectedEvent === row.type;
            const href = historyHref({
              projectId,
              baseCommit: resolvedBase.commit,
              compareCommit: resolvedCompare.commit,
              claimId: selectedClaim,
              evidenceSlug: selectedEvidence,
              eventType: active ? undefined : row.type,
              relationType: selectedRelation,
              changedOnly,
            });
            const width = Math.max(6, (row.count / pairScale) * 100);
            return (
              <Link
                className={`${styles.compositionRow}${active ? ` ${styles.compositionActive}` : ""}`}
                href={href}
                aria-current={active ? "page" : undefined}
                key={row.type}
              >
                <span className={styles.compositionLabel}><strong>{row.label}</strong><small>{row.type}</small></span>
                <span className={styles.compositionTrack} aria-hidden="true"><i style={{ width: `${width}%` }} /></span>
                <strong className={styles.compositionCount}>{row.count}</strong>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyMatrix}>The selected Base → Compare pair has no explicit events matching every active semantic filter.</p>
      )}

      <div className={styles.matrixHeading}>
        <div>
          <span className="kicker">Claim × revision map</span>
          <h3>Where each explicit Claim changed</h3>
        </div>
        <p>
          {matrix.stats.claims} of {matrix.stats.totalClaims} matching Claims shown across {matrix.stats.transitions} adjacent revision pairs.
          {matrix.stats.truncatedClaims > 0 ? ` ${matrix.stats.truncatedClaims} additional matching Claims are omitted by the 20-Claim presentation bound.` : ""}
          {" "}Cell shade reflects only the exact matching event count within that Claim/revision pair.
        </p>
      </div>

      {matrix.rows.length > 0 ? (
        <div className={styles.matrixScroll}>
          <table className={styles.heatmap}>
            <thead>
              <tr>
                <th scope="col">Claim</th>
                {matrix.columns.map((column) => {
                  const from = snapshotByCommit.get(column.fromCommit);
                  const to = snapshotByCommit.get(column.toCommit);
                  const selected = resolvedBase.commit === column.fromCommit && resolvedCompare.commit === column.toCommit;
                  const href = historyHref({
                    projectId,
                    baseCommit: column.fromCommit,
                    compareCommit: column.toCommit,
                    claimId: selectedClaim,
                    evidenceSlug: selectedEvidence,
                    eventType: selectedEvent,
                    relationType: selectedRelation,
                    changedOnly,
                  });
                  return (
                    <th className={selected ? styles.selectedColumn : undefined} scope="col" key={`${column.fromCommit}-${column.toCommit}`}>
                      <Link href={href} title={column.subject || "Committed manuscript revision"}>
                        <code>{from?.shortCommit ?? column.fromCommit.slice(0, 7)}</code>
                        <span>→</span>
                        <code>{to?.shortCommit ?? column.toCommit.slice(0, 7)}</code>
                      </Link>
                    </th>
                  );
                })}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.claimId}>
                  <th className={selectedClaim === row.claimId ? styles.selectedClaim : undefined} scope="row">
                    <code>{row.claimId}</code>
                  </th>
                  {row.cells.map((cell) => {
                    const selected = resolvedBase.commit === cell.fromCommit && resolvedCompare.commit === cell.toCommit;
                    const href = historyHref({
                      projectId,
                      baseCommit: cell.fromCommit,
                      compareCommit: cell.toCommit,
                      claimId: row.claimId,
                      evidenceSlug: selectedEvidence,
                      eventType: selectedEvent,
                      relationType: selectedRelation,
                      changedOnly,
                    });
                    const label = `${row.claimId}: ${cell.events} matching explicit events — ${cell.claimState} Claim-state, ${cell.evidenceTargets} Evidence-target, ${cell.relations} relationship`;
                    return (
                      <td className={selected ? styles.selectedColumn : undefined} key={`${row.claimId}-${cell.fromCommit}-${cell.toCommit}`}>
                        <Link
                          className={`${styles.heatCell} ${heatClass(cell.events, matrix.stats.maxCellEvents)}`}
                          href={href}
                          aria-label={label}
                          title={label}
                        >
                          <strong>{cell.events}</strong>
                          <span className={styles.cellSignals} aria-hidden="true">
                            {cell.claimState > 0 && <i className={styles.claimSignal} />}
                            {cell.evidenceTargets > 0 && <i className={styles.evidenceSignal} />}
                            {cell.relations > 0 && <i className={styles.relationSignal} />}
                          </span>
                        </Link>
                      </td>
                    );
                  })}
                  <td className={styles.totalCell}><strong>{row.totalEvents}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.emptyMatrix}>No Claims have matching explicit events in this bounded revision window.</p>
      )}
    </section>
  );
}
