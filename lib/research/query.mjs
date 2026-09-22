function tokens(input) {
  return (input.match(/(?:[^\s"]+:"[^"]*"|"[^"]*"|\S+)/g) ?? []).map((raw) => {
    const negated = raw.startsWith("-");
    const token = negated ? raw.slice(1) : raw;
    const colon = token.indexOf(":");
    if (colon > 0) {
      const key = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1).replace(/^"|"$/g, "").trim();
      return { negated, key, value };
    }
    return { negated, value: token.replace(/^"|"$/g, "").trim() };
  }).filter((token) => token.value);
}

function haystack(entry) {
  return [
    entry.title,
    entry.summary,
    entry.text,
    entry.type,
    entry.status,
    entry.research,
    entry.doi,
    ...(entry.tags ?? []),
    ...(entry.authors ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function fieldMatch(entry, key, value) {
  const needle = value.toLowerCase();
  switch (key) {
    case "type":
      return (entry.type ?? "").toLowerCase() === needle;
    case "status":
      return (entry.status ?? "").toLowerCase() === needle;
    case "research":
    case "project":
      return (entry.research ?? "default").toLowerCase() === needle;
    case "tag":
      return (entry.tags ?? []).some((tag) => tag.toLowerCase() === needle);
    case "author":
      return (entry.authors ?? []).some((author) => author.toLowerCase().includes(needle));
    case "doi":
      return (entry.doi ?? "").toLowerCase().includes(needle);
    case "has":
      if (needle === "pdf") return Boolean(entry.pdf);
      if (needle === "source") return Boolean(entry.source?.pdf);
      if (needle === "doi") return Boolean(entry.doi);
      if (needle === "asset") return (entry.assets ?? []).length > 0;
      if (needle === "relationship") return (entry.relationships ?? []).length > 0;
      return false;
    case "relationship":
      return (entry.relationships ?? []).some((relation) => relation.type.toLowerCase() === needle)
        || (entry.incomingRelationships ?? []).some((relation) => relation.type.toLowerCase() === needle);
    case "target":
      return (entry.relationships ?? []).some((relation) => relation.target.toLowerCase() === needle);
    case "source":
      return (entry.source?.pdf ?? "").toLowerCase().includes(needle);
    case "after":
      return Boolean(entry.date && entry.date > value);
    case "before":
      return Boolean(entry.date && entry.date < value);
    default:
      return haystack(entry).includes((key + ":" + value).toLowerCase());
  }
}

export function parseResearchQuery(input = "") {
  return tokens(String(input));
}

export function matchesResearchQuery(entry, input = "") {
  const parsed = Array.isArray(input) ? input : parseResearchQuery(input);
  return parsed.every((token) => {
    const matched = token.key
      ? fieldMatch(entry, token.key, token.value)
      : haystack(entry).includes(token.value.toLowerCase());
    return token.negated ? !matched : matched;
  });
}

export function filterResearchEntries(entries, input = "") {
  const parsed = parseResearchQuery(input);
  return entries.filter((entry) => matchesResearchQuery(entry, parsed));
}
