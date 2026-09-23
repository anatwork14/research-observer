export type DirectEditNote = {
  slug: string;
  filename: string;
  title: string;
  content: string;
  baseSha256: string;
  workspaceSignature: string;
};

export type DirectEditReview = {
  proposal: {
    id: string;
    kind: "direct-edit";
    createdAt: string;
    files: string[];
    valid: boolean;
    reviewable: boolean;
    doctor: { code: number; output: string };
    summary: string;
    slug: string;
    filename: string;
    baseSha256: string;
    workspaceSignature: string;
    patchSha256: string;
  };
  patch: string;
  valid: boolean;
  reviewable: boolean;
  doctor: { code: number; output: string };
};

export function directEditWritable(): boolean;
export function directEditReason(): string;
export function readDirectEditNote(options: { rootDir?: string; slug: string }): Promise<DirectEditNote>;
export function prepareDirectEdit(options: {
  rootDir?: string;
  slug: string;
  content: string;
  baseSha256: string;
}): Promise<DirectEditReview>;
export function applyDirectEdit(options: { rootDir?: string; id: string }): Promise<{
  applied: true;
  slug: string;
  filename: string;
  baseSha256: string;
  doctor: string;
}>;
export function discardDirectEdit(options: { rootDir?: string; id: string }): Promise<{ discarded: true }>;
