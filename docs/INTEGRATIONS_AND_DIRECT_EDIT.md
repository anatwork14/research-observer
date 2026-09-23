# Observaire integrations and Direct Edit

## Settings

The **Settings** workspace centralizes three kinds of configuration:

- browser-local profile preferences,
- Consensus API configuration,
- Codex CLI authorization.

Profile name/role are stored only in browser local storage. They are not an authentication system.

### Consensus

Consensus search resolves credentials in this order:

1. an explicit key supplied only for a connection test,
2. server `CONSENSUS_API_KEY`,
3. `.research-observer/integrations.json` saved from Settings.

The workspace settings directory is git-ignored. The API never returns a saved key to the browser. On POSIX systems Observaire creates the settings directory/file with private permissions when supported.

Production settings writes are disabled unless `OBSERVAIRE_SETTINGS_WRITES=1` is explicitly configured. An environment-managed Consensus key cannot be overwritten or cleared from the Settings UI.

### Codex authorization

Settings uses the installed Codex CLI rather than handling ChatGPT tokens itself.

- `codex login status` determines whether Codex is ready.
- **Sign in with ChatGPT** starts `codex login --device-auth` only after the user clicks the button.
- Observaire displays the verification URL and one-time device code.
- Codex stores the resulting credentials in its own credential store; Observaire does not read or return access/refresh tokens.
- **Disconnect Codex** delegates to `codex logout`.

The in-app authorization UI is local-development first. Production requires explicit `OBSERVAIRE_CODEX_AUTH_UI=1` opt-in and should only be exposed behind an appropriate authenticated deployment boundary.

## Saved Consensus evidence

A reviewed Consensus result can be saved from Research Assist with **Save evidence**. This creates a normal ordered `type: evidence` Markdown object under `progress/`.

External scholarly provenance uses:

```yaml
source:
  kind: consensus
  url: https://example.org/paper
  doi: 10.xxxx/verified-doi
  paper_id: returned-provider-id
  query: original search query
```

The Evidence workspace links both to the saved Observaire evidence object and to the original external paper/DOI. When Consensus returned eligible full-text chunks, those passages may be preserved as evidence excerpts. A takeaway or abstract is labeled discovery context and is not represented as a verified full-paper quotation.

Saving a paper never automatically creates a `supports`, `contradicts`, or other semantic relationship.

## Direct Edit

Each research note has a **Direct Edit** switch in the Markdown reader.

The UI follows a Git-like review model without touching the user's live Git index:

1. **Edit** — the full `.md` source becomes a browser-local draft.
2. **Preview** — renders the draft with the same Markdown/GFM/KaTeX reader.
3. **Review changes** — Observaire creates an isolated detached worktree, overlays the current research workspace, stages that temporary copy as the baseline, writes the proposed note, runs the research doctor, and generates a text patch.
4. **Changes** — the user reviews the patch and validation output.
5. **Save to .md** — only a valid/reviewable patch can be applied to the live file.

Safety properties:

- Review does not mutate the live Markdown file.
- The original file SHA-256 is stored with the review. Save is rejected if the file changed in another editor.
- The patch is checked with `git apply --check` before application.
- The research doctor runs again after application.
- If post-save validation fails, the patch is reversed.
- Generated research artifacts are refreshed after a successful save.
- Changing a stable note ID is supported only when the compiled note still resolves; the UI follows the new canonical slug.
- Existing dirty/uncommitted research content is preserved. Direct Edit does not require the live workspace to be clean and never stages or commits the live Git index.

Local development enables evidence/Direct Edit writes by default. Production requires explicit `RESEARCH_OBSERVER_WRITES=1` opt-in.
