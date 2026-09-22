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

