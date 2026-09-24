export type MetricDefinition = { id: string; label: string; role: string; direction: string; unit: string; aggregation: string; display: string; aliases: string[]; threshold?: unknown; description?: string };
export const IMPORT_BATCH_STORAGE_LIMIT: number;
export function assertImportBatchStorageWithinLimit(sourceBytes: number, runCount: number): number;
export function finiteNumericValue(value: unknown): number | undefined;
export function resolveMetricColumn(column: string, plan: { metrics?: MetricDefinition[] } | undefined, approvedMapping?: Record<string, string>): { metricId: string; reason: string } | null;
export function compareRuns(runs: Array<Record<string, unknown>>, baselineId: string, metricDefinitions?: MetricDefinition[]): Array<Record<string, unknown>>;
export function recommendVisualizations(runs: Array<{ parameters?: Record<string, unknown> }>, metrics?: MetricDefinition[]): string[];
export function detectConfounding(baseline: { parameters?: Record<string, unknown> } | undefined, variants: Array<{ parameters?: Record<string, unknown> }>, factor: string, controlled?: string[]): { potentiallyConfounded: boolean; differing: string[]; missingControls: string[] };
