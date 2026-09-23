import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearConsensusApiKey,
  readIntegrationSettings,
  resolveConsensusApiKey,
  saveConsensusApiKey,
} from "../lib/settings/integrations.mjs";

test("Consensus API keys persist only in git-ignored workspace settings", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-settings-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await saveConsensusApiKey("consensus-test-key-123456", { rootDir: root });
  const settings = await readIntegrationSettings({ rootDir: root });
  assert.equal(settings.consensusApiKey, "consensus-test-key-123456");

  const resolved = await resolveConsensusApiKey({ rootDir: root });
  if (!process.env.CONSENSUS_API_KEY) {
    assert.equal(resolved.source, "workspace-settings");
    assert.equal(resolved.apiKey, "consensus-test-key-123456");
  }

  const explicit = await resolveConsensusApiKey({ rootDir: root, explicit: "explicit-test-key-654321" });
  assert.equal(explicit.source, "explicit");
  assert.equal(explicit.apiKey, "explicit-test-key-654321");

  const target = path.join(root, ".research-observer", "integrations.json");
  const stat = await fs.stat(target);
  if (process.platform !== "win32") {
    assert.equal(stat.mode & 0o077, 0, "integration settings should not be group/world accessible");
  }

  await clearConsensusApiKey({ rootDir: root });
  const cleared = await readIntegrationSettings({ rootDir: root });
  assert.equal(cleared.consensusApiKey, undefined);
});

test("concurrent integration writes keep a valid atomic settings file", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-settings-concurrent-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await Promise.all([
    saveConsensusApiKey("concurrent-key-111111", { rootDir: root }),
    saveConsensusApiKey("concurrent-key-222222", { rootDir: root }),
  ]);

  const settings = await readIntegrationSettings({ rootDir: root });
  assert.match(settings.consensusApiKey ?? "", /^concurrent-key-(111111|222222)$/);

  const stateDirectory = path.join(root, ".research-observer");
  const files = await fs.readdir(stateDirectory);
  assert.deepEqual(files, ["integrations.json"], "temporary integration files should be cleaned up");
});
