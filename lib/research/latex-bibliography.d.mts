export type LatexBibliographyEdit = { index: number; text: string };

export function mapLatexOffsetThroughInsertions(offset: number, edits: LatexBibliographyEdit[]): number;

export function configureLatexBibliographySource(content: string, bibFile: string): {
  content: string;
  changed: boolean;
  mode: "biblatex" | "bibtex" | "bibtex-existing";
  bibFile: string;
  edits: LatexBibliographyEdit[];
  message: string;
};
