export type ManuscriptRevisionFile = { file: string; added: number; removed: number };
export type ManuscriptRevision = {
  commit: string;
  shortCommit: string;
  at: string;
  author: string;
  subject: string;
  files: ManuscriptRevisionFile[];
  added: number;
  removed: number;
  stateChanged?: boolean;
};
export type ManuscriptRevisionHistory = {
  projectId: string;
  projectPath: string;
  revisions: ManuscriptRevision[];
  dirtyFiles: string[];
  stateDirty: boolean;
  available: boolean;
};
export type ManuscriptHistoryContext = {
  root: string;
  projectId: string;
  projectPath: string;
};
export function resolveManuscriptHistoryContext(options?: {
  rootDir?: string;
  projectId?: string;
}): Promise<ManuscriptHistoryContext>;
export function listManuscriptRevisions(options?: {
  rootDir?: string;
  projectId?: string;
  includeStateChanges?: boolean;
}): Promise<ManuscriptRevisionHistory>;
