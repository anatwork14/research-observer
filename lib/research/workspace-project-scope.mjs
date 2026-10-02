export function parseResearchProjectScope(value, options = {}) {
  const values = Array.isArray(value) ? value : [value];
  const available = Array.isArray(options.availableIds) && options.availableIds.length
    ? new Set(options.availableIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))
    : null;
  const seen = new Set();
  const ids = [];

  for (const item of values) {
    if (typeof item !== "string") continue;
    for (const part of item.split(",")) {
      const id = part.trim();
      if (!id || seen.has(id) || (available && !available.has(id))) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

export function serializeResearchProjectScope(ids = []) {
  return parseResearchProjectScope(ids).join(",");
}

export function primaryResearchProject(value, options = {}) {
  return parseResearchProjectScope(value, options)[0] || "";
}

export function toggleResearchProjectScope(value, projectId, options = {}) {
  const availableIds = Array.isArray(options.availableIds) ? options.availableIds : [];
  const available = new Set(availableIds);
  const id = typeof projectId === "string" ? projectId.trim() : "";
  if (!id || (available.size && !available.has(id))) {
    return parseResearchProjectScope(value, { availableIds });
  }

  const current = parseResearchProjectScope(value, { availableIds });
  const explicit = current.length > 0;
  if (!explicit) return [id];

  const selected = new Set(current);
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);

  const next = availableIds.filter((candidate) => selected.has(candidate));
  if (!next.length || (availableIds.length > 0 && next.length === availableIds.length)) return [];
  return next;
}
