const MAX_PAGES = 5000;
const MAX_PAGE_CHARS = 500_000;
const MAX_CANDIDATES = 12;

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function words(value) {
  return normalizeText(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function ngrams(tokens, size) {
  const result = new Set();
  if (tokens.length < size) return result;
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join("\u0001"));
  }
  return result;
}

function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function tokenSimilarity(left, right) {
  const a = words(left);
  const b = words(right);
  if (!a.length || !b.length) return 0;
  const unigram = dice(new Set(a), new Set(b));
  if (a.length < 2 || b.length < 2) return unigram;
  const bigram = dice(ngrams(a, 2), ngrams(b, 2));
  return 0.35 * unigram + 0.65 * bigram;
}

function suffixWords(value, count = 8) {
  return words(value).slice(-count).join(" ");
}

function prefixWords(value, count = 8) {
  return words(value).slice(0, count).join(" ");
}

function contextScore(text, start, end, prefix, suffix) {
  let score = 0;
  let weight = 0;
  const before = normalizeText(text.slice(Math.max(0, start - 500), start)).toLowerCase();
  const after = normalizeText(text.slice(end, Math.min(text.length, end + 500))).toLowerCase();
  const prefixNeedle = suffixWords(prefix);
  const suffixNeedle = prefixWords(suffix);
  if (prefixNeedle) {
    weight += 1;
    if (before.endsWith(prefixNeedle)) score += 1;
    else if (before.includes(prefixNeedle)) score += 0.72;
    else score += 0.45 * tokenSimilarity(before.slice(-Math.max(prefixNeedle.length * 2, 100)), prefixNeedle);
  }
  if (suffixNeedle) {
    weight += 1;
    if (after.startsWith(suffixNeedle)) score += 1;
    else if (after.includes(suffixNeedle)) score += 0.72;
    else score += 0.45 * tokenSimilarity(after.slice(0, Math.max(suffixNeedle.length * 2, 100)), suffixNeedle);
  }
  return weight ? score / weight : 0;
}

function snippetFor(text, start, end) {
  const from = Math.max(0, start - 110);
  const to = Math.min(text.length, end + 150);
  return `${from ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

function pageHintScore(page, start, hint) {
  if (!hint) return 0;
  let score = 0;
  if (Number.isInteger(hint.page) && hint.page === page) score += 0.55;
  if (Number.isInteger(hint.pageTextIndex) && hint.page === page) {
    const distance = Math.abs(start - hint.pageTextIndex);
    score += 0.45 * Math.max(0, 1 - distance / 5000);
  }
  return Math.min(1, score);
}

function exactCandidates(page, text, quote, prefix, suffix, hint) {
  const results = [];
  const lowerText = text.toLowerCase();
  const lowerQuote = quote.toLowerCase();
  let from = 0;
  while (from <= lowerText.length - lowerQuote.length) {
    const start = lowerText.indexOf(lowerQuote, from);
    if (start < 0) break;
    const end = start + quote.length;
    const context = contextScore(text, start, end, prefix, suffix);
    const pageHint = pageHintScore(page, start, hint);
    results.push({
      page,
      start,
      end,
      matchedText: text.slice(start, end),
      snippet: snippetFor(text, start, end),
      matchType: "exact",
      confidence: Math.min(1, 0.9 + context * 0.07 + pageHint * 0.03),
      contextScore: context,
    });
    from = start + Math.max(1, quote.length);
  }
  return results;
}

function tokenSpans(text) {
  const spans = [];
  const pattern = /[\p{L}\p{N}]+/gu;
  let match;
  while ((match = pattern.exec(text))) spans.push({ start: match.index, end: match.index + match[0].length, token: match[0].toLowerCase() });
  return spans;
}

function fuzzyCandidates(page, text, quote, prefix, suffix, hint) {
  const quoteTokens = words(quote);
  if (quoteTokens.length < 4) return [];
  const spans = tokenSpans(text);
  if (spans.length < quoteTokens.length) return [];
  const qLength = quoteTokens.length;
  const quoteUnigrams = new Set(quoteTokens);
  const quoteBigrams = ngrams(quoteTokens, 2);
  const perPage = [];

  for (let index = 0; index <= spans.length - qLength; index += 1) {
    const windowTokens = spans.slice(index, index + qLength).map((item) => item.token);
    const unigram = dice(quoteUnigrams, new Set(windowTokens));
    if (unigram < 0.48) continue;
    const bigram = dice(quoteBigrams, ngrams(windowTokens, 2));
    const similarity = 0.35 * unigram + 0.65 * bigram;
    if (similarity < 0.58) continue;
    const start = spans[index].start;
    const end = spans[index + qLength - 1].end;
    const context = contextScore(text, start, end, prefix, suffix);
    const pageHint = pageHintScore(page, start, hint);
    const confidence = Math.min(0.89, similarity * 0.82 + context * 0.13 + pageHint * 0.05);
    if (confidence < 0.56) continue;
    perPage.push({
      page,
      start,
      end,
      matchedText: text.slice(start, end),
      snippet: snippetFor(text, start, end),
      matchType: "fuzzy",
      confidence,
      contextScore: context,
    });
  }

  return perPage
    .sort((a, b) => b.confidence - a.confidence || a.start - b.start)
    .filter((candidate, index, all) => !all.slice(0, index).some((prior) => Math.abs(prior.start - candidate.start) < Math.max(20, quote.length / 3)))
    .slice(0, 3);
}

export function findPdfReanchorCandidates({ pages, quote, prefix = "", suffix = "", hint = null, limit = 6 } = {}) {
  const exactQuote = normalizeText(quote);
  if (exactQuote.length < 3) return [];
  const pageList = Array.isArray(pages) ? pages.slice(0, MAX_PAGES) : [];
  const exact = [];
  const fuzzy = [];

  for (const item of pageList) {
    const page = Number(item?.page);
    const text = normalizeText(item?.text).slice(0, MAX_PAGE_CHARS);
    if (!Number.isInteger(page) || page < 1 || !text) continue;
    const matches = exactCandidates(page, text, exactQuote, prefix, suffix, hint);
    if (matches.length) exact.push(...matches);
    else fuzzy.push(...fuzzyCandidates(page, text, exactQuote, prefix, suffix, hint));
  }

  return [...exact, ...fuzzy]
    .sort((a, b) => b.confidence - a.confidence || b.contextScore - a.contextScore || a.page - b.page || a.start - b.start)
    .slice(0, Math.max(1, Math.min(MAX_CANDIDATES, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 6)))
    .map((candidate, index) => ({
      id: `candidate-${candidate.page}-${candidate.start}-${index}`,
      ...candidate,
      confidence: Math.round(candidate.confidence * 1000) / 1000,
      contextScore: Math.round(candidate.contextScore * 1000) / 1000,
    }));
}
