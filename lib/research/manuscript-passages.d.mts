export type ManuscriptPassageContext = {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
  line: number;
  column: number;
  heading: null | { level: string; title: string; offset: number; line: number };
  excerpt: string;
};

export function locateManuscriptPassage(content: string, offset: number): ManuscriptPassageContext;
export function manuscriptPassageId(projectId: string, file: string, start: number, end: number): string;
