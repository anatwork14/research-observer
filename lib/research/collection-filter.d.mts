import type { ResearchWorkspace } from "./compiler.mjs";

export function assetBelongsToResearch(assetPath: string, researchId: string, workspace: ResearchWorkspace): boolean;
export function matchesResearchText(values: unknown[], query: string): boolean;
export function researchAssetKind(extension: string): "paper" | "image" | "other";
