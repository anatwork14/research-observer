# Local workspace health

Observaire is local-first. The Health workspace therefore separates two different questions that must not be collapsed into one score:

1. **Local runtime readiness** — can this workstation resolve the files, generated assets, tools, and optional integrations needed by Observaire?
2. **Research integrity** — what factual conditions does the canonical research compiler report about the authored research workspace?

The existing research-integrity cards remain authoritative for research-content conditions. Local runtime health is an additional operational layer, not a replacement and not a research-quality score.

## Local runtime checks

`GET /api/health/local` returns no-store status for:

- declared Node runtime compatibility;
- `research-observer.config.json` readability;
- canonical research compiler errors/warnings;
- configured durable `progress/`, annotation, and manuscript source roots;
- generated manifest/search/graph/health artifacts;
- local PDF.js worker/cMaps/fonts/WASM runtime;
- Git worktree availability;
- local `latexmk` and supported TeX engine availability;
- Codex CLI/authentication state;
- Consensus configuration state.

No API key, Codex credential, access token, or other secret is returned to the browser.

### Status semantics

- `ready` means the checked capability is usable.
- `attention` means a core/configured capability needs intervention.
- `unavailable` means an optional capability is not currently usable; it does not by itself make the local workspace unhealthy.

This distinction matters for optional Codex, Consensus, and LaTeX tooling. Observaire's core research workspace must continue working when an optional integration is absent.

## Safe maintenance actions

`POST /api/health/local` supports only explicit maintenance of disposable generated state:

- `rebuild-research` calls the canonical `writeResearchArtifacts({ fresh: true })` path;
- `prepare-pdf-runtime` calls the existing local PDF.js runtime preparer;
- `repair-generated` performs both operations.

These actions must never rewrite authored `progress/`, `annotations/`, or `manuscripts/` content.

POST requests are same-origin only. Maintenance is enabled automatically in local development. A local production build can opt in with:

```bash
OBSERVAIRE_LOCAL_MAINTENANCE=1
```

`RESEARCH_OBSERVER_WRITES=1` also enables maintenance for compatibility with the existing local-first write policy, but the narrower maintenance flag is preferred when only generated-state repair is intended.

## UI contract

The `/health` page shows **Local workspace / Runtime readiness** before the existing research-integrity summary.

The local section must:

- remain usable when one status probe fails;
- treat optional unavailable integrations as non-blocking;
- expose durable paths without exposing credentials;
- label repair actions by the exact generated state they modify;
- keep repair controls touch-safe and responsive;
- preserve the existing research-integrity cards and diagnostics below it.

## Verification

For changes to this surface, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run check:full
```

Browser QA should cover desktop, tablet, and mobile widths and verify Recheck plus all generated-state repair actions in a disposable checkout. After repair, durable research, annotation, and manuscript source bytes must remain unchanged.
