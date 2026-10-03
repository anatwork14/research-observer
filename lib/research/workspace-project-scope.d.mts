export type ResearchProjectScopeOptions = {
  availableIds?: string[];
};

export function parseResearchProjectScope(
  value?: string | string[],
  options?: ResearchProjectScopeOptions,
): string[];

export function serializeResearchProjectScope(ids?: string[]): string;

export function primaryResearchProject(
  value?: string | string[],
  options?: ResearchProjectScopeOptions,
): string;

export function toggleResearchProjectScope(
  value: string | string[] | undefined,
  projectId: string,
  options?: ResearchProjectScopeOptions,
): string[];
