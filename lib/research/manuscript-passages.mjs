function clampOffset(content, value) {
  const offset = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(0, Math.min(content.length, offset));
}

function lineNumberAt(content, offset) {
  const safe = clampOffset(content, offset);
  let line = 1;
  for (let index = 0; index < safe; index += 1) if (content.charCodeAt(index) === 10) line += 1;
  return line;
}

function lineColumnAt(content, offset) {
  const safe = clampOffset(content, offset);
  const previousBreak = content.lastIndexOf("\n", Math.max(0, safe - 1));
  return {
    line: lineNumberAt(content, safe),
    column: safe - (previousBreak + 1),
  };
}

function stripLatexComment(line) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== "%") continue;
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) slashes += 1;
    if (slashes % 2 === 0) return line.slice(0, index);
  }
  return line;
}

function nearestHeading(content, offset) {
  const before = content.slice(0, clampOffset(content, offset));
  const expression = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{([^{}]{1,240})\}/g;
  let best = null;
  let consumed = 0;
  for (const rawLine of before.split("\n")) {
    const line = stripLatexComment(rawLine);
    expression.lastIndex = 0;
    let match;
    while ((match = expression.exec(line))) {
      const absolute = consumed + match.index;
      best = {
        level: match[1],
        title: match[2].replace(/\s+/g, " ").trim(),
        offset: absolute,
        line: lineNumberAt(content, absolute),
      };
    }
    consumed += rawLine.length + 1;
  }
  return best;
}

function passageBounds(content, offset) {
  const safe = clampOffset(content, offset);
  const before = content.slice(0, safe);
  const previous = /\n[\t ]*\n/g;
  let previousMatch;
  let match;
  while ((match = previous.exec(before))) previousMatch = match;
  let start = previousMatch ? previousMatch.index + previousMatch[0].length : 0;

  const after = content.slice(safe);
  const next = after.match(/\n[\t ]*\n/);
  let end = next?.index !== undefined ? safe + next.index : content.length;

  while (start < end && /\s/.test(content[start])) start += 1;
  while (end > start && /\s/.test(content[end - 1])) end -= 1;
  return { start, end };
}

function compactExcerpt(value, limit = 280) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function locateManuscriptPassage(content, offset) {
  const source = String(content ?? "");
  const safe = clampOffset(source, offset);
  const bounds = passageBounds(source, safe);
  const cursor = lineColumnAt(source, safe);
  const heading = nearestHeading(source, safe);
  return {
    start: bounds.start,
    end: bounds.end,
    lineStart: lineNumberAt(source, bounds.start),
    lineEnd: lineNumberAt(source, bounds.end),
    line: cursor.line,
    column: cursor.column,
    heading,
    excerpt: compactExcerpt(source.slice(bounds.start, bounds.end)),
  };
}

export function manuscriptPassageId(projectId, file, start, end) {
  return `passage:${projectId}:${file}:${start}:${end}`;
}
