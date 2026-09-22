const DEFAULT_BASE_URL = "https://api.consensus.app";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function authorName(author) {
  if (typeof author === "string") return author.trim();
  if (!author || typeof author !== "object") return "";
  return cleanString(author.name) || [cleanString(author.first_name), cleanString(author.last_name)].filter(Boolean).join(" ");
}

function integer(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

export function normalizeConsensusPaper(raw = {}) {
  const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const authorsRaw = first(raw.authors, metadata.authors, []);
  const authors = Array.isArray(authorsRaw)
    ? authorsRaw.map(authorName).filter(Boolean)
    : cleanString(authorsRaw) ? [cleanString(authorsRaw)] : [];

  const fullTextRaw = first(raw.full_text_chunks, raw.fullTextChunks, []);
  const fullTextChunks = Array.isArray(fullTextRaw)
    ? fullTextRaw.map((chunk) => {
        if (typeof chunk === "string") return { text: chunk };
        if (!chunk || typeof chunk !== "object") return null;
        const text = cleanString(first(chunk.text, chunk.content, chunk.chunk));
        if (!text) return null;
        return { text, section: cleanString(first(chunk.section, chunk.section_name)) || undefined };
      }).filter(Boolean)
    : [];

  const id = cleanString(first(raw.id, raw.paper_id, metadata.id));
  const title = cleanString(first(raw.title, metadata.title));
  const url = cleanString(first(raw.url, raw.consensus_url, metadata.url));
  const doi = cleanString(first(raw.doi, metadata.doi));
  const abstract = cleanString(first(raw.abstract, raw.text, metadata.abstract));
  const takeaway = cleanString(first(raw.takeaway, raw.key_takeaway, metadata.takeaway));
  const journal = cleanString(first(raw.journal, raw.journal_name, metadata.journal, metadata.journal_name));
  const studyType = cleanString(first(raw.study_type, metadata.study_type));
  const year = integer(first(raw.year, raw.publish_year, raw.publication_year, metadata.year));
  const citationCount = integer(first(raw.citation_count, raw.citations, metadata.citation_count));
  const semanticScore = Number(first(raw.semantic_score, raw.relevance_score, metadata.semantic_score));

  return {
    id,
    title,
    authors,
    year,
    journal,
    doi: doi || undefined,
    url,
    abstract: abstract || undefined,
    takeaway: takeaway || undefined,
    studyType: studyType || undefined,
    citationCount,
    semanticScore: Number.isFinite(semanticScore) ? semanticScore : undefined,
    fullTextChunks,
  };
}

export function normalizeConsensusSearch(payload = {}) {
  const candidate = Array.isArray(payload)
    ? payload
    : first(payload.papers, payload.results, payload.data, []);
  const rows = Array.isArray(candidate) ? candidate : [];
  return {
    query: cleanString(first(payload.query, payload.search_query)),
    totalResults: integer(first(payload.total_results, payload.total, rows.length)) ?? rows.length,
    papers: rows.map(normalizeConsensusPaper).filter((paper) => paper.title && paper.url),
  };
}

export function buildConsensusSearchParams(input = {}) {
  const query = cleanString(input.query);
  if (!query) throw new Error("Consensus search requires a query.");

  const params = new URLSearchParams({ query });
  const pageSize = Math.min(50, Math.max(1, integer(input.pageSize) ?? 12));
  params.set("page_size", String(pageSize));
  params.set("include_semantic_score", "true");

  const yearMin = integer(input.yearMin);
  const yearMax = integer(input.yearMax);
  const citationMin = integer(input.citationMin);
  if (yearMin && yearMin >= 1000 && yearMin <= 9999) params.set("year_min", String(yearMin));
  if (yearMax && yearMax >= 1000 && yearMax <= 9999) params.set("year_max", String(yearMax));
  if (citationMin !== undefined && citationMin >= 0) params.set("citation_min", String(citationMin));
  if (input.excludePreprints === true) params.set("exclude_preprints", "true");
  if (input.openAccess === true) params.set("open_access", "true");
  if (input.human === true) params.set("human", "true");
  if (input.medicalMode === true) params.set("medical_mode", "true");
  if (input.includeFullText === true) params.set("include_full_text_chunks", "true");

  const studyTypes = Array.isArray(input.studyTypes)
    ? input.studyTypes.map(cleanString).filter(Boolean).slice(0, 8)
    : [];
  for (const type of studyTypes) params.append("study_types", type);

  return params;
}

export async function searchConsensus(input = {}, options = {}) {
  const apiKey = cleanString(options.apiKey ?? process.env.CONSENSUS_API_KEY);
  if (!apiKey) {
    const error = new Error("Consensus is not configured. Set CONSENSUS_API_KEY on the server.");
    error.code = "CONSENSUS_NOT_CONFIGURED";
    throw error;
  }

  const baseUrl = cleanString(options.baseUrl ?? process.env.CONSENSUS_API_BASE_URL) || DEFAULT_BASE_URL;
  const params = buildConsensusSearchParams(input);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/search?${params.toString()}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "accept": "application/json",
    },
    signal: options.signal,
    cache: "no-store",
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const detail = cleanString(first(payload.detail, payload.message, payload.error));
    const error = new Error(detail || `Consensus search failed with HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return normalizeConsensusSearch(payload);
}

export function consensusConfigured() {
  return Boolean(cleanString(process.env.CONSENSUS_API_KEY));
}
