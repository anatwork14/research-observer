function mediaNode(node) {
  if (!node || typeof node !== "object") return false;
  if (node.type === "image") return true;
  return node.type === "link" && Array.isArray(node.children) && node.children.length === 1 && node.children[0]?.type === "image";
}

function meaningful(nodes) {
  return nodes.some((node) => node?.type !== "text" || String(node.value ?? "").trim());
}

function transform(parent) {
  if (!parent || !Array.isArray(parent.children)) return;
  const output = [];

  for (const child of parent.children) {
    if (child?.type === "paragraph" && Array.isArray(child.children) && child.children.some(mediaNode)) {
      let inline = [];
      const flush = () => {
        if (meaningful(inline)) output.push({ ...child, children: inline });
        inline = [];
      };

      for (const node of child.children) {
        if (mediaNode(node)) {
          flush();
          output.push(node);
        } else {
          inline.push(node);
        }
      }
      flush();
      continue;
    }

    output.push(child);
  }

  parent.children = output;
  for (const child of output) transform(child);
}

/**
 * react-markdown normally keeps Markdown images inside paragraph nodes. Our
 * image renderer upgrades research media to a semantic <figure>, which is a
 * flow element and cannot legally be nested inside <p>. Split media out at
 * the Markdown AST layer so server and browser produce the same valid DOM.
 */
export function remarkUnwrapMediaParagraphs() {
  return (tree) => transform(tree);
}
