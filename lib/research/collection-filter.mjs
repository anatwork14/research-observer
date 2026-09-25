export function assetBelongsToResearch(assetPath, researchId, workspace) {
  if (!researchId) return true;
  const project = workspace.projects.find((item) => item.id === researchId);
  if (!project) return false;
  if (project.directory && assetPath.startsWith(`${project.directory}/`)) return true;
  const linked = workspace.entries.some((entry) => entry.research === researchId && (
    entry.assets.includes(assetPath) || entry.pdf === assetPath || entry.source?.pdf === assetPath
  ));
  if (linked) return true;
  if (researchId !== "default") return false;
  const insideOtherProject = workspace.projects.some((item) => item.directory && assetPath.startsWith(`${item.directory}/`));
  const linkedElsewhere = workspace.entries.some((entry) => entry.research !== researchId && (
    entry.assets.includes(assetPath) || entry.pdf === assetPath || entry.source?.pdf === assetPath
  ));
  return !insideOtherProject && !linkedElsewhere;
}

export function matchesResearchText(values, query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  return !needle || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
}

export function researchAssetKind(extension) {
  if (extension === ".pdf") return "paper";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp"].includes(extension)) return "image";
  return "other";
}
