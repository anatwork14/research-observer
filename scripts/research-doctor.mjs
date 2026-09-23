import { compileResearchWorkspace } from "../lib/research/compiler.mjs";

const workspace = await compileResearchWorkspace({ fresh: true });
const additionalDiagnostics = [];

for (const project of workspace.projects.filter((item) => item.directory)) {
  const rootEntries = workspace.entries.filter((entry) => entry.research === project.id && !entry.filename.includes("/"));
  if (rootEntries.length) {
    additionalDiagnostics.push({
      severity: "error",
      code: "project-scope-collision",
      file: project.directory,
      message: `Folder-backed project "${project.id}" also owns root-level research objects (${rootEntries.map((entry) => entry.filename).join(", ")}). Use a distinct folder manifest id or migrate those notes into one project location.`,
    });
  }
}

const diagnostics = [...workspace.diagnostics, ...additionalDiagnostics].sort((a, b) =>
  (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1) ||
  (a.file || "").localeCompare(b.file || "") ||
  a.code.localeCompare(b.code)
);
const errors = diagnostics.filter((item) => item.severity === "error").length;
const warnings = diagnostics.filter((item) => item.severity === "warning").length;

console.log("\nObservaire Doctor");
console.log("=================");
console.log(
  workspace.stats.notes + " notes · " +
  workspace.stats.links + " links · " +
  workspace.stats.assets + " assets"
);

if (!diagnostics.length) {
  console.log("\n✓ No workspace diagnostics.");
} else {
  console.log("");
  for (const item of diagnostics) {
    const mark = item.severity === "error" ? "✗" : item.severity === "warning" ? "!" : "·";
    const location = item.file ? item.file + " — " : "";
    console.log(mark + " [" + item.code + "] " + location + item.message);
  }
}

console.log(
  "\n" + errors + " errors · " +
  warnings + " warnings"
);

if (errors > 0) {
  process.exitCode = 1;
}
