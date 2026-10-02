import { MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS } from "./manuscript-claim-relations.mjs";

const CLAIM_STATE_EVENTS = new Set([
  "claim-added",
  "claim-removed",
  "claim-text-changed",
  "claim-moved",
]);

const EVIDENCE_TARGET_EVENTS = new Set([
  "evidence-target-added",
  "evidence-target-removed",
]);

const RELATION_EVENTS = new Set([
  "relation-added",
  "relation-removed",
  "relation-changed",
]);

export const MANUSCRIPT_CLAIM_HISTORY_EVENT_TYPES = Object.freeze([
  "claim-added",
  "claim-removed",
  "claim-text-changed",
  "claim-moved",
  "evidence-target-added",
  "evidence-target-removed",
  "relation-added",
  "relation-removed",
  "relation-changed",
]);

export const MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS = Object.freeze({
  "claim-added": "Claim appeared",
  "claim-removed": "Claim left snapshot",
  "claim-text-changed": "Claim text changed",
  "claim-moved": "Claim moved",
  "evidence-target-added": "Evidence target added",
  "evidence-target-removed": "Evidence target removed",
  "relation-added": "Relation added",
  "relation-removed": "Relation removed",
  "relation-changed": "Relation changed",
});

export const MANUSCRIPT_CLAIM_HISTORY_RELATIONS = MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS;

export function isManuscriptClaimHistoryEventType(value) {
  return typeof value === "string" && MANUSCRIPT_CLAIM_HISTORY_EVENT_TYPES.includes(value);
}

export function isManuscriptClaimHistoryRelation(value) {
  return typeof value === "string" && MANUSCRIPT_CLAIM_HISTORY_RELATIONS.includes(value);
}

function eventMatchesRelation(event, relationType) {
  if (!relationType) return true;
  return event.relation === relationType
    || event.beforeRelation === relationType
    || event.afterRelation === relationType;
}

function categoryCounts(events) {
  return {
    claimState: events.filter((event) => CLAIM_STATE_EVENTS.has(event.type)).length,
    evidenceTargets: events.filter((event) => EVIDENCE_TARGET_EVENTS.has(event.type)).length,
    relations: events.filter((event) => RELATION_EVENTS.has(event.type)).length,
  };
}

export function filterManuscriptClaimHistoryEvents(events = [], filters = {}) {
  const claimId = typeof filters.claimId === "string" ? filters.claimId : "";
  const evidenceSlug = typeof filters.evidenceSlug === "string" ? filters.evidenceSlug : "";
  const eventType = isManuscriptClaimHistoryEventType(filters.eventType) ? filters.eventType : "";
  const relationType = isManuscriptClaimHistoryRelation(filters.relationType) ? filters.relationType : "";

  return events.filter((event) => {
    if (claimId && event.claimId !== claimId) return false;
    if (evidenceSlug && event.evidenceSlug !== evidenceSlug) return false;
    if (eventType && event.type !== eventType) return false;
    return eventMatchesRelation(event, relationType);
  });
}

export function buildManuscriptClaimEventComposition(events = [], filters = {}) {
  const filteredEvents = filterManuscriptClaimHistoryEvents(events, filters);
  const rows = MANUSCRIPT_CLAIM_HISTORY_EVENT_TYPES.map((type) => ({
    type,
    label: MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS[type],
    count: filteredEvents.filter((event) => event.type === type).length,
  })).filter((row) => row.count > 0);

  return {
    rows,
    categories: categoryCounts(filteredEvents),
    stats: {
      events: filteredEvents.length,
      eventTypes: rows.length,
      maxCount: rows.reduce((maximum, row) => Math.max(maximum, row.count), 0),
    },
  };
}

export function buildManuscriptClaimActivity(transitions = [], options = {}) {
  const requestedLimit = Number.isInteger(options.limit) ? options.limit : 12;
  const limit = Math.max(1, Math.min(40, requestedLimit));
  const rows = transitions.slice(-limit).map((transition) => {
    const events = filterManuscriptClaimHistoryEvents(transition.events, options);
    const claimIds = [...new Set(events.map((event) => event.claimId).filter(Boolean))].sort();
    const counts = categoryCounts(events);

    return {
      fromCommit: transition.fromCommit,
      toCommit: transition.toCommit,
      at: transition.at,
      subject: transition.subject,
      events: events.length,
      ...counts,
      claimIds,
    };
  });

  const claimIds = [...new Set(rows.flatMap((row) => row.claimIds))].sort();

  return {
    rows,
    stats: {
      transitions: rows.length,
      events: rows.reduce((sum, row) => sum + row.events, 0),
      claims: claimIds.length,
      maxEvents: rows.reduce((maximum, row) => Math.max(maximum, row.events), 0),
    },
  };
}

export function buildManuscriptClaimActivityMatrix(transitions = [], options = {}) {
  const requestedTransitionLimit = Number.isInteger(options.transitionLimit) ? options.transitionLimit : 12;
  const transitionLimit = Math.max(1, Math.min(12, requestedTransitionLimit));
  const requestedClaimLimit = Number.isInteger(options.claimLimit) ? options.claimLimit : 20;
  const claimLimit = Math.max(1, Math.min(20, requestedClaimLimit));
  const window = transitions.slice(-transitionLimit).map((transition) => ({
    transition,
    events: filterManuscriptClaimHistoryEvents(transition.events, options),
  }));
  const allClaimIds = [...new Set(window.flatMap(({ events }) => events.map((event) => event.claimId).filter(Boolean)))].sort();
  const visibleClaimIds = allClaimIds.slice(0, claimLimit);
  let maxCellEvents = 0;
  let changedCells = 0;

  const rows = visibleClaimIds.map((claimId) => {
    const cells = window.map(({ transition, events }) => {
      const claimEvents = events.filter((event) => event.claimId === claimId);
      const counts = categoryCounts(claimEvents);
      const cell = {
        fromCommit: transition.fromCommit,
        toCommit: transition.toCommit,
        events: claimEvents.length,
        ...counts,
      };
      maxCellEvents = Math.max(maxCellEvents, cell.events);
      if (cell.events > 0) changedCells += 1;
      return cell;
    });

    return {
      claimId,
      totalEvents: cells.reduce((sum, cell) => sum + cell.events, 0),
      cells,
    };
  });

  return {
    columns: window.map(({ transition }) => ({
      fromCommit: transition.fromCommit,
      toCommit: transition.toCommit,
      at: transition.at,
      subject: transition.subject,
    })),
    rows,
    stats: {
      transitions: window.length,
      claims: rows.length,
      totalClaims: allClaimIds.length,
      changedCells,
      maxCellEvents,
      truncatedClaims: Math.max(0, allClaimIds.length - rows.length),
    },
  };
}
