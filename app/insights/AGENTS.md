# Insights UI contract

These instructions apply under `app/insights/` and complement `app/AGENTS.md`.

For Claim↔Evidence analytics, also read `docs/CLAIM_EVIDENCE_AUDIT.md`, `docs/CLAIM_EVIDENCE_RELATIONS.md`, and `docs/MANUSCRIPT_CLAIMS.md`.

## Existing Insights views

Keep the existing views first-class:

- Overview
- Analytics
- Claims
- Timeline
- Versions

The Claims view is additive. Do not make Overview, Analytics, Timeline, or Versions depend on manuscript Claim scans merely to render.

## Claims view semantics

- Claims analytics are derived from `loadClaimEvidenceAudit`; do not parse `.tex` directly in the page or components.
- `0 Evidence targets` means zero valid authored Claim↔Evidence directives in saved visible manuscript source. It does not mean scientifically unsupported.
- Evidence with zero Claim links is an inventory observation, not an error.
- Do not create a composite quality/confidence/truth/readiness score from Claim coverage.
- Do not infer `supports`, `contradicts`, `contextualizes`, or `qualifies` from citations, prose, nearby graph nodes, or AI output.
- Multiple relation types to one canonical Evidence object count as one distinct Evidence target but multiple authored relationships.
- Projects whose manuscript Claim projection is unavailable must be labeled unavailable rather than displayed as factual zero Claims.
- Keep project scope aligned with the existing `/insights?research=...` controls.

## Navigation

- Claim rows may link back to the existing guarded IDE Claim location.
- Evidence rows/targets may link to canonical `/progress/<slug>` routes.
- Do not add write actions to the audit surface. Editing relationships remains an explicit manuscript-authoring action.

## Bounds and responsive behavior

The underlying audit may remain complete while rendered lists are bounded. Keep visible bounds disclosed where relevant.

Wide tables/charts may scroll inside their own containers but must not create document-level horizontal overflow.

Verify the Claims view at narrow mobile, tablet portrait/landscape, and desktop widths. Project scope controls, charts, Claim rows, Evidence rows, issue rows, and unavailable-project notices must remain reachable and readable.

## Performance

Only `view=claims` may invoke the manuscript Claim audit loader. Preserve the lazy-loading boundary with regression coverage.
