function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function consensusReference(paper = {}) {
  const authors = Array.isArray(paper.authors) ? paper.authors.map(clean).filter(Boolean) : [];
  const authorText = authors.length
    ? authors.length <= 3 ? authors.join(", ") : authors.slice(0, 3).join(", ") + " et al."
    : "Unknown authors";
  const year = Number.isFinite(Number(paper.year)) ? String(Math.trunc(Number(paper.year))) : "n.d.";
  const title = clean(paper.title) || "Untitled paper";
  const journal = clean(paper.journal);
  const doi = clean(paper.doi);
  const url = doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : clean(paper.url);
  return [`${authorText} (${year}). ${title}.`, journal ? `${journal}.` : "", url].filter(Boolean).join(" ");
}

export function consensusMarkdownCitation(paper = {}) {
  const authors = Array.isArray(paper.authors) ? paper.authors.map(clean).filter(Boolean) : [];
  const authorText = authors.length
    ? authors.length <= 2 ? authors.join(" & ") : authors[0] + " et al."
    : "Unknown authors";
  const year = Number.isFinite(Number(paper.year)) ? String(Math.trunc(Number(paper.year))) : "n.d.";
  const title = clean(paper.title) || "Untitled paper";
  const doi = clean(paper.doi);
  const url = doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : clean(paper.url);
  return url ? `[${title}](${url}) — ${authorText} (${year}).` : `${title} — ${authorText} (${year}).`;
}
