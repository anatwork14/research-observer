import test from "node:test";
import assert from "node:assert/strict";
import { remarkUnwrapMediaParagraphs } from "../lib/research/markdown-media.mjs";

function run(tree) {
  remarkUnwrapMediaParagraphs()(tree);
  return tree;
}

test("standalone Markdown image is lifted out of its paragraph", () => {
  const tree = run({
    type: "root",
    children: [{
      type: "paragraph",
      children: [{ type: "image", url: "figures/result.svg", alt: "Result" }],
    }],
  });

  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].type, "image");
});

test("mixed text and media become valid sibling flow blocks in source order", () => {
  const tree = run({
    type: "root",
    children: [{
      type: "paragraph",
      children: [
        { type: "text", value: "Before" },
        { type: "image", url: "figures/result.svg", alt: "Result" },
        { type: "text", value: "After" },
      ],
    }],
  });

  assert.deepEqual(tree.children.map((node) => node.type), ["paragraph", "image", "paragraph"]);
  assert.equal(tree.children[0].children[0].value, "Before");
  assert.equal(tree.children[2].children[0].value, "After");
});

test("linked Markdown image is lifted as a single media carrier", () => {
  const tree = run({
    type: "root",
    children: [{
      type: "paragraph",
      children: [{
        type: "link",
        url: "https://example.org/source",
        children: [{ type: "image", url: "figures/result.svg", alt: "Result" }],
      }],
    }],
  });

  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].type, "link");
  assert.equal(tree.children[0].children[0].type, "image");
});
