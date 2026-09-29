const MAX_DIFF_LINES = 240;
const CONTEXT_LINES = 2;

function linesOf(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));
}

function wordsOf(value) {
  const text = String(value ?? "").trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function lcsDiff(older, newer) {
  const a = linesOf(older).slice(0, MAX_DIFF_LINES);
  const b = linesOf(newer).slice(0, MAX_DIFF_LINES);
  const truncated = linesOf(older).length > MAX_DIFF_LINES || linesOf(newer).length > MAX_DIFF_LINES;
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const raw = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      raw.push({ kind: "unchanged", text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ kind: "removed", text: a[i] });
      i += 1;
    } else {
      raw.push({ kind: "added", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) raw.push({ kind: "removed", text: a[i++] });
  while (j < b.length) raw.push({ kind: "added", text: b[j++] });

  const changed = new Set();
  raw.forEach((line, index) => {
    if (line.kind === "unchanged") return;
    for (let offset = -CONTEXT_LINES; offset <= CONTEXT_LINES; offset += 1) {
      const candidate = index + offset;
      if (candidate >= 0 && candidate < raw.length) changed.add(candidate);
    }
  });

  const diff = [];
  let omitted = false;
  raw.forEach((line, index) => {
    if (!changed.has(index)) {
      if (!omitted) diff.push({ kind: "ellipsis", text: "…" });
      omitted = true;
      return;
    }
    omitted = false;
    diff.push(line);
  });

  return {
    diff,
    addedLines: raw.filter((line) => line.kind === "added").length,
    removedLines: raw.filter((line) => line.kind === "removed").length,
    unchangedLines: raw.filter((line) => line.kind === "unchanged").length,
    truncated,
  };
}

function headingTitles(entry) {
  return (entry?.headings || []).map((heading) => String(heading.title ?? "").trim()).filter(Boolean);
}

export function compareResearchVersions(older, newer) {
  if (!older?.slug || !newer?.slug) throw new Error("Version comparison requires two research entries.");
  const text = lcsDiff(older.content || "", newer.content || "");
  const olderHeadings = headingTitles(older);
  const newerHeadings = headingTitles(newer);
  const olderHeadingSet = new Set(olderHeadings);
  const newerHeadingSet = new Set(newerHeadings);
  const olderWords = Number.isFinite(older.words) ? older.words : wordsOf(older.text || older.content);
  const newerWords = Number.isFinite(newer.words) ? newer.words : wordsOf(newer.text || newer.content);

  return {
    id: `version:${newer.slug}->${older.slug}`,
    older: {
      slug: older.slug,
      title: older.title,
      date: older.date,
      status: older.status,
      words: olderWords,
      href: `/progress/${older.slug}`,
    },
    newer: {
      slug: newer.slug,
      title: newer.title,
      date: newer.date,
      status: newer.status,
      words: newerWords,
      href: `/progress/${newer.slug}`,
    },
    wordDelta: newerWords - olderWords,
    headings: {
      added: newerHeadings.filter((heading) => !olderHeadingSet.has(heading)),
      removed: olderHeadings.filter((heading) => !newerHeadingSet.has(heading)),
    },
    ...text,
  };
}

export function buildResearchVersionComparisons(workspace, { projectId } = {}) {
  const bySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));
  const comparisons = [];
  for (const edge of workspace.graph.edges || []) {
    if (!edge.explicit || edge.type !== "supersedes") continue;
    const newer = bySlug.get(edge.source);
    const older = bySlug.get(edge.target);
    if (!newer || !older) continue;
    if (projectId && (newer.research !== projectId || older.research !== projectId)) continue;
    if (newer.research !== older.research) continue;
    comparisons.push(compareResearchVersions(older, newer));
  }
  return comparisons.sort((a, b) =>
    (a.newer.date || "").localeCompare(b.newer.date || "") ||
    a.newer.title.localeCompare(b.newer.title),
  );
}
