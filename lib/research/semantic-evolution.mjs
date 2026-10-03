const EVIDENCE_RELATION_TYPES = new Set(["supports", "contradicts", "answers"]);
const FIELD_DEFINITIONS = [
  ["title", "Title"],
  ["summary", "Summary"],
  ["type", "Type"],
  ["status", "Status"],
];

function scalar(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function diffStrings(before = [], after = []) {
  const left = uniqueStrings(before);
  const right = uniqueStrings(after);
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return {
    added: right.filter((value) => !leftSet.has(value)),
    removed: left.filter((value) => !rightSet.has(value)),
  };
}

function relationKey(relation, direction) {
  const endpoint = direction === "incoming" ? relation?.source : relation?.target;
  return [relation?.type ?? "", endpoint ?? "", relation?.note ?? ""].join("\u0000");
}

function normalizeRelation(relation, direction) {
  return {
    type: typeof relation?.type === "string" ? relation.type : "references",
    ...(direction === "incoming"
      ? { source: typeof relation?.source === "string" ? relation.source : "unknown" }
      : { target: typeof relation?.target === "string" ? relation.target : "unknown" }),
    ...(typeof relation?.note === "string" && relation.note.trim() ? { note: relation.note.trim() } : {}),
  };
}

function diffRelations(before = [], after = [], direction = "outgoing") {
  const left = before.filter((relation) => relation?.type !== "supersedes");
  const right = after.filter((relation) => relation?.type !== "supersedes");
  const leftKeys = new Set(left.map((relation) => relationKey(relation, direction)));
  const rightKeys = new Set(right.map((relation) => relationKey(relation, direction)));
  return {
    added: right.filter((relation) => !leftKeys.has(relationKey(relation, direction))).map((relation) => normalizeRelation(relation, direction)),
    removed: left.filter((relation) => !rightKeys.has(relationKey(relation, direction))).map((relation) => normalizeRelation(relation, direction)),
  };
}

function sourceFingerprint(source) {
  if (!source || typeof source !== "object") return "";
  return JSON.stringify({
    kind: source.kind ?? null,
    pdf: source.pdf ?? null,
    page: source.page ?? null,
    url: source.url ?? null,
    doi: source.doi ?? null,
    paperId: source.paperId ?? null,
    query: source.query ?? null,
  });
}

function sourceLabel(source) {
  if (!source || typeof source !== "object") return undefined;
  if (source.kind === "pdf" || source.pdf) {
    return [source.pdf || "Local PDF", source.page ? `p.${source.page}` : undefined].filter(Boolean).join(" · ");
  }
  return source.doi || source.url || source.paperId || (source.kind ? String(source.kind) : "External source");
}

function changedCount(change) {
  return (change?.added?.length ?? 0) + (change?.removed?.length ?? 0);
}

export function diffResearchSemantics(base = {}, compare = {}) {
  const fieldChanges = FIELD_DEFINITIONS.flatMap(([field, label]) => {
    const before = scalar(base?.[field]);
    const after = scalar(compare?.[field]);
    if (before === after) return [];
    return [{ field, label, before, after }];
  });

  const baseSource = sourceFingerprint(base?.source);
  const compareSource = sourceFingerprint(compare?.source);
  if (baseSource !== compareSource) {
    fieldChanges.push({
      field: "source",
      label: "Evidence source",
      before: sourceLabel(base?.source),
      after: sourceLabel(compare?.source),
    });
  }

  const tags = diffStrings(base?.tags, compare?.tags);
  const assets = diffStrings(base?.assets, compare?.assets);
  const headings = diffStrings(
    (base?.headings ?? []).map((heading) => heading?.title),
    (compare?.headings ?? []).map((heading) => heading?.title),
  );
  const relationships = diffRelations(base?.relationships, compare?.relationships, "outgoing");
  const incomingRelationships = diffRelations(base?.incomingRelationships, compare?.incomingRelationships, "incoming");
  const incomingEvidence = {
    added: incomingRelationships.added.filter((relation) => EVIDENCE_RELATION_TYPES.has(relation.type)),
    removed: incomingRelationships.removed.filter((relation) => EVIDENCE_RELATION_TYPES.has(relation.type)),
  };

  const dimensions = [
    fieldChanges.length,
    changedCount(tags),
    changedCount(headings),
    changedCount(assets),
    changedCount(relationships),
    changedCount(incomingRelationships),
  ];

  const summary = {
    changedDimensions: dimensions.filter((value) => value > 0).length,
    fieldChanges: fieldChanges.length,
    tagChanges: changedCount(tags),
    headingChanges: changedCount(headings),
    assetChanges: changedCount(assets),
    relationshipChanges: changedCount(relationships),
    incomingRelationshipChanges: changedCount(incomingRelationships),
    evidenceSignalChanges: changedCount(incomingEvidence),
  };

  return {
    fieldChanges,
    tags,
    headings,
    assets,
    relationships,
    incomingRelationships,
    incomingEvidence,
    summary,
    hasChanges: summary.changedDimensions > 0,
  };
}

export function buildResearchEvolutionTrail(versions = []) {
  return versions.map((entry, index) => ({
    index,
    slug: entry?.slug ?? `version-${index + 1}`,
    title: entry?.title ?? `Version ${index + 1}`,
    date: entry?.date,
    status: entry?.status,
    changes: index === 0 ? null : diffResearchSemantics(versions[index - 1], entry),
  }));
}
