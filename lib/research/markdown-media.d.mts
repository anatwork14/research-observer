export type MarkdownAstNode = {
  type?: string;
  value?: unknown;
  children?: MarkdownAstNode[];
  [key: string]: unknown;
};

export function remarkUnwrapMediaParagraphs(): (tree: MarkdownAstNode) => void;
