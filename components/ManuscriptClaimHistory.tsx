import Link from "next/link";
import {
  compareManuscriptClaimSnapshots,
  type ManuscriptClaimEvolution,
  type ManuscriptClaimHistoryEvent,
  type ManuscriptClaimHistoryLink,
  type ManuscriptClaimHistorySnapshot,
} from "@/lib/research/manuscript-claim-history.mjs";
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function snapshotLabel(snapshot: ManuscriptClaimHistorySnapshot) {
  return `${snapshot.shortCommit} · ${formatDate(snapshot.at)} · ${snapshot.subject || "Manuscript revision"}`;
}

function eventDetail(event: ManuscriptClaimHistoryEvent) {
  if (event.type === "relation-changed") return `${event.beforeRelation} → ${event.afterRelation} · ${event.evidenceSlug}`;
  if (event.type === "relation-added" || event.type === "relation-removed") return `${event.relation} · ${event.evidenceSlug}`;
  if (event.type === "evidence-target-added" || event.type === "evidence-target-removed") return event.evidenceSlug || "Evidence target";
  if (event.type === "claim-moved") return `${event.before || "unknown"} → ${event.after || "unknown"}`;
  return "";
}

function linkLabel(link: ManuscriptClaimHistoryLink) {
  return `${link.relation} · ${link.evidenceTitle || link.evidenceSlug}`;
}

function ClaimLinks({ links }: { links: ManuscriptClaimHistoryLink[] }) {
  if (!links.length) return <em className={styles.none}>No authored Evidence links</em>;
  return (
    <div className={styles.linkList}>
      {links.map((link) => link.currentCanonical ? (
        <Link href={`/progress/${encodeURIComponent(link.evidenceSlug)}`} key={`${link.relation}:${link.evidenceSlug}`}>
          <span>{linkLabel(link)}</span><small>{link.evidenceSlug}</small>
        </Link>
      ) : (
        <span className={styles.historicalLink} key={`${link.relation}:${link.evidenceSlug}`}>
          <span>{link.relation} · {link.evidenceSlug}</span><small>historical authored slug · not current canonical Evidence</small>
        </span>
      ))}
    </div>
  );
}

function snapshotClaim(snapshot: ManuscriptClaimHistorySnapshot, claimId: string) {
  return snapshot.claims.find((claim) => claim.claimId === claimId);
}

function snapshotLinks(snapshot: ManuscriptClaimHistorySnapshot, claimId: string) {
  return snapshot.links.filter((link) => link.claimId === claimId);
}

function changedClaimIds(events: ManuscriptClaimHistoryEvent[]) {
  return [...new Set(events.map((event) => event.claimId).filter(Boolean))].sort();
}

function transitionEvents(events: ManuscriptClaimHistoryEvent[], claimId: string) {
  return claimId ? events.filter((event) => event.claimId === claimId) : events;
}

export function ManuscriptClaimHistory({
  evolution,
  projectId,
  baseCommit,
  compareCommit,
  claimId = "",
}: {
  evolution: ManuscriptClaimEvolution;
  projectId: string;
  baseCommit?: string;
  compareCommit?: string;
  claimId?: string;
}) {
  const snapshots = evolution.snapshots || [];
  const claimIds = [...new Set(snapshots.flatMap((snapshot) => snapshot.claims.map((claim) => claim.claimId)))].sort();
  const selectedClaim = claimIds.includes(claimId) ? claimId : "";
  const latest = snapshots.at(-1);
  const previous = snapshots.at(-2) || latest;
  const base = snapshots.find((snapshot) => snapshot.commit === baseCommit) || previous;
  const compare = snapshots.find((snapshot) => snapshot.commit === compareCommit) || latest;
  const comparison = base && compare ? compareManuscriptClaimSnapshots(base, compare) : null;
  const comparisonEvents = comparison ? transitionEvents(comparison.events, selectedClaim) : [];
  const compareClaimIds = selectedClaim
    ? [selectedClaim]
    : changedClaimIds(comparisonEvents).slice(0, 20);
  const uniqueHistoricalClaims = new Set(snapshots.flatMap((snapshot) => snapshot.claims.map((claim) => claim.claimId))).size;
  const dirtyFiles = evolution.dirtyFiles || [];

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
        {dirtyFiles.length > 0 && <p className={styles.dirty}>Working changes are present in {dirtyFiles.join(", ")}; they are intentionally excluded from committed history.</p>}
      </section>
    );
  }

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
        <article className="panel"><span>Working changes</span><strong>{dirtyFiles.length}</strong><small>excluded from committed history</small></article>
      </section>

      {dirtyFiles.length > 0 && (
        <p className={styles.dirty}>
          Unsaved or uncommitted manuscript state exists in {dirtyFiles.join(", ")}. The history below uses committed Git snapshots only.
        </p>
      )}

      <section className={`${styles.controls} panel`}>
        <div className={styles.controlsHeading}>
          <div><span className="kicker">Revision compare</span><h3>Compare explicit authored state</h3></div>
          <p>Base → Compare is directional. Claim focus filters the event list and side-by-side inspection without changing the underlying snapshots.</p>
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
          <button type="submit">Compare revisions</button>
        </form>
      </section>

      <section className={styles.grid}>
        <article className={`${styles.timelinePanel} panel`}>
          <header className={styles.panelHeading}>
            <div><span className="kicker">Chronology</span><h3>Authored semantic changes</h3></div>
            <p>{selectedClaim ? `Showing events for Claim ${selectedClaim}.` : "Showing explicit Claim/Evidence events across adjacent committed snapshots."}</p>
          </header>
          <div className={styles.timeline}>
            {evolution.transitions.slice().reverse().map((transition) => {
              const events = transitionEvents(transition.events, selectedClaim);
              if (!events.length) return null;
              const targetSnapshot = snapshots.find((snapshot) => snapshot.commit === transition.toCommit);
              return (
                <div className={styles.transition} key={`${transition.fromCommit}:${transition.toCommit}`}>
                  <div className={styles.transitionMeta}>
                    <time dateTime={transition.at}>{formatDate(transition.at)}</time>
                    <code>{transition.toCommit.slice(0, 10)}</code>
                    {targetSnapshot?.stateChanged && <span>visibility state changed</span>}
                  </div>
                  <strong>{transition.subject || "Manuscript revision"}</strong>
                  <div className={styles.eventCounts}>
                    {EVENT_ORDER.map((type) => {
                      const count = events.filter((event) => event.type === type).length;
                      return count ? <span key={type}>{EVENT_LABELS[type]} · {count}</span> : null;
                    })}
                  </div>
                  <div className={styles.eventList}>
                    {events.slice(0, 10).map((event, index) => (
                      <div key={`${event.type}:${event.claimId}:${event.evidenceSlug || ""}:${index}`}>
                        <span>{EVENT_LABELS[event.type]}</span>
                        <strong>{event.claimId}</strong>
                        {eventDetail(event) && <small>{eventDetail(event)}</small>}
                      </div>
                    ))}
                    {events.length > 10 && <small className={styles.more}>Showing 10 of {events.length} events for this revision transition.</small>}
                  </div>
                </div>
              );
            })}
            {!evolution.transitions.some((transition) => transitionEvents(transition.events, selectedClaim).length > 0) && (
              <p className={styles.empty}>No explicit authored semantic changes match this Claim focus in the scanned revision window.</p>
            )}
          </div>
        </article>

        <article className={`${styles.comparePanel} panel`}>
          <header className={styles.panelHeading}>
            <div><span className="kicker">Side by side</span><h3>Selected revision state</h3></div>
            <p>{comparisonEvents.length} explicit change{comparisonEvents.length === 1 ? "" : "s"} in this comparison{selectedClaim ? ` for ${selectedClaim}` : ""}.</p>
          </header>

          {base && compare && (
            <div className={styles.revisionPair}>
              <div>
                <span>Base</span><code>{base.shortCommit}</code><strong>{base.subject || "Manuscript revision"}</strong><small>{formatDate(base.at)} · {base.stats.claims} Claims · {base.stats.links} authored links</small>
              </div>
              <div>
                <span>Compare</span><code>{compare.shortCommit}</code><strong>{compare.subject || "Manuscript revision"}</strong><small>{formatDate(compare.at)} · {compare.stats.claims} Claims · {compare.stats.links} authored links</small>
              </div>
            </div>
          )}

          {base && compare && compareClaimIds.length > 0 && (
            <div className={styles.claimComparisons}>
              {compareClaimIds.map((id) => {
                const before = snapshotClaim(base, id);
                const after = snapshotClaim(compare, id);
                const beforeLinks = snapshotLinks(base, id);
                const afterLinks = snapshotLinks(compare, id);
                return (
                  <section className={styles.claimCompare} key={id}>
                    <header><strong>{id}</strong><span>{before && after ? "present in both" : before ? "left compared snapshot" : "entered compared snapshot"}</span></header>
                    <div className={styles.claimPair}>
                      <div>
                        <span>Base</span>
                        {before ? <><p>{before.excerpt}</p><small>{before.file}{before.section ? ` · ${before.section}` : ""}</small><ClaimLinks links={beforeLinks} /></> : <em className={styles.none}>Claim absent from this visible committed snapshot</em>}
                      </div>
                      <div>
                        <span>Compare</span>
                        {after ? <><p>{after.excerpt}</p><small>{after.file}{after.section ? ` · ${after.section}` : ""}</small><ClaimLinks links={afterLinks} /></> : <em className={styles.none}>Claim absent from this visible committed snapshot</em>}
                      </div>
                    </div>
                  </section>
                );
              })}
              {!selectedClaim && changedClaimIds(comparisonEvents).length > compareClaimIds.length && <small className={styles.more}>Showing {compareClaimIds.length} of {changedClaimIds(comparisonEvents).length} changed Claims. Use Claim focus to inspect another identity.</small>}
            </div>
          )}

          {base && compare && !compareClaimIds.length && <p className={styles.empty}>No explicit Claim/Evidence changes in the selected comparison.</p>}
        </article>
      </section>
    </section>
  );
}
