import { writeResearchArtifacts } from "../lib/research/compiler.mjs";

const workspace = await writeResearchArtifacts({ fresh: true });

console.log(
  "Research index: " +
  workspace.stats.notes + " notes · " +
  workspace.stats.links + " links · " +
  workspace.stats.assets + " assets · " +
  workspace.stats.errors + " errors · " +
  workspace.stats.warnings + " warnings"
);

if (workspace.stats.errors > 0) {
  for (const item of workspace.diagnostics.filter((entry) => entry.severity === "error")) {
    console.error("[research:" + item.code + "] " + (item.file ? item.file + " — " : "") + item.message);
  }
  process.exitCode = 1;
}
