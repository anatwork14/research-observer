import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { codexLoginStatus } from "../lib/settings/codex-auth.mjs";

test("Codex status initializes a missing configured home with private permissions", async (t) => {
  const originalHome = process.env.CODEX_HOME;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-codex-home-"));
  const codexHome = path.join(root, ".research-observer", "codex");
  process.env.CODEX_HOME = codexHome;
  t.after(async () => {
    if (originalHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = originalHome;
    await fs.rm(root, { recursive: true, force: true });
  });

  const status = await codexLoginStatus();
  assert.equal(status.available, true, status.reason);
  assert.equal(status.authenticated, false);
  assert.doesNotMatch(status.reason ?? "", /CODEX_HOME points .* does not exist/);

  const stat = await fs.stat(codexHome);
  if (process.platform !== "win32") {
    assert.equal(stat.mode & 0o777, 0o700, "Codex home should be private to its owner");
  }
});
