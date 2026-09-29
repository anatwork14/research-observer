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
};
export type ManuscriptRevisionHistory = {
  projectId: string;
  projectPath: string;
  revisions: ManuscriptRevision[];
  dirtyFiles: string[];
  available: boolean;
};
export function listManuscriptRevisions(options?: { rootDir?: string; projectId?: string }): Promise<ManuscriptRevisionHistory>;
