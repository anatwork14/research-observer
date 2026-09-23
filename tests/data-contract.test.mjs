import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function read(relative) {
  return fs.readFile(path.join(root, relative), "utf8");
}

test("machine-readable frontmatter schema exposes the canonical indexed core", async () => {
  const schema = JSON.parse(await read("docs/observaire-research-frontmatter.schema.json"));
  assert.deepEqual(schema.required, ["id", "title", "summary", "type"]);
  for (const field of ["id", "title", "summary", "type", "status", "research", "date", "tags", "aliases", "authors", "year", "doi", "pdf", "relationships", "source"]) {
    assert.ok(schema.properties[field], `missing canonical field ${field}`);
  }
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.relationship.additionalProperties, false);
  assert.ok(schema.$defs.source.oneOf.length >= 2);
});

test("human contract documents every current configured vocabulary value", async () => {
  const [contract, configRaw] = await Promise.all([
    read("docs/OBSERVAIRE_DATA_CONTRACT.md"),
    read("research-observer.config.json"),
  ]);
  const config = JSON.parse(configRaw);

  for (const value of config.allowedTypes) assert.ok(contract.includes(`\`${value}\``), `contract missing type ${value}`);
  for (const value of config.allowedStatuses) assert.ok(contract.includes(`\`${value}\``), `contract missing status ${value}`);
  for (const value of config.allowedRelationshipTypes) assert.ok(contract.includes(`\`${value}\``), `contract missing relationship ${value}`);
});

test("ChatGPT Web prompt mirrors current vocabularies and avoids repository-specific guesses", async () => {
  const [prompt, configRaw] = await Promise.all([
    read("docs/CHATGPT_WEB_RESEARCH_PROMPT.md"),
    read("research-observer.config.json"),
  ]);
  const config = JSON.parse(configRaw);

  assert.ok(prompt.includes("{{TOPIC_OR_IDEA_OR_HYPOTHESIS}}"));
  assert.ok(prompt.includes("900_primary_question.md"));
  assert.ok(!prompt.includes("research: default"));
  assert.ok(prompt.includes("Do **not** create a `type: result` file unless"));

  for (const value of config.allowedTypes) assert.ok(prompt.includes(`\`${value}\``), `prompt missing type ${value}`);
  for (const value of config.allowedStatuses) assert.ok(prompt.includes(`\`${value}\``), `prompt missing status ${value}`);
  for (const value of config.allowedRelationshipTypes) assert.ok(prompt.includes(`\`${value}\``), `prompt missing relationship ${value}`);
});

test("agent-facing research instructions require the canonical contract and schema", async () => {
  const [progressAgents, skill] = await Promise.all([
    read("progress/AGENTS.md"),
    read(".agents/skills/create-research-note/SKILL.md"),
  ]);
  assert.ok(progressAgents.includes("docs/OBSERVAIRE_DATA_CONTRACT.md"));
  assert.ok(skill.includes("docs/OBSERVAIRE_DATA_CONTRACT.md"));
  assert.ok(skill.includes("docs/observaire-research-frontmatter.schema.json"));
  assert.ok(skill.includes("research-observer.config.json"));
});
