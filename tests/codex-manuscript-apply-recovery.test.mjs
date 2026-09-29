import assert from "node:assert/strict";
import test from "node:test";
import { recoverAppliedManuscript } from "../lib/codex/manuscript-apply-recovery.mjs";

test("validation recovery prefers a successful reverse patch and cleans the snapshot", async () => {
  const calls = [];
  const result = await recoverAppliedManuscript({
    reversePatch: async () => {
      calls.push("reverse");
      return { code: 0, stdout: "", stderr: "" };
    },
    restoreSnapshot: async () => {
      calls.push("snapshot");
      return { ok: true, restored: ["manuscripts/default/main.tex"] };
    },
    deleteSnapshot: async () => {
      calls.push("cleanup");
    },
  });

  assert.deepEqual(calls, ["reverse", "cleanup"]);
  assert.equal(result.recovered, true);
  assert.equal(result.method, "reverse-patch");
  assert.equal(result.snapshotRetained, false);
});

test("validation recovery falls back to the exact snapshot when reverse patch fails", async () => {
  const calls = [];
  const result = await recoverAppliedManuscript({
    reversePatch: async () => {
      calls.push("reverse");
      return { code: 1, stdout: "", stderr: "reverse patch conflict" };
    },
    restoreSnapshot: async () => {
      calls.push("snapshot");
      return { ok: true, restored: ["manuscripts/default/main.tex", "manuscripts/default/new.tex"] };
    },
    deleteSnapshot: async () => {
      calls.push("cleanup");
    },
  });

  assert.deepEqual(calls, ["reverse", "snapshot"]);
  assert.equal(result.recovered, true);
  assert.equal(result.method, "snapshot");
  assert.deepEqual(result.restored, ["manuscripts/default/main.tex", "manuscripts/default/new.tex"]);
  assert.equal(result.snapshotRetained, false);
  assert.equal(result.rollback.stderr, "reverse patch conflict");
});

test("validation recovery reports cleanup failure after successful reverse patch without claiming source loss", async () => {
  const result = await recoverAppliedManuscript({
    reversePatch: async () => ({ code: 0, stdout: "", stderr: "" }),
    restoreSnapshot: async () => ({ ok: true, restored: [] }),
    deleteSnapshot: async () => {
      throw new Error("snapshot directory is busy");
    },
  });

  assert.equal(result.recovered, true);
  assert.equal(result.method, "reverse-patch");
  assert.equal(result.snapshotRetained, true);
  assert.match(result.cleanupError, /snapshot directory is busy/);
});

test("validation recovery retains the snapshot and requires manual recovery when both rollback methods fail", async () => {
  const result = await recoverAppliedManuscript({
    reversePatch: async () => ({ code: 1, stdout: "", stderr: "reverse patch failed" }),
    restoreSnapshot: async () => ({ ok: false, error: "unsafe parent path blocks snapshot restore" }),
    deleteSnapshot: async () => undefined,
  });

  assert.equal(result.recovered, false);
  assert.equal(result.method, "failed");
  assert.equal(result.snapshotRetained, true);
  assert.match(result.recoveryError, /unsafe parent path/);
});
