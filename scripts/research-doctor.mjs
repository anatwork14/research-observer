import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

const workspace = await compileResearchWorkspace({ fresh: true });

console.log("\nResearch Observer Doctor");
console.log("========================");
console.log(
  workspace.stats.notes + " notes · " +
  workspace.stats.links + " links · " +
  workspace.stats.assets + " assets"
);

if (!workspace.diagnostics.length) {
  console.log("\n✓ No workspace diagnostics.");
} else {
  console.log("");
  for (const item of workspace.diagnostics) {
    const mark = item.severity === "error" ? "✗" : item.severity === "warning" ? "!" : "·";
    const location = item.file ? item.file + " — " : "";
    console.log(mark + " [" + item.code + "] " + location + item.message);
  }
}

console.log(
  "\n" + workspace.stats.errors + " errors · " +
  workspace.stats.warnings + " warnings"
);

if (workspace.stats.errors > 0) {
  process.exitCode = 1;
}
