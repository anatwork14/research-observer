import Link from "next/link";
import {
  loadHistoricalResearchEvidenceIndex,
  resolveHistoricalEvidenceSlug,
  type HistoricalEvidenceResolution,
  type HistoricalResearchEvidenceIndex,
} from "@/lib/research/historical-research-evidence.mjs";
import {
  compareManuscriptClaimSnapshots,
  type ManuscriptClaimEvolution,
  type ManuscriptClaimHistoryEvent,
  type ManuscriptClaimHistoryLink,
  type ManuscriptClaimHistorySnapshot,
} from "@/lib/research/manuscript-claim-history.mjs";
import {
  MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS,
  type ManuscriptClaimEvidenceRelationType,
} from "@/lib/research/manuscript-claim-relations.mjs";
import styles from "./ManuscriptClaimHistory.module.css";

const EVENT_LABELS: Record<ManuscriptClaimHistoryEvent["type"], string> = {
  "claim-added": "Claim appeared",
  "claim-removed": "Claim left snapshot",
  "claim-text-changed": "Claim text changed",
  "claim-moved": "Claim moved",
  "evidence-target-added": "Evidence target added",
  "evidence-target-removed": "Evidence target removed",
  "relation-added": "Relation added",
  "relation-removed": "Relation removed",
  "relation-changed": "Relation changed",
};

const EVENT_ORDER: ManuscriptClaimHistoryEvent["type"][] = [
  "claim-added",
  "claim-removed",
  "claim-text-changed",
  "claim-moved",
  "evidence-target-added",
  "evidence-target-removed",
  "relation-changed",
  "relation-added",
  "relation-removed",
];

const ENDPOINT_STATUS_ORDER: HistoricalEvidenceResolution["status"][] = [
  "valid",
  "missing",
  "wrong-type",
  "cross-project",
  "ambiguous",
  "unavailable",
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function snapshotLabel(snapshot: ManuscriptClaimHistorySnapshot) {
  return `${snapshot.shortCommit} · ${formatDate(snapshot.at)} · ${snapshot.subject || "Manuscript revision"}`;
}

function historyHref({
  projectId,
  baseCommit,
  compareCommit,
  claimId,
  evidenceSlug,
  eventType,
  relationType,
}: {
  projectId: string;
  baseCommit?: string;
  compareCommit?: string;
  claimId?: string;
  evidenceSlug?: string;
  eventType?: string;
  relationType?: string;
}) {
  const params = new URLSearchParams({ research: projectId, view: "timeline" });
  if (baseCommit) params.set("claimBase", baseCommit);
  if (compareCommit) params.set("claimCompare", compareCommit);
  if (claimId) params.set("claimHistory", claimId);
  if (evidenceSlug) params.set("evidenceHistory", evidenceSlug);
  if (eventType) params.set("historyEvent", eventType);
  if (relationType) params.set("historyRelation", relationType);
  return `/graph?${params.toString()}`;
}

function eventDetail(event: ManuscriptClaimHistoryEvent) {
  if (event.type === "relation-changed") return `${event.beforeRelation} → ${event.afterRelation} · ${event.evidenceSlug}`;
  if (event.type === "relation-added" || event.type === "relation-removed") return `${event.relation} · ${event.evidenceSlug}`;
  if (event.type === "evidence-target-added" || event.type === "evidence-target-removed") return event.evidenceSlug || "Evidence target";
  if (event.type === "claim-moved") return `${event.before || "unknown"} → ${event.after || "unknown"}`;
  return "";
}

function historicalStatus(resolution: HistoricalEvidenceResolution) {
  if (resolution.status === "valid") return "historically valid Evidence";
  if (resolution.status === "missing") return "historical target missing";
  if (resolution.status === "ambiguous") return `historical target ambiguous${resolution.matches?.length ? ` · ${resolution.matches.length} matches` : ""}`;
  if (resolution.status === "cross-project") return `historical target belongs to project ${resolution.research || "unknown"}`;
  if (resolution.status === "wrong-type") return `historical target type ${resolution.type || "unknown"}, not Evidence`;
  return "historical endpoint validation unavailable";
}

function endpointSummary(snapshot: ManuscriptClaimHistorySnapshot, historicalIndex: HistoricalResearchEvidenceIndex | undefined, projectId: string) {
  const slugs = [...new Set(snapshot.links.map((link) => link.evidenceSlug))];
  if (!slugs.length) return "no authored Evidence endpoints";
  const counts = new Map<HistoricalEvidenceResolution["status"], number>();
  for (const slug of slugs) {
    const status = resolveHistoricalEvidenceSlug(historicalIndex, slug, { projectId }).status;
    counts.set(status, (counts.get(status) || 0) + 1);
  }
  const detail = ENDPOINT_STATUS_ORDER
    .map((status) => counts.get(status) ? `${counts.get(status)} ${status}` : "")
    .filter(Boolean)
    .join(" · ");
  return `${slugs.length} distinct · ${detail}`;
}

function ClaimLinks({
  links,
  historicalIndex,
  projectId,
}: {
  links: ManuscriptClaimHistoryLink[];
  historicalIndex?: HistoricalResearchEvidenceIndex;
  projectId: string;
}) {
  if (!links.length) return <em className={styles.none}>No authored Evidence links</em>;
  return (
    <div className={styles.linkList}>
      {links.map((link) => {
        const resolution = resolveHistoricalEvidenceSlug(historicalIndex, link.evidenceSlug, { projectId });
        const label = resolution.status === "valid" && resolution.title ? resolution.title : link.evidenceSlug;
        const currentSuffix = link.currentCanonical ? " · current canonical exists today" : " · not current canonical today";
        return resolution.status === "valid" && link.currentCanonical ? (
          <Link href={`/progress/${encodeURIComponent(link.evidenceSlug)}`} key={`${link.relation}:${link.evidenceSlug}`}>
            <span>{link.relation} · {label}</span><small>{link.evidenceSlug} · historically valid Evidence · current canonical</small>
          </Link>
        ) : (
          <span className={styles.historicalLink} key={`${link.relation}:${link.evidenceSlug}`}>
            <span>{link.relation} · {label}</span><small>{historicalStatus(resolution)}{currentSuffix}</small>
          </span>
        );
      })}
    </div>
  );
}

function snapshotClaim(snapshot: ManuscriptClaimHistorySnapshot, claimId: string) {
  return snapshot.claims.find((claim) => claim.claimId === claimId);
}

function snapshotLinks(snapshot: ManuscriptClaimHistorySnapshot, claimId: string) {
  return snapshot.links.filter((link) => link.claimId === claimId);
}

function focusedLinks(
  links: ManuscriptClaimHistoryLink[],
  evidenceSlug: string,
  relationType: ManuscriptClaimEvidenceRelationType | "",
) {
  return links.filter((link) =>
    (!evidenceSlug || link.evidenceSlug === evidenceSlug) &&
    (!relationType || link.relation === relationType));
}

function changedClaimIds(events: ManuscriptClaimHistoryEvent[]) {
  return [...new Set(events.map((event) => event.claimId).filter(Boolean))].sort();
}

function eventMatchesRelation(event: ManuscriptClaimHistoryEvent, relationType: ManuscriptClaimEvidenceRelationType | "") {
  if (!relationType) return true;
  return event.relation === relationType || event.beforeRelation === relationType || event.afterRelation === relationType;
}

function transitionEvents(
  events: ManuscriptClaimHistoryEvent[],
  claimId: string,
  evidenceSlug = "",
  eventType: ManuscriptClaimHistoryEvent["type"] | "" = "",
  relationType: ManuscriptClaimEvidenceRelationType | "" = "",
) {
  return events.filter((event) =>
    (!claimId || event.claimId === claimId) &&
    (!evidenceSlug || event.evidenceSlug === evidenceSlug) &&
    (!eventType || event.type === eventType) &&
    eventMatchesRelation(event, relationType));
}

function matrixEventSummary(events: ManuscriptClaimHistoryEvent[]) {
  return [...new Set(events.map((event) => EVENT_LABELS[event.type]))].join(" · ");
}

function comparisonEventSummary(events: ManuscriptClaimHistoryEvent[]) {
  return EVENT_ORDER
    .map((type) => {
      const count = events.filter((event) => event.type === type).length;
      return count ? `${EVENT_LABELS[type]} ${count}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function relationTransitionCount(
  events: ManuscriptClaimHistoryEvent[],
  before: ManuscriptClaimEvidenceRelationType,
  after: ManuscriptClaimEvidenceRelationType,
) {
  return events.filter((event) =>
    event.type === "relation-changed" &&
    event.beforeRelation === before &&
    event.afterRelation === after).length;
}

export async function ManuscriptClaimHistory({
  evolution,
  projectId,
  baseCommit,
  compareCommit,
  claimId = "",
  evidenceSlug = "",
  eventType = "",
  relationType = "",
  stateDirty = false,
}: {
  evolution: ManuscriptClaimEvolution;
  projectId: string;
  baseCommit?: string;
  compareCommit?: string;
  claimId?: string;
  evidenceSlug?: string;
  eventType?: string;
  relationType?: string;
  stateDirty?: boolean;
}) {
  const snapshots = evolution.snapshots || [];
  const claimIds = [...new Set(snapshots.flatMap((snapshot) => snapshot.claims.map((claim) => claim.claimId)))].sort();
  const evidenceSlugs = [...new Set(snapshots.flatMap((snapshot) => snapshot.links.map((link) => link.evidenceSlug)))].sort();
  const selectedClaim = claimIds.includes(claimId) ? claimId : "";
  const selectedEvidence = evidenceSlugs.includes(evidenceSlug) ? evidenceSlug : "";
  const selectedEvent = EVENT_ORDER.find((type) => type === eventType) || "";
  const selectedRelation = MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.find((relation) => relation === relationType) || "";
  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2) || latest;
  const base = snapshots.find((snapshot) => snapshot.commit === baseCommit) || previous;
  const compare = snapshots.find((snapshot) => snapshot.commit === compareCommit) || latest;
  const baseIndex = base ? snapshots.findIndex((snapshot) => snapshot.commit === base.commit) : -1;
  const compareIndex = compare ? snapshots.findIndex((snapshot) => snapshot.commit === compare.commit) : -1;
  const olderBase = baseIndex > 0 ? snapshots[baseIndex - 1] : undefined;
  const newerBase = baseIndex >= 0 && baseIndex < snapshots.length - 1 ? snapshots[baseIndex + 1] : undefined;
  const olderCompare = compareIndex > 0 ? snapshots[compareIndex - 1] : undefined;
  const newerCompare = compareIndex >= 0 && compareIndex < snapshots.length - 1 ? snapshots[compareIndex + 1] : undefined;
  const adjacentBaseForCompare = compareIndex > 0 ? snapshots[compareIndex - 1] : undefined;
  const latestPairBase = snapshots.at(-2);
  const latestPairCompare = snapshots.at(-1);
  const adjacentPairIsCurrent = Boolean(adjacentBaseForCompare && base?.commit === adjacentBaseForCompare.commit);
  const latestPairIsCurrent = Boolean(latestPairBase && latestPairCompare && base?.commit === latestPairBase.commit && compare?.commit === latestPairCompare.commit);
  const comparison = base && compare ? compareManuscriptClaimSnapshots(base, compare) : null;
  const comparisonEvents = comparison ? transitionEvents(comparison.events, selectedClaim, selectedEvidence, selectedEvent, selectedRelation) : [];
  const relationTransitionTotal = comparisonEvents.filter((event) => event.type === "relation-changed").length;
  const stateFocusedComparisonClaimIds = (selectedEvidence || selectedRelation) && base && compare
    ? [...new Set([
        ...focusedLinks(base.links, selectedEvidence, selectedRelation).map((link) => link.claimId),
        ...focusedLinks(compare.links, selectedEvidence, selectedRelation).map((link) => link.claimId),
        ...comparisonEvents.map((event) => event.claimId),
      ])].sort()
    : [];
  const focusedComparisonClaimIds = selectedEvent
    ? changedClaimIds(comparisonEvents)
    : stateFocusedComparisonClaimIds;
  const compareClaimIds = selectedClaim
    ? [selectedClaim]
    : (selectedEvidence || selectedRelation)
      ? focusedComparisonClaimIds.slice(0, 20)
      : changedClaimIds(comparisonEvents).slice(0, 20);
  const uniqueHistoricalClaims = new Set(snapshots.flatMap((snapshot) => snapshot.claims.map((claim) => claim.claimId))).size;
  const dirtyFiles = evolution.dirtyFiles || [];
  const workingChanges = dirtyFiles.length + (stateDirty ? 1 : 0);
  const matrixSnapshots = snapshots.slice(-12);
  const matrixCommits = new Set(matrixSnapshots.map((snapshot) => snapshot.commit));
  const matrixTransitions = evolution.transitions.filter((transition) => matrixCommits.has(transition.toCommit));
  const matrixChangedIds = changedClaimIds(matrixTransitions.flatMap((transition) => transitionEvents(transition.events, "", selectedEvidence, selectedEvent, selectedRelation)));
  const matrixFocusedClaimIds = (selectedEvidence || selectedRelation)
    ? [...new Set(matrixSnapshots.flatMap((snapshot) => focusedLinks(snapshot.links, selectedEvidence, selectedRelation).map((link) => link.claimId)))].sort()
    : [];
  const matrixDefaultIds = selectedEvent
    ? matrixChangedIds
    : (selectedEvidence || selectedRelation)
      ? [...new Set([...matrixFocusedClaimIds, ...matrixChangedIds])].sort()
      : (matrixChangedIds.length ? matrixChangedIds : claimIds);
  const matrixClaimIds = selectedClaim ? [selectedClaim] : matrixDefaultIds.slice(0, 20);
  const transitionByCommit = new Map(evolution.transitions.map((transition) => [transition.toCommit, transition]));
  const historicalIndexes: Record<string, HistoricalResearchEvidenceIndex | undefined> = {};
  const validationCommits = [...new Set([base, compare]
    .filter((snapshot): snapshot is ManuscriptClaimHistorySnapshot => Boolean(snapshot?.links.length))
    .map((snapshot) => snapshot.commit))];
  await Promise.all(validationCommits.map(async (commit) => {
    try {
      historicalIndexes[commit] = await loadHistoricalResearchEvidenceIndex({ commit, projectId });
    } catch {
      historicalIndexes[commit] = undefined;
    }
  }));

  if (!evolution.available) {
    return (
      <section className={`${styles.shell} panel`}>
        <header className={styles.heading}>
          <div><span className="kicker">Manuscript semantics</span><h2>Claim ↔ Evidence revision history</h2></div>
          <p>Git history is unavailable for this manuscript project. Live Claim analytics remain separate from historical revision state.</p>
        </header>
      </section>
    );
  }

  if (!snapshots.length) {
    return (
      <section className={`${styles.shell} panel`}>
        <header className={styles.heading}>
          <div><span className="kicker">Manuscript semantics</span><h2>Claim ↔ Evidence revision history</h2></div>
          <p>No committed manuscript revisions containing editable source or committed manuscript visibility-state changes were available.</p>
        </header>
        {workingChanges > 0 && <p className={styles.dirty}>Working state is intentionally excluded from committed history.{dirtyFiles.length ? ` Dirty source: ${dirtyFiles.join(", ")}.` : ""}{stateDirty ? " Manuscript visibility state also differs from the committed revision." : ""}</p>}
      </section>
    );
  }

  const hrefState = {
    projectId,
    baseCommit: base?.commit,
    compareCommit: compare?.commit,
    claimId: selectedClaim,
    evidenceSlug: selectedEvidence,
    eventType: selectedEvent,
    relationType: selectedRelation,
  };
  const hasFocus = Boolean(selectedClaim || selectedEvidence || selectedEvent || selectedRelation);

  return (
    <section className={styles.shell} aria-label="Explicit Claim and Evidence revision history">
      <header className={styles.heading}>
        <div>
          <span className="kicker">Committed manuscript semantics</span>
          <h2>Claim ↔ Evidence revision history</h2>
        </div>
        <p>
          Reconstructs explicit Claim anchors and authored Claim↔Evidence directives from committed manuscript bytes and the committed visibility state at each revision.
          Current dirty editor text is never projected backward, and no semantic relationship is inferred from prose or citations.
        </p>
      </header>

      <section className={styles.summary} aria-label="Claim revision history summary">
        <article className="panel"><span>Revisions scanned</span><strong>{evolution.stats.revisions}</strong><small>latest committed snapshots, bounded at 40</small></article>
        <article className="panel"><span>Historical Claim IDs</span><strong>{uniqueHistoricalClaims}</strong><small>explicit authored identities</small></article>
        <article className="panel"><span>Authored changes</span><strong>{evolution.stats.events}</strong><small>factual adjacent-revision events</small></article>
        <article className="panel"><span>Working changes</span><strong>{workingChanges}</strong><small>{dirtyFiles.length} source file{dirtyFiles.length === 1 ? "" : "s"}{stateDirty ? " · visibility state changed" : ""}</small></article>
      </section>

      {workingChanges > 0 && (
        <p className={styles.dirty}>
          Working state is excluded from committed history.{dirtyFiles.length ? ` Dirty source: ${dirtyFiles.join(", ")}.` : ""}{stateDirty ? " Manuscript visibility state differs from the latest committed state." : ""}
        </p>
      )}

      <section className={`${styles.controls} panel`}>
        <div className={styles.controlsHeading}>
          <div><span className="kicker">Revision compare</span><h3>Compare explicit authored state</h3></div>
          <p>Base → Compare is directional. Claim, Evidence, event, and relation filters use exact authored fields and intersect without changing the underlying snapshots.</p>
        </div>
        <form action="/graph" method="get" className={styles.form}>
          <input type="hidden" name="research" value={projectId} />
          <input type="hidden" name="view" value="timeline" />
          <label>
            <span>Base revision</span>
            <select name="claimBase" defaultValue={base?.commit || ""}>
              {snapshots.map((snapshot) => <option value={snapshot.commit} key={snapshot.commit}>{snapshotLabel(snapshot)}</option>)}
            </select>
          </label>
          <label>
            <span>Compare revision</span>
            <select name="claimCompare" defaultValue={compare?.commit || ""}>
              {snapshots.map((snapshot) => <option value={snapshot.commit} key={snapshot.commit}>{snapshotLabel(snapshot)}</option>)}
            </select>
          </label>
          <label>
            <span>Claim focus</span>
            <select name="claimHistory" defaultValue={selectedClaim}>
              <option value="">All changed Claims</option>
              {claimIds.map((id) => <option value={id} key={id}>{id}</option>)}
            </select>
          </label>
          <label>
            <span>Evidence focus</span>
            <select name="evidenceHistory" defaultValue={selectedEvidence}>
              <option value="">All authored Evidence targets</option>
              {evidenceSlugs.map((slug) => <option value={slug} key={slug}>{slug}</option>)}
            </select>
          </label>
          <label>
            <span>Event type</span>
            <select name="historyEvent" defaultValue={selectedEvent}>
              <option value="">All explicit event types</option>
              {EVENT_ORDER.map((type) => <option value={type} key={type}>{EVENT_LABELS[type]}</option>)}
            </select>
          </label>
          <label>
            <span>Relation type</span>
            <select name="historyRelation" defaultValue={selectedRelation}>
              <option value="">All authored relation types</option>
              {MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((relation) => <option value={relation} key={relation}>{relation}</option>)}
            </select>
          </label>
          <button type="submit">Compare revisions</button>
        </form>
        {base && compare && (
          <nav className={styles.revisionNav} aria-label="Revision pair navigation">
            {olderBase ? <Link href={historyHref({ ...hrefState, baseCommit: olderBase.commit })}>← Older Base</Link> : <span aria-disabled="true">← Older Base</span>}
            {newerBase ? <Link href={historyHref({ ...hrefState, baseCommit: newerBase.commit })}>Newer Base →</Link> : <span aria-disabled="true">Newer Base →</span>}
            {base.commit !== compare.commit ? <Link className={styles.swapRevision} href={historyHref({ ...hrefState, baseCommit: compare.commit, compareCommit: base.commit })}>Swap Base ↔ Compare</Link> : <span className={styles.swapRevision} aria-disabled="true">Swap Base ↔ Compare</span>}
            {olderCompare ? <Link href={historyHref({ ...hrefState, compareCommit: olderCompare.commit })}>← Older Compare</Link> : <span aria-disabled="true">← Older Compare</span>}
            {newerCompare ? <Link href={historyHref({ ...hrefState, compareCommit: newerCompare.commit })}>Newer Compare →</Link> : <span aria-disabled="true">Newer Compare →</span>}
            {adjacentBaseForCompare && !adjacentPairIsCurrent ? <Link href={historyHref({ ...hrefState, baseCommit: adjacentBaseForCompare.commit })}>Previous → Compare</Link> : <span aria-disabled="true">Previous → Compare</span>}
            {latestPairBase && latestPairCompare && !latestPairIsCurrent ? <Link href={historyHref({ ...hrefState, baseCommit: latestPairBase.commit, compareCommit: latestPairCompare.commit })}>Latest pair</Link> : <span aria-disabled="true">Latest pair</span>}
          </nav>
        )}
        {hasFocus && (
          <div className={styles.focusBar} aria-label="Active Claim and Evidence history filters">
            {selectedClaim && <Link href={historyHref({ ...hrefState, claimId: undefined })}>Claim: {selectedClaim} ×</Link>}
            {selectedEvidence && <Link href={historyHref({ ...hrefState, evidenceSlug: undefined })}>Evidence: {selectedEvidence} ×</Link>}
            {selectedEvent && <Link href={historyHref({ ...hrefState, eventType: undefined })}>Event: {EVENT_LABELS[selectedEvent]} ×</Link>}
            {selectedRelation && <Link href={historyHref({ ...hrefState, relationType: undefined })}>Relation: {selectedRelation} ×</Link>}
            <Link className={styles.clearFocus} href={historyHref({ projectId, baseCommit: base?.commit, compareCommit: compare?.commit })}>Clear filters</Link>
          </div>
        )}
      </section>

      <section className={`${styles.matrixPanel} panel`} aria-label="Claim evolution matrix">
        <header className={styles.panelHeading}>
          <div><span className="kicker">Multi-revision view</span><h3>Claim evolution matrix</h3></div>
          <p>Shows up to 12 recent committed snapshots and 20 Claim IDs. Active filters intersect exactly; an event-type filter restricts unfocused rows to Claims with matching events, while Evidence/relation filters also narrow authored link counts. Matrix-only revisions do not trigger historical research endpoint scans.</p>
        </header>
        <div className={styles.matrixScroll}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th scope="col">Claim</th>
                {matrixSnapshots.map((snapshot) => (
                  <th scope="col" key={snapshot.commit}>
                    <Link className={snapshot.commit === compare?.commit ? styles.matrixActiveLink : styles.matrixLink} href={historyHref({ ...hrefState, compareCommit: snapshot.commit })}>
                      <code>{snapshot.shortCommit}</code><small>{snapshot.subject || "Revision"}</small>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixClaimIds.map((id) => (
                <tr key={id}>
                  <th scope="row">
                    <Link className={id === selectedClaim ? styles.matrixActiveLink : styles.matrixLink} href={historyHref({ ...hrefState, claimId: id })}>{id}</Link>
                  </th>
                  {matrixSnapshots.map((snapshot) => {
                    const present = Boolean(snapshotClaim(snapshot, id));
                    const allLinks = snapshotLinks(snapshot, id);
                    const links = focusedLinks(allLinks, selectedEvidence, selectedRelation);
                    const events = transitionEvents(transitionByCommit.get(snapshot.commit)?.events || [], id, selectedEvidence, selectedEvent, selectedRelation);
                    return (
                      <td className={events.length ? styles.matrixChanged : present ? styles.matrixPresent : styles.matrixAbsent} key={`${id}:${snapshot.commit}`}>
                        <strong>{present ? "Present" : "Absent"}</strong>
                        <span>{present ? `${links.length} ${(selectedEvidence || selectedRelation) ? "focused" : "authored"} link${links.length === 1 ? "" : "s"}` : "—"}</span>
                        <small>{events.length ? matrixEventSummary(events) : "snapshot state"}</small>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matrixSnapshots.length === 12 && snapshots.length > matrixSnapshots.length && <small className={styles.more}>Showing the latest 12 of {snapshots.length} loaded committed snapshots.</small>}
        {!selectedClaim && matrixClaimIds.length === 20 && matrixDefaultIds.length > matrixClaimIds.length && <small className={styles.more}>Showing 20 Claim IDs. Use Claim focus to inspect another identity across the same revision window.</small>}
      </section>

      <section className={styles.grid}>
        <article className={`${styles.timelinePanel} panel`}>
          <header className={styles.panelHeading}>
            <div><span className="kicker">Chronology</span><h3>Authored semantic changes</h3></div>
            <p>{selectedClaim ? `Claim ${selectedClaim}. ` : ""}{selectedEvidence ? `Evidence ${selectedEvidence}. ` : ""}{selectedEvent ? `Event ${EVENT_LABELS[selectedEvent]}. ` : ""}{selectedRelation ? `Relation ${selectedRelation}. ` : ""}{!hasFocus ? "Showing explicit Claim/Evidence events across adjacent committed snapshots. " : "Showing only explicit events matching every active filter. "}Revision order follows Git history; displayed timestamps are commit metadata and do not reorder snapshots.</p>
          </header>
          <div className={styles.timeline}>
            {evolution.transitions.slice().reverse().map((transition) => {
              const events = transitionEvents(transition.events, selectedClaim, selectedEvidence, selectedEvent, selectedRelation);
              if (!events.length) return null;
              const targetSnapshot = snapshots.find((snapshot) => snapshot.commit === transition.toCommit);
              return (
                <div className={styles.transition} key={`${transition.fromCommit}:${transition.toCommit}`}>
                  <div className={styles.transitionMeta}>
                    <time dateTime={transition.at}>{formatDate(transition.at)}</time>
                    <Link className={transition.toCommit === compare?.commit ? styles.matrixActiveLink : styles.matrixLink} href={historyHref({ ...hrefState, compareCommit: transition.toCommit })}>
                      <code>{transition.toCommit.slice(0, 10)}</code>
                    </Link>
                    {targetSnapshot?.stateChanged && <span>visibility state changed</span>}
                  </div>
                  <strong>{transition.subject || "Manuscript revision"}</strong>
                  <div className={styles.eventCounts}>
                    {EVENT_ORDER.map((type) => {
                      const count = events.filter((event) => event.type === type).length;
                      return count ? <Link className={type === selectedEvent ? styles.eventFilterActiveLink : styles.eventFilterLink} href={historyHref({ ...hrefState, eventType: type })} key={type}>{EVENT_LABELS[type]} · {count}</Link> : null;
                    })}
                  </div>
                  <div className={styles.eventList}>
                    {events.slice(0, 10).map((event, index) => (
                      <div key={`${event.type}:${event.claimId}:${event.evidenceSlug || ""}:${index}`}>
                        <span>{EVENT_LABELS[event.type]}</span>
                        <Link className={event.claimId === selectedClaim ? styles.matrixActiveLink : styles.matrixLink} href={historyHref({ ...hrefState, claimId: event.claimId })}>{event.claimId}</Link>
                        {eventDetail(event) && (event.evidenceSlug ? (
                          <Link className={event.evidenceSlug === selectedEvidence ? styles.eventEvidenceActiveLink : styles.eventEvidenceLink} href={historyHref({ ...hrefState, evidenceSlug: event.evidenceSlug })}>{eventDetail(event)}</Link>
                        ) : <small>{eventDetail(event)}</small>)}
                      </div>
                    ))}
                    {events.length > 10 && <small className={styles.more}>Showing 10 of {events.length} events for this revision transition.</small>}
                  </div>
                </div>
              );
            })}
            {!evolution.transitions.some((transition) => transitionEvents(transition.events, selectedClaim, selectedEvidence, selectedEvent, selectedRelation).length > 0) && (
              <p className={styles.empty}>No explicit authored semantic changes match every active history filter in the scanned revision window.</p>
            )}
          </div>
        </article>

        <article className={`${styles.comparePanel} panel`}>
          <header className={styles.panelHeading}>
            <div><span className="kicker">Side by side</span><h3>Selected revision state</h3></div>
            <p>{comparisonEvents.length} explicit change{comparisonEvents.length === 1 ? "" : "s"} matches the active Base → Compare filters. Evidence endpoint badges validate against canonical research state at each selected Git commit; current canonical navigation is shown separately.</p>
          </header>

          {base && compare && (
            <div className={styles.revisionPair}>
              <div>
                <span>Base</span><code>{base.shortCommit}</code><strong>{base.subject || "Manuscript revision"}</strong><small>{formatDate(base.at)} · {base.stats.claims} Claims · {base.stats.links} authored links</small><small>Historical endpoints: {endpointSummary(base, historicalIndexes[base.commit], projectId)}</small>
              </div>
              <div>
                <span>Compare</span><code>{compare.shortCommit}</code><strong>{compare.subject || "Manuscript revision"}</strong><small>{formatDate(compare.at)} · {compare.stats.claims} Claims · {compare.stats.links} authored links</small><small>Historical endpoints: {endpointSummary(compare, historicalIndexes[compare.commit], projectId)}</small>
              </div>
            </div>
          )}

          {comparison && (
            <section className={styles.deltaPanel} aria-label="Base to Compare authored change summary">
              <div className={styles.deltaCounts}>
                {EVENT_ORDER.map((type) => {
                  const count = comparisonEvents.filter((event) => event.type === type).length;
                  return count ? <Link className={type === selectedEvent ? styles.eventFilterActiveLink : styles.eventFilterLink} href={historyHref({ ...hrefState, eventType: type })} key={type}><strong>{count}</strong>{EVENT_LABELS[type]}</Link> : null;
                })}
                {!comparisonEvents.length && <span><strong>0</strong>matching explicit changes</span>}
              </div>
              <div className={styles.relationTransitionBlock}>
                <div className={styles.relationTransitionHeading}>
                  <strong>Explicit relation transitions</strong>
                  <small>{relationTransitionTotal} unambiguous one-to-one change{relationTransitionTotal === 1 ? "" : "s"} in the active comparison filters.</small>
                </div>
                {relationTransitionTotal > 0 ? (
                  <div className={styles.relationTransitionScroll}>
                    <table className={styles.relationTransitionMatrix}>
                      <thead>
                        <tr><th scope="col">Before ↓ / After →</th>{MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((relation) => <th scope="col" key={relation}><Link className={relation === selectedRelation ? styles.relationFilterActiveLink : styles.relationFilterLink} href={historyHref({ ...hrefState, relationType: relation })}>{relation}</Link></th>)}</tr>
                      </thead>
                      <tbody>
                        {MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((before) => (
                          <tr key={before}>
                            <th scope="row"><Link className={before === selectedRelation ? styles.relationFilterActiveLink : styles.relationFilterLink} href={historyHref({ ...hrefState, relationType: before })}>{before}</Link></th>
                            {MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.map((after) => {
                              const count = relationTransitionCount(comparisonEvents, before, after);
                              return <td className={count ? styles.relationTransitionHit : undefined} key={`${before}:${after}`}>{count || "—"}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className={styles.none}>No unambiguous direct relation transformation matches the active comparison filters.</p>}
              </div>
            </section>
          )}

          {base && compare && compareClaimIds.length > 0 && (
            <div className={styles.claimComparisons}>
              {compareClaimIds.map((id) => {
                const before = snapshotClaim(base, id);
                const after = snapshotClaim(compare, id);
                const beforeLinksAll = snapshotLinks(base, id);
                const afterLinksAll = snapshotLinks(compare, id);
                const beforeLinks = focusedLinks(beforeLinksAll, selectedEvidence, selectedRelation);
                const afterLinks = focusedLinks(afterLinksAll, selectedEvidence, selectedRelation);
                const beforeEvidenceSlugs = [...new Set(beforeLinks.map((link) => link.evidenceSlug))];
                const afterEvidenceSlugs = [...new Set(afterLinks.map((link) => link.evidenceSlug))];
                const claimEvents = transitionEvents(comparison?.events || [], id, selectedEvidence, selectedEvent, selectedRelation);
                const presence = before && after ? "present in both" : before ? "left compared snapshot" : "entered compared snapshot";
                return (
                  <section className={styles.claimCompare} key={id}>
                    <header><strong>{id}</strong><span>{presence}{claimEvents.length ? ` · ${comparisonEventSummary(claimEvents)}` : ""}</span></header>
                    <div className={styles.claimPair}>
                      <div>
                        <span>Base</span>
                        {before ? <><p>{before.excerpt}</p><small>{before.file}{before.section ? ` · ${before.section}` : ""}</small><ClaimLinks links={beforeLinks} historicalIndex={historicalIndexes[base.commit]} projectId={projectId} />{beforeEvidenceSlugs.length > 0 && <div className={styles.focusBar} aria-label={`Base Evidence history focus for ${id}`}>{beforeEvidenceSlugs.map((slug) => <Link key={slug} className={slug === selectedEvidence ? styles.clearFocus : undefined} href={historyHref({ ...hrefState, claimId: id, evidenceSlug: slug })}>Focus Evidence: {slug}</Link>)}</div>}</> : <em className={styles.none}>Claim absent from this visible committed snapshot</em>}
                      </div>
                      <div>
                        <span>Compare</span>
                        {after ? <><p>{after.excerpt}</p><small>{after.file}{after.section ? ` · ${after.section}` : ""}</small><ClaimLinks links={afterLinks} historicalIndex={historicalIndexes[compare.commit]} projectId={projectId} />{afterEvidenceSlugs.length > 0 && <div className={styles.focusBar} aria-label={`Compare Evidence history focus for ${id}`}>{afterEvidenceSlugs.map((slug) => <Link key={slug} className={slug === selectedEvidence ? styles.clearFocus : undefined} href={historyHref({ ...hrefState, claimId: id, evidenceSlug: slug })}>Focus Evidence: {slug}</Link>)}</div>}</> : <em className={styles.none}>Claim absent from this visible committed snapshot</em>}
                      </div>
                    </div>
                  </section>
                );
              })}
              {!selectedClaim && compareClaimIds.length === 20 && ((selectedEvidence || selectedRelation) ? focusedComparisonClaimIds.length : changedClaimIds(comparisonEvents).length) > compareClaimIds.length && <small className={styles.more}>Showing {compareClaimIds.length} of {(selectedEvidence || selectedRelation) ? focusedComparisonClaimIds.length : changedClaimIds(comparisonEvents).length} matching Claims. Use Claim focus to inspect another identity.</small>}
            </div>
          )}

          {base && compare && !compareClaimIds.length && <p className={styles.empty}>No explicit Claim/Evidence state matches every active history filter in the selected comparison.</p>}
        </article>
      </section>
    </section>
  );
}