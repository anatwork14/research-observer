const TERMINAL = new Set(["complete", "archived"]);

const HEALTH_DEFINITIONS = [
  ["unansweredQuestions", "Unanswered questions"],
  ["experimentsWithoutResults", "Experiments without results"],
  ["resultsWithoutExperiment", "Results without experiment"],
  ["decisionsWithoutBasis", "Decisions without basis"],
  ["literatureMissingPdf", "Literature missing PDF"],
  ["literatureMissingDoi", "Literature missing DOI"],
  ["evidenceMissingSource", "Evidence missing source"],
  ["missingStableIds", "Missing stable IDs"],
];

const PIPELINE_TYPES = ["question", "hypothesis", "literature", "experiment", "result", "evidence", "decision"];

function humanize(value = "") {
  return String(value).replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function monthKey(date) {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : undefined;
}

function monthRange(first, last) {
  if (!first || !last) return [];
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  const out = [];
  let y = fy;
  let m = fm;
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { y += 1; m = 1; }
    if (out.length > 240) break;
  }
  return out;
}

export function selectedResearchIds(workspace, requested = []) {
  const available = new Set((workspace.projects ?? []).filter((project) => project.notes > 0).map((project) => project.id));
  const normalized = [...new Set((requested ?? []).filter((id) => available.has(id)))];
  return normalized.length ? normalized : [...available];
}

export function entriesForResearch(entries, researchIds = []) {
  const ids = new Set(researchIds);
  return ids.size ? entries.filter((entry) => ids.has(entry.research ?? "default")) : entries;
}

export function buildVersionGroups(entries = []) {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const adjacency = new Map();
  const edges = [];

  for (const entry of entries) {
    for (const relation of entry.relationships ?? []) {
      if (relation.type !== "supersedes" || !bySlug.has(relation.target)) continue;
      const older = bySlug.get(relation.target);
      if ((older?.research ?? "default") !== (entry.research ?? "default")) continue;
      edges.push({ newer: entry.slug, older: relation.target });
      if (!adjacency.has(entry.slug)) adjacency.set(entry.slug, new Set());
      if (!adjacency.has(relation.target)) adjacency.set(relation.target, new Set());
      adjacency.get(entry.slug).add(relation.target);
      adjacency.get(relation.target).add(entry.slug);
    }
  }

  const seen = new Set();
  const groups = [];
  for (const slug of adjacency.keys()) {
    if (seen.has(slug)) continue;
    const stack = [slug];
    const component = [];
    while (stack.length) {
      const current = stack.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      component.push(current);
      for (const neighbor of adjacency.get(current) ?? []) stack.push(neighbor);
    }
    const versions = component
      .map((item) => bySlug.get(item))
      .filter(Boolean)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.order - b.order || a.slug.localeCompare(b.slug));
    const componentSet = new Set(component);
    groups.push({
      id: versions.map((entry) => entry.slug).join("--"),
      title: versions.at(-1)?.title ?? "Version lineage",
      research: versions.at(-1)?.research ?? "default",
      versions,
      edges: edges.filter((edge) => componentSet.has(edge.newer) && componentSet.has(edge.older)),
    });
  }
  return groups.sort((a, b) => (b.versions.at(-1)?.date ?? "").localeCompare(a.versions.at(-1)?.date ?? "") || b.versions.length - a.versions.length);
}

export function diffResearchVersions(base, compare, limit = 320) {
  const a = String(base?.content ?? "").split(/\r?\n/).slice(0, limit);
  const b = String(compare?.content ?? "").split(/\r?\n/).slice(0, limit);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const out = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      out.push({ type: "same", text: a[i - 1] });
      i -= 1; j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.push({ type: "added", text: b[j - 1] });
      j -= 1;
    } else {
      out.push({ type: "removed", text: a[i - 1] });
      i -= 1;
    }
  }
  out.reverse();

  return {
    lines: out,
    added: out.filter((line) => line.type === "added").length,
    removed: out.filter((line) => line.type === "removed").length,
    unchanged: out.filter((line) => line.type === "same").length,
    truncated: String(base?.content ?? "").split(/\r?\n/).length > limit || String(compare?.content ?? "").split(/\r?\n/).length > limit,
  };
}

export function buildResearchAnalytics(workspace, researchIds = []) {
  const selected = selectedResearchIds(workspace, researchIds);
  const entries = entriesForResearch(workspace.entries, selected);
  const selectedSet = new Set(selected);

  const countBy = (field) => {
    const counts = new Map();
    for (const entry of entries) {
      const value = entry[field] ?? "unspecified";
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].map(([key, value]) => ({ key, label: humanize(key), value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  };

  const relationshipCounts = new Map();
  for (const entry of entries) {
    for (const relation of entry.relationships ?? []) {
      relationshipCounts.set(relation.type, (relationshipCounts.get(relation.type) ?? 0) + 1);
    }
  }

  const monthsWithData = entries.map((entry) => monthKey(entry.date)).filter(Boolean).sort();
  const months = monthsWithData.length ? monthRange(monthsWithData[0], monthsWithData.at(-1)) : [];
  const activity = months.map((month) => ({
    month,
    total: entries.filter((entry) => monthKey(entry.date) === month).length,
    evidence: entries.filter((entry) => monthKey(entry.date) === month && entry.type === "evidence").length,
    experiments: entries.filter((entry) => monthKey(entry.date) === month && entry.type === "experiment").length,
    results: entries.filter((entry) => monthKey(entry.date) === month && entry.type === "result").length,
  }));

  const projectRows = (workspace.projects ?? [])
    .filter((project) => selectedSet.has(project.id))
    .map((project) => ({
      ...project,
      completion: project.notes ? Math.round(((project.notes - project.active) / project.notes) * 100) : 0,
    }));

  const slugToResearch = new Map(workspace.entries.map((entry) => [entry.slug, entry.research ?? "default"]));
  const healthRows = projectRows.map((project) => ({
    id: project.id,
    label: project.label,
    issues: HEALTH_DEFINITIONS.map(([key, label]) => ({
      key,
      label,
      value: (workspace.health[key] ?? []).filter((slug) => slugToResearch.get(slug) === project.id).length,
    })),
  }));

  const pipeline = PIPELINE_TYPES.map((type) => ({
    key: type,
    label: humanize(type),
    value: entries.filter((entry) => entry.type === type).length,
  }));

  const crossProject = [];
  for (const entry of entries) {
    for (const relation of entry.relationships ?? []) {
      const targetResearch = slugToResearch.get(relation.target);
      if (!targetResearch || targetResearch === entry.research || !selectedSet.has(targetResearch)) continue;
      crossProject.push({
        source: entry.slug,
        sourceResearch: entry.research,
        target: relation.target,
        targetResearch,
        type: relation.type,
      });
    }
  }

  return {
    researchIds: selected,
    entries,
    projects: projectRows,
    totals: {
      notes: entries.length,
      active: entries.filter((entry) => !TERMINAL.has(entry.status ?? "")).length,
      words: entries.reduce((sum, entry) => sum + entry.words, 0),
      dated: entries.filter((entry) => entry.date).length,
      evidence: entries.filter((entry) => entry.type === "evidence").length,
      papers: entries.filter((entry) => entry.type === "literature").length,
      relationships: entries.reduce((sum, entry) => sum + (entry.relationships?.length ?? 0), 0),
      crossProjectRelationships: crossProject.length,
    },
    types: countBy("type"),
    statuses: countBy("status"),
    relationships: [...relationshipCounts.entries()].map(([key, value]) => ({ key, label: humanize(key), value })).sort((a, b) => b.value - a.value),
    pipeline,
    activity,
    healthRows,
    crossProject,
    timelineEntries: entries
      .filter((entry) => entry.date)
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order),
    undatedEntries: entries.filter((entry) => !entry.date),
    versionGroups: buildVersionGroups(entries),
  };
}
