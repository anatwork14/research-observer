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

## Claim drill-down filters

- Claim filters are read-only views over the complete audit result; they do not mutate manuscript source or canonical research state.
- Keep filter state URL-backed with `claimRelation`, `claimCoverage`, `claimSignal`, `claimEvidence`, `claimFile`, `claimSection`, and `claimQ` so drill-downs are reproducible/shareable.
- `claimSignal` currently supports only the explicit `support-contradiction` overlap. Individual support/contradiction/context/qualification chart bars reuse `claimRelation` instead of inventing duplicate filter semantics.
- `claimEvidence` is an exact canonical Evidence slug filter. Do not replace it with fuzzy title search or semantic matching.
- Normalize unsupported query values to no filter. Never reinterpret an unknown relation, coverage token, or signal.
- Relation filters use only the existing authored vocabulary. Coverage filters operate on distinct canonical Evidence-target count, not relationship-edge count.
- File/section filters use exact saved manuscript metadata. Text search may match literal Claim/Evidence/source context only.
- Complete-scope KPI/chart totals stay visibly separate from filtered Claim-row counts. A filtered `12 of 105` result must not overwrite or masquerade as a new total of 12 Claims.
- Project-scope changes while remaining on Claims preserve Claim filters. Switching to a non-Claims Insights view drops Claim-only parameters.
- Form submissions must preserve active chart-only filters unless the user explicitly removes or clears them.
- Do not add automatic relationship writes, AI recommendations, auto-fix actions, or score changes as a side effect of filtering.

## Chart drill-downs

- Claims chart drill-downs are navigation into the same URL-backed filter state, not a second client-side selection model.
- Coverage segments map to `claimCoverage`.
- Authored relationship bars map to `claimRelation`.
- The support + contradiction overlap bar maps to `claimSignal=support-contradiction`; the other signal bars reuse `claimRelation`.
- Evidence-reuse bars map to exact `claimEvidence=<slug>`.
- Chart values remain complete-scope audit context after navigation. Only the Claim drill-down rows are filtered.
- Preserve all unrelated active filters and project scope when a chart link is followed.
- Keep chart links keyboard reachable and represented as real links in rendered markup. Do not require pointer-only JavaScript handlers.

## Navigation

- Claim rows may link back to the existing guarded IDE Claim location.
- Evidence rows/targets may link to canonical `/progress/<slug>` routes.
- Relation tags may link into the same URL-backed Claim drill-down for that exact authored relation.
- Do not add write actions to the audit surface. Editing relationships remains an explicit manuscript-authoring action.

## Bounds and responsive behavior

The underlying audit may remain complete while rendered lists are bounded. Keep visible bounds disclosed where relevant.

Wide tables/charts may scroll inside their own containers but must not create document-level horizontal overflow.

Filter controls must remain reachable at narrow mobile and tablet widths. Prefer responsive grid collapse over document-level horizontal scrolling for the filter form itself.

Verify the Claims view at narrow mobile, tablet portrait/landscape, and desktop widths. Project scope controls, filters, charts, Claim rows, Evidence rows, issue rows, and unavailable-project notices must remain reachable and readable.

## Performance

Only `view=claims` may invoke the manuscript Claim audit loader. Preserve the lazy-loading boundary with regression coverage.

Filtering should operate on the already-built audit result. Do not trigger a second manuscript scan solely because a Claim filter or chart drill-down changed.
