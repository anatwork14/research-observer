const RELATION_DIRECTIVE = /^\s*%\s*observaire:claim-evidence\b(.*)$/i;
const CLAIM_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const RESEARCH_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_CLAIM_IDS = new Set(["claim-id"]);
const RESERVED_EVIDENCE_SLUGS = new Set(["evidence-slug"]);

export const MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS = Object.freeze([
  "supports",
  "contradicts",
  "contextualizes",
  "qualifies",
]);

const RELATION_TYPES = new Set(MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS);

function validClaimId(value) {
  return typeof value === "string"
    && value.length <= 80
    && CLAIM_ID.test(value)
    && !RESERVED_CLAIM_IDS.has(value);
}

function validEvidenceSlug(value) {
  return typeof value === "string"
    && value.length <= 160
    && RESEARCH_SLUG.test(value)
    && !RESERVED_EVIDENCE_SLUGS.has(value);
}

export function parseManuscriptClaimEvidenceRelations(content) {
  const source = String(content ?? "");
  const lines = source.split("\n");
  const relations = [];
  const issues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(RELATION_DIRECTIVE);
    if (!match) continue;
    const line = index + 1;
    const raw = match[1].trim();
    const tokens = raw ? raw.split(/\s+/) : [];

    if (tokens.length !== 3) {
      issues.push({
        type: "invalid-directive",
        line,
        message: "Claim-evidence directives require exactly: <claim-id> <relation> <evidence-slug>.",
      });
      continue;
    }

    const [claimId, relation, evidenceSlug] = tokens;
    if (!validClaimId(claimId)) {
      issues.push({
        type: "invalid-claim-id",
        line,
        claimId,
        message: "Claim-evidence claim IDs must use a real explicit lowercase kebab-case Claim ID; replace the claim-id placeholder.",
      });
      continue;
    }
    if (!RELATION_TYPES.has(relation)) {
      issues.push({
        type: "unsupported-relation",
        line,
        claimId,
        relation,
        evidenceSlug,
        message: `Unsupported claim-evidence relation '${relation}'.`,
      });
      continue;
    }
    if (!validEvidenceSlug(evidenceSlug)) {
      issues.push({
        type: "invalid-evidence-slug",
        line,
        claimId,
        relation,
        evidenceSlug,
        message: "Claim-evidence targets must use a real canonical lowercase kebab-case research slug; replace the evidence-slug placeholder.",
      });
      continue;
    }

    relations.push({ claimId, relation, evidenceSlug, line });
  }

  return { relations, issues };
}

export function manuscriptClaimEvidenceEdgeId(projectId, claimId, relation, evidenceSlug) {
  return `claim-evidence:${projectId}:${claimId}:${relation}:${evidenceSlug}`;
}
