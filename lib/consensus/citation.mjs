function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDoi(value) {
  return clean(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

function sourceUrl(paper = {}) {
  const doi = normalizeDoi(paper.doi);
  if (doi) return `https://doi.org/${doi}`;
  const url = clean(paper.url);
  return /^https:\/\//i.test(url) ? url : "";
}

export function consensusReference(paper = {}) {
  const authors = Array.isArray(paper.authors) ? paper.authors.map(clean).filter(Boolean) : [];
  const authorText = authors.length
    ? authors.length <= 3 ? authors.join(", ") : authors.slice(0, 3).join(", ") + " et al."
    : "Unknown authors";
  const year = Number.isFinite(Number(paper.year)) ? String(Math.trunc(Number(paper.year))) : "n.d.";
  const title = clean(paper.title) || "Untitled paper";
  const journal = clean(paper.journal);
  const url = sourceUrl(paper);
  return [`${authorText} (${year}). ${title}.`, journal ? `${journal}.` : "", url].filter(Boolean).join(" ");
}

export function consensusMarkdownCitation(paper = {}) {
  const authors = Array.isArray(paper.authors) ? paper.authors.map(clean).filter(Boolean) : [];
  const authorText = authors.length
    ? authors.length <= 2 ? authors.join(" & ") : authors[0] + " et al."
    : "Unknown authors";
  const year = Number.isFinite(Number(paper.year)) ? String(Math.trunc(Number(paper.year))) : "n.d.";
  const title = clean(paper.title) || "Untitled paper";
  const url = sourceUrl(paper);
  return url ? `[${title}](${url}) — ${authorText} (${year}).` : `${title} — ${authorText} (${year}).`;
}
