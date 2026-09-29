import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const helper = path.resolve("scripts/synctex-validation.sh");

async function runValidation(root, input, line = 5) {
  const output = [
    "SyncTeX result begin",
    `Output:${path.join(root, "build", "main.pdf")}`,
    `Input:${input}`,
    `Line:${line}`,
    "Column:-1",
    "Offset:0",
    "Context:",
    "SyncTeX result end",
  ].join("\n");
  return spawnSync(
    "bash",
    ["-c", 'source "$1" && verify_synctex_reverse_output "$2" "$3"', "bash", helper, output, path.join(root, "main.tex")],
    { encoding: "utf8" },
  );
}

test("SyncTeX reverse validation accepts the real ./ source path and case-sensitive fields", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-synctex-validation-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, "main.tex");
  await fs.writeFile(source, "fixture\n", "utf8");

  const result = await runValidation(root, `${root}/./main.tex`);
  assert.equal(result.status, 0, result.stderr);
});

test("SyncTeX reverse validation rejects invalid lines and files outside the source", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-synctex-validation-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "observaire-synctex-outside-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });
  const source = path.join(root, "main.tex");
  const other = path.join(outside, "main.tex");
  await Promise.all([fs.writeFile(source, "fixture\n", "utf8"), fs.writeFile(other, "outside\n", "utf8")]);

  assert.notEqual((await runValidation(root, source, 0)).status, 0);
  assert.notEqual((await runValidation(root, other)).status, 0);
});
