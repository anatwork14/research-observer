import { locateManuscriptPassage, manuscriptPassageId } from "./manuscript-passages.mjs";

const CLAIM_DIRECTIVE = /^\s*%\s*observaire:claim\b(.*)$/i;
const CLAIM_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RESERVED_CLAIM_IDS = new Set(["claim-id"]);
const HEADING_ONLY = /^\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{[^{}]*\}\s*$/;

function lineOffsets(source) {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charCodeAt(index) === 10) offsets.push(index + 1);
  }
  return offsets;
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

function claimDirective(line) {
  const match = line.match(CLAIM_DIRECTIVE);
  if (!match) return null;
  const remainder = match[1].trim();
  const token = remainder.split(/\s+/)[0] || "";
  return { raw: remainder, id: token };
}

function nextPassageOffset(source, lines, offsets, markerIndex) {
  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    const raw = lines[index];
    if (claimDirective(raw)) continue;
    const visible = stripLatexComment(raw).trim();
    if (!visible) continue;
    if (HEADING_ONLY.test(visible)) continue;
    const leading = raw.length - raw.trimStart().length;
    return offsets[index] + leading;
  }
  return null;
}

export function isValidManuscriptClaimId(value) {
  return typeof value === "string"
    && value.length <= 80
    && CLAIM_ID.test(value)
    && !RESERVED_CLAIM_IDS.has(value);
}

export function manuscriptClaimNodeId(projectId, claimId) {
  return `claim:${projectId}:${claimId}`;
}

export function parseManuscriptClaimAnchors(content) {
  const source = String(content ?? "");
  const lines = source.split("\n");
  const offsets = lineOffsets(source);
  const claims = [];
  const issues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const directive = claimDirective(lines[index]);
    if (!directive) continue;
    const markerLine = index + 1;

    if (!directive.id || !isValidManuscriptClaimId(directive.id) || directive.raw !== directive.id) {
      issues.push({
        type: "invalid-id",
        line: markerLine,
        claimId: directive.id || undefined,
        message: "Claim IDs must be unique lowercase kebab-case tokens up to 80 characters; replace the reserved claim-id placeholder.",
      });
      continue;
    }

    const targetOffset = nextPassageOffset(source, lines, offsets, index);
    if (targetOffset === null) {
      issues.push({
        type: "orphan",
        line: markerLine,
        claimId: directive.id,
        message: "Claim anchor has no following manuscript passage.",
      });
      continue;
    }

    const passage = locateManuscriptPassage(source, targetOffset);
    if (!passage.excerpt) {
      issues.push({
        type: "orphan",
        line: markerLine,
        claimId: directive.id,
        message: "Claim anchor has no following manuscript passage.",
      });
      continue;
    }

    claims.push({
      claimId: directive.id,
      markerLine,
      targetLine: passage.lineStart,
      passage,
    });
  }

  return { claims, issues };
}

export function claimPassageIdentity(projectId, file, claim) {
  return manuscriptPassageId(projectId, file, claim.passage.start, claim.passage.end);
}
