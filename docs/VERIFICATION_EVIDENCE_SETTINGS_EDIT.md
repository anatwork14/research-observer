# Verification checklist — evidence, integrations, and Direct Edit

Run these gates on `feature/evidence-integrations-settings` with Node 22.13+:

```bash
npm ci
npm run check
npm run build
```

Focused regression tests added by this change:

```bash
node --test tests/consensus-evidence.test.mjs
node --test tests/integration-settings.test.mjs
node --test tests/direct-edit.test.mjs
```

Browser checks:

1. Open **Settings**.
2. Verify Consensus API key input is password-masked, a saved key is never echoed back, Test connection works, and clearing a workspace key removes only the local stored key.
3. Start Codex **Sign in with ChatGPT**. Verify the device URL/code appear only after the click, successful authorization changes status to ready, and Disconnect delegates to Codex logout.
4. Open a research note and search Consensus. Save one result. Confirm it appears in **Evidence**, opens as a saved Observaire note, and links to the original paper/DOI.
5. Confirm a saved takeaway/abstract is labeled discovery context, while eligible returned full-text chunks are labeled evidence excerpts.
6. Open a research note and enable **Direct Edit**. Change Markdown and confirm Preview renders without modifying the file.
7. Choose **Review changes** and inspect the patch/doctor output. Save must remain disabled when validation is blocked.
8. With a valid review, choose **Save to .md** and confirm the note updates and generated research artifacts refresh.
9. Repeat the review, change the same `.md` file externally before Save, and confirm Observaire refuses the stale patch instead of overwriting the external edit.
10. Confirm Direct Edit does not stage or commit the live Git index.

Production gates should also be checked with writes disabled: Settings credential persistence, evidence writes, and Direct Edit should remain read-only unless their explicit environment opt-ins are configured.
