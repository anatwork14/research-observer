import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { compileResearchWorkspace, discoverMetricCandidates } from "../lib/research/compiler.mjs";
import { compareRuns, detectConfounding, IMPORT_LIMITS, parseImportFile, recommendVisualizations, resolveMetricColumn, validateEvaluationPlan, validateRunId } from "../lib/research/experiments.mjs";
import { createExperimentRun } from "../lib/research/run-write.mjs";
import { assertImportBatchStorageWithinLimit, finiteNumericValue, IMPORT_BATCH_STORAGE_LIMIT } from "../lib/research/experiments-shared.mjs";

const metric = (extra = {}) => ({ id:"recall-at-10", label:"Recall @ 10", role:"primary", direction:"maximize", unit:"fraction", aggregation:"mean", display:"percent", aliases:["recall@10"], ...extra });

test("evaluation plan validates canonical IDs, aliases, direction, aggregation and primary metric", () => {
  const diagnostics=[];
  const plan=validateEvaluationPlan({ schemaVersion:1, metrics:[metric()], comparisons:[], ablations:[], successCriteria:[] },"eval.md",diagnostics);
  assert.equal(plan.metrics[0].id,"recall-at-10");
  assert.deepEqual(diagnostics,[]);
  validateEvaluationPlan({ metrics:[metric({direction:"sideways",aggregation:"magic"}),metric()], comparisons:[], ablations:[], successCriteria:[] },"bad.md",diagnostics);
  assert.ok(diagnostics.some((item)=>item.code==="metric-direction-invalid"));
  assert.ok(diagnostics.some((item)=>item.code==="metric-aggregation-invalid"));
  assert.ok(diagnostics.some((item)=>item.code==="metric-id-duplicate"));
  assert.ok(diagnostics.some((item)=>item.code==="metric-alias-collision"));
});

test("evaluation validation flags missing comparison baselines and ablation controls", () => {
  const diagnostics=[];
  validateEvaluationPlan({ schemaVersion:1, metrics:[metric()], comparisons:[{id:"main",metrics:["unknown"]}], ablations:[{id:"drop-factor",factor:"width"}], successCriteria:[] },"plan.md",diagnostics);
  assert.ok(diagnostics.some((item)=>item.code==="comparison-metric-unknown"));
  assert.ok(diagnostics.some((item)=>item.code==="comparison-baseline-missing"));
  assert.ok(diagnostics.some((item)=>item.code==="ablation-baseline-missing"));
});

test("metric resolution follows canonical ID, declared alias, then approved mapping", () => {
  const plan={metrics:[metric()]};
  assert.equal(resolveMetricColumn("recall-at-10",plan).reason,"canonical-id");
  assert.equal(resolveMetricColumn("Recall@10",plan).reason,"declared-alias");
  assert.equal(resolveMetricColumn("r10",plan,{r10:"recall-at-10"}).reason,"approved-mapping");
  assert.equal(resolveMetricColumn("unknown",plan,{}),null);
});

test("run-per-row imports bound total duplicated source storage before writing", () => {
  assert.equal(assertImportBatchStorageWithinLimit(1024, 10), 10240);
  assert.equal(assertImportBatchStorageWithinLimit(0, 1000), 0);
  assert.throws(() => assertImportBatchStorageWithinLimit(25 * 1024 * 1024, 6), /more than 128 MB/);
  assert.equal(IMPORT_BATCH_STORAGE_LIMIT, 128 * 1024 * 1024);
});

test("imported metric conversion preserves blanks as missing and rejects non-finite values", () => {
  assert.equal(finiteNumericValue("1.25e-3"), 0.00125);
  assert.equal(finiteNumericValue(0), 0);
  for (const value of ["", "  ", undefined, null, "NaN", "Infinity", "-Infinity", "not-a-number"]) assert.equal(finiteNumericValue(value), undefined);
});

test("CSV and TSV imports preserve rows, quote parsing and infer columns", async (t) => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-import-")); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const csv=path.join(dir,"input.csv"), tsv=path.join(dir,"input.tsv");
  await fs.writeFile(csv,'run,recall-at-10,note\nbase,0.8,"quoted, value"\n');
  await fs.writeFile(tsv,"step\tlatency\n1\t12\n2\t10\n");
  const parsedCsv=await parseImportFile(csv,".csv"), parsedTsv=await parseImportFile(tsv,".tsv");
  assert.deepEqual(parsedCsv.columns,["run","recall-at-10","note"]);
  assert.equal(parsedCsv.rows[0].note,"quoted, value");
  assert.equal(parsedTsv.rows.length,2);
  assert.equal(parsedTsv.rows[1].latency,"10");
  await fs.writeFile(csv,"run,accuracy,accuracy\na,0.8,0.9\n");
  await assert.rejects(parseImportFile(csv,".csv"),/Header names must be non-empty and unique/);
  await fs.writeFile(tsv,"run\taccuracy\taccuracy\na\t0.8\t0.9\n");
  await assert.rejects(parseImportFile(tsv,".tsv"),/Header names must be non-empty and unique/);
});

test("CSV and TSV preserve UTF-8, quoted newlines, quoted delimiters, blanks, and string values", async (t) => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-import-edges-")); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const csv=path.join(dir,"edge.csv"), tsv=path.join(dir,"edge.tsv"), empty=path.join(dir,"empty.csv"), header=path.join(dir,"header.csv");
  await fs.writeFile(csv,'run,score,note\nrow-1,1e-3,"first line,\nsecond line 東京"\nrow-2,,""\n');
  await fs.writeFile(tsv,'run\tnote\nrow-1\t"tab\tinside and comma, café"\n');
  await fs.writeFile(empty,""); await fs.writeFile(header,"run\tscore\n");
  const csvResult=await parseImportFile(csv,".csv"), tsvResult=await parseImportFile(tsv,".tsv");
  assert.equal(csvResult.rows[0].score,"1e-3");
  assert.equal(csvResult.rows[0].note,"first line,\nsecond line 東京");
  assert.equal(csvResult.rows[1].score,"");
  assert.equal(csvResult.rows[1].note,"");
  assert.equal(tsvResult.rows[0].note,"tab\tinside and comma, café");
  assert.deepEqual(await parseImportFile(empty,".csv"),{format:"csv",columns:[],rows:[]});
  assert.deepEqual(await parseImportFile(header,".tsv"),{format:"tsv",columns:["run","score"],rows:[]});
});

test("JSON and JSONL imports are bounded and reject malformed or deeply nested input", async (t) => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-json-import-")); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const json=path.join(dir,"data.json"), jsonl=path.join(dir,"data.jsonl");
  await fs.writeFile(json,JSON.stringify([{step:1,loss:2}])); await fs.writeFile(jsonl,'{"step":1}\n{"step":2}\n');
  assert.equal((await parseImportFile(json,".json")).rows.length,1);
  assert.equal((await parseImportFile(jsonl,".jsonl")).rows.length,2);
  await fs.writeFile(json,"{"); await assert.rejects(parseImportFile(json,".json"));
  await fs.writeFile(json,JSON.stringify({a:{b:{c:1}}}));
  assert.equal((await parseImportFile(json,".json")).rows.length,1);
  await fs.writeFile(json,`${"[".repeat(IMPORT_LIMITS.jsonDepth + 2)}0${"]".repeat(IMPORT_LIMITS.jsonDepth + 2)}`);
  await assert.rejects(parseImportFile(json,".json"),/JSON nesting limit exceeded/);
  await fs.writeFile(json,Buffer.from([0xc3,0x28])); await assert.rejects(parseImportFile(json,".json"));
});

test("CSV, JSON, and JSONL imports enforce byte and row bounds", async (t) => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-import-limits-")); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const oversized=path.join(dir,"oversized.json"), csv=path.join(dir,"rows.csv"), jsonl=path.join(dir,"rows.jsonl");
  await fs.writeFile(oversized,Buffer.alloc(IMPORT_LIMITS.bytes + 1));
  await assert.rejects(parseImportFile(oversized,".json"),/exceeds 26214400 bytes/);
  await fs.writeFile(csv,`run\n${"row\n".repeat(IMPORT_LIMITS.rows + 1)}`);
  await assert.rejects(parseImportFile(csv,".csv"),/row limit exceeded/);
  await fs.writeFile(jsonl,'{"run":"row"}\n'.repeat(IMPORT_LIMITS.rows + 1));
  await assert.rejects(parseImportFile(jsonl,".jsonl"),/row limit exceeded/);
});

test("JSONL malformed records identify their physical line, including blank lines", async (t) => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-jsonl-lines-")); t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const jsonl=path.join(dir,"data.jsonl");
  await fs.writeFile(jsonl,'{"step":1}\n\n{broken}\n');
  await assert.rejects(parseImportFile(jsonl,".jsonl"),/JSONL line 3 is invalid/);
});

test("comparison deltas respect direction and parameter diffs without selecting a winner", () => {
  const compared=compareRuns([{id:"baseline",parameters:{seed:1},metrics:{"recall-at-10":{value:.8}}},{id:"variant",parameters:{seed:2},metrics:{"recall-at-10":{value:.85}}}],"baseline",[metric()]);
  assert.equal(compared[1].metrics["recall-at-10"].delta,.04999999999999993);
  assert.equal(compared[1].metrics["recall-at-10"].outcome,"improvement");
  assert.equal(compared[1].parameterDiff.seed,true);
  assert.equal("winner" in compared[1],false);
});

test("zero-baseline comparisons keep the absolute delta without inventing a relative delta", () => {
  const compared=compareRuns([{id:"baseline",parameters:{},metrics:{"recall-at-10":{value:0}}},{id:"variant",parameters:{},metrics:{"recall-at-10":{value:.1}}}],"baseline",[metric()]);
  const measurement=compared[1].metrics["recall-at-10"];
  assert.equal(measurement.delta,.1);
  assert.equal("relativeDelta" in measurement,false);
  assert.ok(Number.isFinite(measurement.delta));
});

test("ablation confounding detects uncontrolled parameter changes and missing controls", () => {
  const result=detectConfounding({parameters:{seed:1,batch:8}},[{parameters:{seed:1,batch:16}}],"factor",["seed","dataset"]);
  assert.equal(result.potentiallyConfounded,true);
  assert.deepEqual(result.differing,["batch"]);
  assert.deepEqual(result.missingControls,["dataset"]);
});

test("visualization suggestions follow run and metric semantics", () => {
  const choices=recommendVisualizations([{parameters:{rowMode:"time",learningRate:0.1,seed:1,batch:8,optimizer:"adam",device:"cpu"},metrics:{}}],[metric(),metric({id:"latency",role:"primary"})]);
  assert.ok(choices.includes("Line chart"));
  assert.ok(choices.includes("Parameter × metric scatter"));
  assert.ok(choices.includes("Parallel coordinates"));
  assert.ok(choices.includes("Pareto scatter"));
});

test("Markdown metric discovery is advisory and portable run IDs reject unsafe names", () => {
  const candidates=discoverMetricCandidates("# Plan\n\n## Evaluation metrics\nrecall@10 and latency\n## Setup\ntext");
  assert.equal(candidates.length,1); assert.match(candidates[0].text,/recall@10/);
  assert.equal(validateRunId("run-01"),"run-01");
  for (const id of ["a:b","../x","bad/id","run.","-run","con","com1"]) assert.equal(validateRunId(id),null);
});

test("compiler indexes structured evaluation and experiment references, plus Markdown candidates", async (t) => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-evaluation-index-")); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,"progress","Study"),{recursive:true});
  await fs.writeFile(path.join(root,"research-observer.config.json"),JSON.stringify({allowedTypes:["evaluation","experiment"],allowedStatuses:["investigating"],allowedMediaExtensions:[".csv",".tsv",".json",".jsonl"],researchProjects:[{id:"default",label:"Default"}]}));
  const fm=(id,type,extra="")=>`---\nid: ${id}\ntitle: ${id}\ntype: ${type}\nstatus: investigating\n${extra}---\n\n# ${id}\n`;
  const plan={schemaVersion:1,metrics:[metric()],comparisons:[],ablations:[],successCriteria:[]};
  await fs.writeFile(path.join(root,"progress","Study","00_evaluation.md"),fm("evaluation-main","evaluation",`evaluationPlan: ${JSON.stringify(plan)}\n`));
  await fs.writeFile(path.join(root,"progress","Study","01_experiment.md"),fm("experiment-main","experiment",`experimentSpec: {schemaVersion: 1, evaluationPlan: evaluation-main, kind: benchmark, factors: [], controlledVariables: []}\n`)+"\n## Metrics\nLegacy recall measure\n");
  const workspace=await compileResearchWorkspace({rootDir:root,fresh:true});
  assert.equal(workspace.stats.errors,0);
  assert.equal(workspace.entries.find((entry)=>entry.id==="experiment-main").experimentSpec.evaluationPlan,"evaluation-main");
  assert.equal(workspace.entries.find((entry)=>entry.id==="experiment-main").candidateMetricDefinitions.length,1);
});

test("manual run manifests persist source files and reject duplicate run IDs", async (t) => {
  const root=await experimentFixture(t), result=await createExperimentRun({ rootDir:root, projectId:"study", experimentId:"experiment-main", runId:"manual-1", label:"Manual", metrics:{"recall-at-10":{value:.83,source:{kind:"manual",note:"Measured from saved worksheet."}}} });
  const manifest=path.join(root,"progress","Study","experiments","experiment-main","runs","manual-1",".observaire-run.json");
  assert.equal(JSON.parse(await fs.readFile(manifest,"utf8")).metrics["recall-at-10"].value,.83);
  assert.equal(result.manifestPath,"Study/experiments/experiment-main/runs/manual-1/.observaire-run.json");
  await assert.rejects(createExperimentRun({ rootDir:root, projectId:"study", experimentId:"experiment-main", runId:"manual-1", metrics:{"recall-at-10":{value:.9,source:{kind:"manual",note:"duplicate"}}} }),/already exists/);
});

test("run write validation rolls back when metric source column is absent", async (t) => {
  const root=await experimentFixture(t), upload={filename:"results.csv",bytes:Buffer.from("other\n1\n")};
  await assert.rejects(createExperimentRun({ rootDir:root, projectId:"study", experimentId:"experiment-main", runId:"bad-source", upload, metrics:{"recall-at-10":{value:1,source:{file:"results.csv",column:"recall-at-10",aggregation:"mean"}}} }),/failed validation/);
  await assert.rejects(fs.access(path.join(root,"progress","Study","experiments","experiment-main","runs","bad-source")));
});

test("compiler diagnoses unsafe run paths, unknown experiments, and undefined metrics", async (t) => {
  const root=await experimentFixture(t), manifestDir=path.join(root,"progress","Study","experiments","wrong-exp","runs","bad:run");
  await fs.mkdir(manifestDir,{recursive:true});
  await fs.writeFile(path.join(manifestDir,".observaire-run.json"),JSON.stringify({schemaVersion:1,id:"bad:run",experimentId:"unknown-experiment",label:"Invalid",status:"complete",timestamps:{createdAt:new Date().toISOString()},parameters:{},metrics:{"made-up":{value:3,source:{kind:"manual",note:"fixture"}}},dataFiles:[],artifacts:[]}));
  const workspace=await compileResearchWorkspace({rootDir:root,fresh:true}), codes=new Set(workspace.diagnostics.map((item)=>item.code));
  assert.ok(codes.has("experiment-data-path-unsafe"));
  assert.ok(codes.has("run-id-invalid"));
  assert.ok(codes.has("run-experiment-unknown"));
  assert.ok(codes.has("run-metric-unknown"));
});

async function experimentFixture(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"observaire-run-fixture-")); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const project=path.join(root,"progress","Study"); await fs.mkdir(project,{recursive:true});
  await fs.writeFile(path.join(root,"research-observer.config.json"),JSON.stringify({allowedTypes:["evaluation","experiment"],allowedStatuses:["investigating"],allowedMediaExtensions:[".csv",".tsv",".json",".jsonl"],researchProjects:[{id:"default",label:"Default"}]}));
  const plan={schemaVersion:1,metrics:[metric()],comparisons:[],ablations:[],successCriteria:[]};
  const note=(id,type,fields)=>`---\nid: ${id}\ntitle: ${id}\ntype: ${type}\nstatus: investigating\n${fields}---\n\n# ${id}\n`;
  await fs.writeFile(path.join(project,"00_eval.md"),note("evaluation-main","evaluation",`evaluationPlan: ${JSON.stringify(plan)}\n`));
  await fs.writeFile(path.join(project,"01_exp.md"),note("experiment-main","experiment","experimentSpec: {schemaVersion: 1, evaluationPlan: evaluation-main, kind: benchmark, factors: [], controlledVariables: []}\n"));
  return root;
}
