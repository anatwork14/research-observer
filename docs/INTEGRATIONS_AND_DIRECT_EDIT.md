# Observaire integrations, Codex review, and Direct Edit

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

When using the supplied Docker Compose setup, `CODEX_HOME` lives under the persistent `observaire-state` volume so normal container recreation does not discard the Codex authorization state.

## Saved Consensus evidence

A reviewed Consensus result can be saved from Research Assist with **Save evidence**. This creates a normal ordered `type: evidence` Markdown object in the research source tree.

For a folder-backed project, the evidence note is written **inside that project folder** at the next project-local order number. A configured/root-level legacy project continues to use the root research directory. Local PDF evidence follows the same placement rule and stores a portable source path relative to the project note where possible.

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

## Codex Act preview

**Act** is a human-reviewed filesystem edit workflow. The durable research source is the current filesystem, not Git HEAD, so Act intentionally does **not** require the research tree to be clean or committed first.

The review flow is:

1. Observaire compiles the current workspace and resolves the configured repository-relative research root.
2. It creates an isolated detached Git worktree.
3. The **current live research directory** and current workspace config are copied into that worktree.
4. That copy is staged only inside the isolated worktree and frozen as a review baseline tree.
5. Codex runs with network access disabled, `approvalPolicy: never`, and write permission limited by the prompt boundary to the configured research directory.
6. After Codex returns, Observaire restores the frozen baseline index even if Codex happened to stage files itself.
7. The proposal diff is calculated from the frozen live-filesystem baseline to the final Codex working tree, not from Git HEAD.
8. The research doctor runs against the proposed worktree.
9. For every touched file, Observaire stores the baseline Git blob hash (or `null` when the file did not exist at review time).
10. The user reviews the patch before a separate **Apply** action can modify the live source.

This model matters for browser-imported projects: a new project may still be untracked in Git, yet it is already valid durable research content. Act can review changes to that project without asking the user to commit it first.

### Apply conflict rule

Apply does not ask whether a touched file is dirty relative to Git HEAD. Instead, for new proposals it asks whether each touched file is still byte-for-byte the same as the file state that Codex reviewed.

- Pre-existing uncommitted/imported content is allowed when unchanged since review.
- A file edited after the Act preview is rejected as a conflict.
- A file that did not exist at review time conflicts if another process creates it before Apply.
- Replacing a reviewed file with a symlink/non-file object conflicts.
- The patch must still pass `git apply --check`.
- The research doctor runs after application.
- If validation fails, Observaire reverses the patch; a rollback failure is surfaced explicitly instead of being reported as successful rollback.

Older stored proposals that predate per-file baseline metadata retain the previous dirty-overlap safety check.

The configured research root must remain inside the repository for Git-backed Act/Apply review. Docker may bind-mount any host directory at that in-repository path (the default is `/app/progress`), so host storage can still live outside the repository directory on the host.

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
