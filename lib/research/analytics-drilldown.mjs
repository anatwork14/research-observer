const FOCUSES = new Set(["type", "status", "relation", "month", "project", "health", "cross-project", "evidence-signal"]);
const EVIDENCE_SIGNALS = new Set(["supports", "contradicts", "answers"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function humanize(value = "") {
  return String(value).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeAnalyticsDrilldown(input = {}) {
  const focus = clean(input.focus);
  return {
    focus: FOCUSES.has(focus) ? focus : "",
    value: clean(input.value),
    project: clean(input.project),
    sourceProject: clean(input.sourceProject),
    targetProject: clean(input.targetProject),
  };
}

export function hasAnalyticsDrilldown(filters = {}) {
  const normalized = normalizeAnalyticsDrilldown(filters);
  if (!normalized.focus) return false;
  if (normalized.focus === "cross-project") return Boolean(normalized.sourceProject && normalized.targetProject);
  return Boolean(normalized.value);
}

function projectLabel(projects, id) {
  return projects.find((project) => project.id === id)?.label ?? id;
}

function relationRows(entries, type, sourceProject = "", targetProject = "") {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const rows = [];
  for (const entry of entries) {
    for (const relation of entry.relationships ?? []) {
      const target = bySlug.get(relation.target);
      if (type && relation.type !== type) continue;
      if (sourceProject && (entry.research ?? "default") !== sourceProject) continue;
      if (targetProject && (target?.research ?? "default") !== targetProject) continue;
      if (targetProject && !target) continue;
      rows.push({ source: entry, target, relation });
    }
  }
  return rows;
}

function evidenceSignalRows(entries) {
  return relationRows(entries, "").filter((row) => row.source.type === "evidence" && EVIDENCE_SIGNALS.has(row.relation.type) && row.target);
}

function candidateEvidenceTargets(entries) {
  return entries.filter((entry) => entry.type !== "evidence" && entry.type !== "literature");
}

export function buildAnalyticsDrilldown({ workspace, analytics, filters } = {}) {
  const normalized = normalizeAnalyticsDrilldown(filters);
  const entries = analytics?.entries ?? [];
  const projects = analytics?.projects ?? [];
  if (!hasAnalyticsDrilldown(normalized)) return null;

  if (normalized.focus === "type") {
    const matches = entries.filter((entry) => (entry.type ?? "unspecified") === normalized.value);
    return {
      kind: "entries",
      title: `${humanize(normalized.value)} research objects`,
      description: `Objects whose compiled research type is exactly “${normalized.value}”.`,
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "status") {
    const matches = entries.filter((entry) => (entry.status ?? "unspecified") === normalized.value);
    return {
      kind: "entries",
      title: `${humanize(normalized.value)} status`,
      description: `Objects whose current compiled workflow status is exactly “${normalized.value}”.`,
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "month") {
    const matches = entries.filter((entry) => typeof entry.date === "string" && entry.date.startsWith(`${normalized.value}-`));
    return {
      kind: "entries",
      title: `Dated work in ${normalized.value}`,
      description: "Research objects with an explicit date in this calendar month.",
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "project") {
    const matches = entries.filter((entry) => (entry.research ?? "default") === normalized.value);
    const label = projectLabel(projects, normalized.value);
    return {
      kind: "entries",
      title: `${label} objects`,
      description: "Objects inside the selected compiled research-project scope.",
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "health") {
    const slugs = new Set(Array.isArray(workspace?.health?.[normalized.value]) ? workspace.health[normalized.value] : []);
    const matches = entries.filter((entry) => slugs.has(entry.slug) && (!normalized.project || (entry.research ?? "default") === normalized.project));
    const suffix = normalized.project ? ` · ${projectLabel(projects, normalized.project)}` : "";
    return {
      kind: "entries",
      title: `${humanize(normalized.value)}${suffix}`,
      description: "Compiler-detected integrity condition. This is a factual diagnostic count, not a quality score.",
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "relation") {
    const relations = relationRows(entries, normalized.value);
    const unique = new Map();
    for (const row of relations) unique.set(row.source.slug, row.source);
    return {
      kind: "relations",
      title: `${humanize(normalized.value)} relationships`,
      description: `Explicit authored “${normalized.value}” relationships in the selected research scope.`,
      entries: [...unique.values()],
      relations,
      count: relations.length,
    };
  }

  if (normalized.focus === "evidence-signal") {
    const signals = evidenceSignalRows(entries);
    if (EVIDENCE_SIGNALS.has(normalized.value)) {
      const relations = signals.filter((row) => row.relation.type === normalized.value);
      return {
        kind: "relations",
        title: `${humanize(normalized.value)} evidence signals`,
        description: `Explicit “${normalized.value}” relationships authored from Evidence objects to research targets.`,
        entries: [...new Map(relations.map((row) => [row.target.slug, row.target])).values()],
        relations,
        count: relations.length,
      };
    }
    const targetSlugs = new Set(signals.map((row) => row.target.slug));
    const candidates = candidateEvidenceTargets(entries);
    const matches = normalized.value === "with"
      ? candidates.filter((entry) => targetSlugs.has(entry.slug))
      : normalized.value === "without"
        ? candidates.filter((entry) => !targetSlugs.has(entry.slug))
        : [];
    return {
      kind: "entries",
      title: normalized.value === "with" ? "Objects with explicit evidence signals" : "Objects with no explicit evidence signal",
      description: normalized.value === "with"
        ? "Research objects targeted by at least one explicit supports, contradicts, or answers relationship from an Evidence object."
        : "No explicit supports, contradicts, or answers relationship from an Evidence object currently targets these objects. This is an absence-of-link view, not a quality judgment.",
      entries: matches,
      relations: [],
      count: matches.length,
    };
  }

  if (normalized.focus === "cross-project") {
    const relations = relationRows(entries, "", normalized.sourceProject, normalized.targetProject)
      .filter((row) => row.target && (row.target.research ?? "default") !== (row.source.research ?? "default"));
    return {
      kind: "relations",
      title: `${projectLabel(projects, normalized.sourceProject)} → ${projectLabel(projects, normalized.targetProject)}`,
      description: "Explicit typed relationships crossing this exact project boundary.",
      entries: [...new Map(relations.map((row) => [row.source.slug, row.source])).values()],
      relations,
      count: relations.length,
    };
  }

  return null;
}

export function buildEvidenceSignalSummary(entries = []) {
  const signals = evidenceSignalRows(entries);
  const evidence = entries.filter((entry) => entry.type === "evidence");
  const targetSlugs = new Set(signals.map((row) => row.target.slug));
  const candidates = candidateEvidenceTargets(entries);
  return {
    evidence: evidence.length,
    signals: signals.length,
    supports: signals.filter((row) => row.relation.type === "supports").length,
    contradicts: signals.filter((row) => row.relation.type === "contradicts").length,
    answers: signals.filter((row) => row.relation.type === "answers").length,
    targetsWithSignals: targetSlugs.size,
    targetsWithoutSignals: candidates.filter((entry) => !targetSlugs.has(entry.slug)).length,
  };
}
