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

export function buildManuscriptClaimActivity(transitions = [], options = {}) {
  const requestedLimit = Number.isInteger(options.limit) ? options.limit : 12;
  const limit = Math.max(1, Math.min(40, requestedLimit));
  const rows = transitions.slice(-limit).map((transition) => {
    const events = filterManuscriptClaimHistoryEvents(transition.events, options);
    const claimIds = [...new Set(events.map((event) => event.claimId).filter(Boolean))].sort();

    return {
      fromCommit: transition.fromCommit,
      toCommit: transition.toCommit,
      at: transition.at,
      subject: transition.subject,
      events: events.length,
      claimState: events.filter((event) => CLAIM_STATE_EVENTS.has(event.type)).length,
      evidenceTargets: events.filter((event) => EVIDENCE_TARGET_EVENTS.has(event.type)).length,
      relations: events.filter((event) => RELATION_EVENTS.has(event.type)).length,
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
