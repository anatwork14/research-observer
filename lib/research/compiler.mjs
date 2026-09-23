import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import {
  PROJECT_IMPORT_PREFIX,
  PROJECT_MANIFEST,
  discoverProjectFolders,
  projectDirectoryForFile,
} from "./project-folders.mjs";

const NOTE = /^(\d+)_.*\.md$/i;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cache = new Map();
const defaults = {
  progressDir: "progress",
  warnOnMissingId: true,
  strictVocabulary: false,
  allowedTypes: ["note","question","hypothesis","literature","method","dataset","experiment","result","decision","milestone","evidence"],
  allowedStatuses: ["idea","investigating","experimenting","validating","complete","blocked","archived"],
  allowedRelationshipTypes: ["supports","contradicts","answers","investigates","builds_on","produces","uses","based_on","derived_from","reproduces","supersedes","references"],
  allowedMediaExtensions: [".png",".jpg",".jpeg",".gif",".webp",".avif",".svg",".bmp",".pdf",".mp4",".webm",".ogv",".ogg",".mp3",".wav",".m4a",".aac",".flac",".csv",".json",".txt"],
  maxAssetBytes: 262144000,
  researchProjects: [
    {id:"default",label:"Main research",description:"Research objects without an explicit research project."}
  ],
  savedCollections: [
    {id:"active",label:"Active research",description:"Everything not marked complete or archived.",query:"-status:complete -status:archived"},
    {id:"questions",label:"Questions",description:"Research questions across the workspace.",query:"type:question"},
    {id:"validating",label:"Validating experiments",description:"Experiments currently in validation.",query:"type:experiment status:validating"},
    {id:"papers",label:"Literature with PDFs",description:"Literature notes backed by local papers.",query:"type:literature has:pdf"},
    {id:"evidence",label:"PDF evidence",description:"Durable evidence objects with source provenance.",query:"type:evidence has:source"},
    {id:"contradictions",label:"Contradictions",description:"Objects connected through contradiction relationships.",query:"relationship:contradicts"}
  ]
};

const posix = (v) => v.split(path.sep).join("/");
const diag = (severity, code, message, file) => ({ severity, code, message, ...(file ? { file } : {}) });
const strip = (v) => v.replace(/```[\s\S]*?```/g," ").replace(/`([^`]+)`/g,"$1").replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/[#>*_~|]/g," ").replace(/\s+/g," ").trim();
const firstHeading = (v) => v.match(/^#\s+(.+)$/m)?.[1]?.trim();
const titleFromFile = (v) => v.replace(/\.md$/i,"").replace(/^\d+_/,"").replace(/[_-]+/g," ").replace(/\b\w/g,(x)=>x.toUpperCase());
const summaryFrom = (v) => { const p=strip(v); return p.length>180?p.slice(0,177)+"…":p; };
const noHash = (v) => v.split("#",1)[0].split("?",1)[0];

function stringValue(value, field, file, diagnostics) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    diagnostics.push(diag("error","frontmatter-type",field+" must be a string.",file));
    return undefined;
  }
  return value.trim() || undefined;
}
function listValue(value, field, file, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v)=>typeof v!=="string")) {
    diagnostics.push(diag("error","frontmatter-type",field+" must be a list of strings.",file));
    return [];
  }
  return [...new Set(value.map((v)=>v.trim()).filter(Boolean))];
}
function relationshipValue(value, file, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    diagnostics.push(diag("error","frontmatter-type","relationships must be a list of { type, target } objects.",file));
    return [];
  }
  const out=[];
  for (const item of value) {
    if (!item || typeof item!=="object" || Array.isArray(item)) {
      diagnostics.push(diag("error","frontmatter-type","Each relationship must be an object.",file));
      continue;
    }
    const type=typeof item.type==="string"?item.type.trim():"";
    const target=typeof item.target==="string"?item.target.trim():"";
    const note=typeof item.note==="string"?item.note.trim():undefined;
    if (!type || !target) {
      diagnostics.push(diag("error","relationship-invalid","Each relationship needs non-empty type and target fields.",file));
      continue;
    }
    out.push({type,target,...(note?{note}:{})});
  }
  return out;
}
function sourceValue(value, file, diagnostics) {
  if (value === undefined) return undefined;
  if (!value || typeof value!=="object" || Array.isArray(value)) {
    diagnostics.push(diag("error","frontmatter-type","source must be an object.",file));
    return undefined;
  }
  const kind=typeof value.kind==="string"?value.kind.trim().toLowerCase():"";
  const pdf=typeof value.pdf==="string"?value.pdf.trim():"";
  const page=typeof value.page==="number"?value.page:typeof value.page==="string"&&/^\d+$/.test(value.page.trim())?Number(value.page.trim()):undefined;
  const url=typeof value.url==="string"?value.url.trim():"";
  const doi=typeof value.doi==="string"?value.doi.trim():"";
  const paperId=typeof value.paper_id==="string"?value.paper_id.trim():typeof value.paperId==="string"?value.paperId.trim():"";
  const query=typeof value.query==="string"?value.query.trim():"";

  if (kind==="consensus" || (!pdf && (url || doi || paperId))) {
    if (url && !/^https:\/\//i.test(url)) diagnostics.push(diag("error","source-invalid","External evidence source URL must use HTTPS.",file));
    if (!url && !doi && !paperId) diagnostics.push(diag("error","source-invalid","Consensus evidence source requires a URL, DOI, or paper id.",file));
    if ((url && !/^https:\/\//i.test(url)) || (!url && !doi && !paperId)) return undefined;
    return {
      kind:"consensus",
      ...(url?{url}:{}),
      ...(doi?{doi}:{}),
      ...(paperId?{paperId}:{}),
      ...(query?{query}:{}),
    };
  }

  if (kind && kind!=="pdf") diagnostics.push(diag("error","source-invalid",'Unsupported evidence source kind "'+kind+'".',file));
  if (!pdf) diagnostics.push(diag("error","source-invalid","PDF evidence source requires a pdf path.",file));
  if (page!==undefined && (!Number.isInteger(page)||page<1)) diagnostics.push(diag("error","source-invalid","Evidence source page must be a positive integer.",file));
  if (!pdf || (kind && kind!=="pdf")) return undefined;
  return {kind:"pdf",pdf,page};
}
function dateValue(value, file, diagnostics) {
  if (value === undefined) return undefined;
  const v=value instanceof Date?value.toISOString().slice(0,10):typeof value==="string"?value.trim():"";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    diagnostics.push(diag("error","date-invalid","date must use YYYY-MM-DD.",file));
    return undefined;
  }
  return v;
}
function yearValue(value, file, diagnostics) {
  if (value === undefined) return undefined;
  const v = typeof value === "number" ? value : typeof value === "string" && /^\d{4}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isInteger(v) || v < 1000 || v > 9999) {
    diagnostics.push(diag("error","year-invalid","year must be a four-digit year.",file));
    return undefined;
  }
  return v;
}
function structuralSource(content) {
  return content
    .replace(/\`\`\`[\s\S]*?\`\`\`/g,"")
    .replace(/\`[^\`\n]*\`/g,"");
}
function targets(content) {
  const source=structuralSource(content), out=[];
  for (const m of source.matchAll(/(!?)\[[^\]]*\]\(([^)]+)\)/g)) out.push({target:m[2].trim().replace(/^<|>$/g,"").split(/\s+["'(]/)[0],image:m[1]==="!"});
  for (const m of source.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) out.push({target:m[1].replace(/^<|>$/g,""),image:false});
  return out;
}
function headings(content) {
  return [...structuralSource(content).matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m)=>({level:m[1].length,title:m[2].replace(/[*_~`]/g,"").trim()}));
}
async function configAt(root, diagnostics) {
  try {
    const raw=await fs.readFile(path.join(root,"research-observer.config.json"),"utf8");
    const parsed=JSON.parse(raw);
    const config={...defaults,...parsed};
    for(const key of ["allowedTypes","allowedStatuses","allowedMediaExtensions","allowedRelationshipTypes"]) {
      if(!Array.isArray(config[key])||config[key].some((value)=>typeof value!=="string")) {
        diagnostics.push(diag("error","config-type",key+" must be a JSON array of strings.","research-observer.config.json"));
        config[key]=defaults[key];
      }
    }
    if(!Array.isArray(config.researchProjects) || config.researchProjects.length===0 || config.researchProjects.some((item)=>
      !item || typeof item!=="object" || Array.isArray(item) ||
      typeof item.id!=="string" || !ID.test(item.id) ||
      typeof item.label!=="string" || !item.label.trim() ||
      (item.description!==undefined && typeof item.description!=="string")
    ) || new Set(config.researchProjects.map((item)=>item.id)).size!==config.researchProjects.length) {
      diagnostics.push(diag("error","config-type","researchProjects must be a non-empty list of unique { id, label, description? } objects with kebab-case ids.","research-observer.config.json"));
      config.researchProjects=defaults.researchProjects;
    }
    if(!Array.isArray(config.savedCollections) || config.savedCollections.some((item)=>
      !item || typeof item!=="object" || Array.isArray(item) ||
      typeof item.id!=="string" || !ID.test(item.id) ||
      typeof item.label!=="string" || !item.label.trim() ||
      typeof item.query!=="string"
    )) {
      diagnostics.push(diag("error","config-type","savedCollections must be a list of { id, label, query, description? } objects with kebab-case ids.","research-observer.config.json"));
      config.savedCollections=defaults.savedCollections;
    }
    if(typeof config.warnOnMissingId!=="boolean") {
      diagnostics.push(diag("error","config-type","warnOnMissingId must be boolean.","research-observer.config.json"));
      config.warnOnMissingId=defaults.warnOnMissingId;
    }
    if(typeof config.strictVocabulary!=="boolean") {
      diagnostics.push(diag("error","config-type","strictVocabulary must be boolean.","research-observer.config.json"));
      config.strictVocabulary=defaults.strictVocabulary;
    }
    if(typeof config.progressDir!=="string"||!config.progressDir.trim()) {
      diagnostics.push(diag("error","config-type","progressDir must be a non-empty string.","research-observer.config.json"));
      config.progressDir=defaults.progressDir;
    }
    if(!Number.isFinite(config.maxAssetBytes)||config.maxAssetBytes<0) {
      diagnostics.push(diag("error","config-type","maxAssetBytes must be a non-negative number.","research-observer.config.json"));
      config.maxAssetBytes=defaults.maxAssetBytes;
    }
    return {config,raw};
  } catch (e) {
    if (e?.code==="ENOENT") return {config:{...defaults,researchProjects:[...defaults.researchProjects],savedCollections:[...defaults.savedCollections]},raw:""};
    diagnostics.push(diag("error","config-invalid","Could not parse research-observer.config.json.","research-observer.config.json"));
    return {config:{...defaults,researchProjects:[...defaults.researchProjects],savedCollections:[...defaults.savedCollections]},raw:""};
  }
}
async function walk(root, current=root, diagnostics=[]) {
  const out=[];
  let list=[];
  try { list=await fs.readdir(current,{withFileTypes:true}); } catch (e) { if(e?.code==="ENOENT") return out; throw e; }
  for (const item of list) {
    const abs=path.join(current,item.name), rel=posix(path.relative(root,abs));
    if (item.isSymbolicLink()) { diagnostics.push(diag("error","symlink-not-allowed","Symlinks are not allowed inside progress/.",rel)); continue; }
    if (item.isDirectory()) {
      if (item.name===".git" || item.name.startsWith(PROJECT_IMPORT_PREFIX)) continue;
      out.push(...await walk(root,abs,diagnostics));
      continue;
    }
    if (!item.isFile()) continue;
    const s=await fs.stat(abs);
    out.push({abs,rel,size:s.size,mtime:s.mtimeMs,ext:path.extname(item.name).toLowerCase()});
  }
  return out.sort((a,b)=>a.rel.localeCompare(b.rel));
}
function assetPath(noteFile,target) {
  const joined=path.posix.normalize(path.posix.join(path.posix.dirname(noteFile),posix(noHash(target))));
  return joined===".."||joined.startsWith("../")||path.posix.isAbsolute(joined)?null:joined.replace(/^\.\//,"");
}
function routeFallback(projectId,fileSlug,nested) {
  return nested ? `${projectId}-${fileSlug}` : fileSlug;
}

export async function compileResearchWorkspace({rootDir=process.cwd(),fresh=false}={}) {
  const root=path.resolve(rootDir), diagnostics=[];
  const {config,raw:configRaw}=await configAt(root,diagnostics);
  let progressRoot=path.resolve(root,config.progressDir||"progress");
  if(progressRoot===root||!progressRoot.startsWith(root+path.sep)) {
    diagnostics.push(diag("error","config-progress-dir","progressDir must resolve to a directory inside the repository.","research-observer.config.json"));
    progressRoot=path.join(root,"progress");
  }
  const files=await walk(progressRoot,progressRoot,diagnostics);
  const discovered=await discoverProjectFolders({progressRoot,files});
  diagnostics.push(...discovered.issues.map((issue)=>diag(issue.severity,issue.code,issue.message,issue.file)));

  const configuredProjects=new Map(config.researchProjects.map((project)=>[project.id,project]));
  const effectiveProjects=[...config.researchProjects];
  for (const folderProject of discovered.projects) {
    if (!configuredProjects.has(folderProject.id)) {
      effectiveProjects.push({id:folderProject.id,label:folderProject.label,description:folderProject.description});
      configuredProjects.set(folderProject.id,effectiveProjects.at(-1));
    }
  }
  config.researchProjects=effectiveProjects;

  const signature=crypto.createHash("sha256").update(configRaw).update(JSON.stringify(files.map((f)=>[f.rel,f.size,f.mtime]))).digest("hex");
  const hit=cache.get(root);
  if (!fresh && hit?.signature===signature) return hit.workspace;

  const markdownFiles=files.filter((f)=>f.ext===".md");
  const noteFiles=markdownFiles.filter((f)=>NOTE.test(path.posix.basename(f.rel)));
  for(const file of markdownFiles) {
    if(!NOTE.test(path.posix.basename(file.rel))) diagnostics.push(diag("warning","note-ignored","Markdown file is ignored because it does not match the numeric-prefix convention.",file.rel));
  }
  if(!noteFiles.length) diagnostics.push(diag("warning","workspace-empty","No ordered research notes were found in progress/ or its project folders."));
  const entries=[], orderMap=new Map();
  const vocabularySeverity=config.strictVocabulary?"error":"warning";

  for (const f of noteFiles) {
    const raw=await fs.readFile(f.abs,"utf8");
    let parsed; try { parsed=matter(raw); } catch { diagnostics.push(diag("error","frontmatter-invalid","Frontmatter could not be parsed.",f.rel)); parsed={data:{},content:raw}; }
    const {data,content}=parsed, filename=f.rel, basename=path.posix.basename(f.rel), fileSlug=basename.replace(/\.md$/i,"");
    const projectDirectory=projectDirectoryForFile(filename);
    const folderProject=projectDirectory?discovered.byDirectory.get(projectDirectory):undefined;
    let id=stringValue(data.id,"id",filename,diagnostics);
    if (id&&!ID.test(id)) { diagnostics.push(diag("error","id-invalid","id must use lowercase kebab-case.",filename)); id=undefined; }
    if (!id&&config.warnOnMissingId) diagnostics.push(diag("warning","id-missing","Add a stable id so file renames do not change the canonical URL.",filename));
    const type=stringValue(data.type,"type",filename,diagnostics), status=stringValue(data.status,"status",filename,diagnostics);
    const requestedResearch=stringValue(data.research,"research",filename,diagnostics);
    let research=folderProject?.id||requestedResearch||"default";
    if (folderProject && requestedResearch && requestedResearch!==folderProject.id) {
      diagnostics.push(diag(vocabularySeverity,"research-folder-mismatch",`Folder project "${folderProject.id}" takes precedence over frontmatter research "${requestedResearch}".`,filename));
    }
    if (!ID.test(research)) {
      diagnostics.push(diag("error","research-invalid","research must use lowercase kebab-case.",filename));
      research=folderProject?.id||"default";
    }
    if (!config.researchProjects.some((project)=>project.id===research)) {
      diagnostics.push(diag(vocabularySeverity,"research-project-unknown",'Research project "'+research+'" is not declared or discoverable from a project folder.',filename));
    }
    if(type&&!config.allowedTypes.includes(type)) diagnostics.push(diag(vocabularySeverity,"type-unknown",'Unknown type "'+type+'".',filename));
    if(status&&!config.allowedStatuses.includes(status)) diagnostics.push(diag(vocabularySeverity,"status-unknown",'Unknown status "'+status+'".',filename));
    const tags=listValue(data.tags,"tags",filename,diagnostics), aliases=listValue(data.aliases,"aliases",filename,diagnostics);
    const relationshipsRaw=relationshipValue(data.relationships,filename,diagnostics);
    for (const relation of relationshipsRaw) {
      if (!config.allowedRelationshipTypes.includes(relation.type)) {
        diagnostics.push(diag(vocabularySeverity,"relationship-type-unknown",'Unknown relationship type "'+relation.type+'".',filename));
      }
    }
    const source=sourceValue(data.source,filename,diagnostics);
    const authors=listValue(data.authors,"authors",filename,diagnostics);
    const doi=stringValue(data.doi,"doi",filename,diagnostics);
    const rawPdf=stringValue(data.pdf,"pdf",filename,diagnostics);
    let pdf;
    if (rawPdf) {
      if (/^https?:\/\//i.test(rawPdf)) {
        pdf=rawPdf;
        diagnostics.push(diag("warning","paper-remote","Remote PDF companions are not copied into the local Papers library.",filename));
      } else {
        pdf=assetPath(filename,rawPdf);
        if (!pdf) diagnostics.push(diag("error","paper-path-invalid",'PDF companion "'+rawPdf+'" escapes progress/.',filename));
      }
    }
    const fallbackSlug=routeFallback(research,fileSlug,Boolean(folderProject));
    const words=strip(content).split(/\s+/).filter(Boolean).length, slug=id||fallbackSlug;
    entries.push({
      filename,fileSlug,slug,id,aliases:[...new Set([...(slug!==fallbackSlug?[fallbackSlug]:[]),...aliases])].filter((x)=>x!==slug),
      order:Number(basename.match(NOTE)?.[1]||0),
      title:stringValue(data.title,"title",filename,diagnostics)||firstHeading(content)||titleFromFile(basename),
      summary:stringValue(data.summary,"summary",filename,diagnostics)||summaryFrom(content),
      type,status,research,date:dateValue(data.date,filename,diagnostics),tags,authors,year:yearValue(data.year,filename,diagnostics),doi,pdf,source,content,text:strip(content),words,
      readingMinutes:Math.max(1,Math.ceil(words/220)),headings:headings(content),linkedSlugs:[],backlinks:[],relationships:[],incomingRelationships:[],assets:[],_relationshipsRaw:relationshipsRaw,_targets:targets(content)
    });
    const n=entries.at(-1).order, key=`${research}\u0000${n}`, same=orderMap.get(key)||[]; same.push(filename); orderMap.set(key,same);
  }
  const projectRank=new Map(config.researchProjects.map((project,index)=>[project.id,index]));
  entries.sort((a,b)=>(projectRank.get(a.research)??9999)-(projectRank.get(b.research)??9999)||a.order-b.order||a.filename.localeCompare(b.filename));
  for(const [key,names] of orderMap) if(names.length>1) {
    const [research,n]=key.split("\u0000");
    diagnostics.push(diag("warning","order-duplicate","Order "+n+" is shared inside project "+research+" by "+names.join(", ")+"."));
  }

  const routes=new Map(), filesByPath=new Map(), filesByBase=new Map();
  for(const e of entries) {
    if(routes.has(e.slug)) diagnostics.push(diag("error","id-duplicate",'Duplicate id/slug "'+e.slug+'".',e.filename));
    routes.set(e.slug,e);
    const filePath=e.filename.replace(/\.md$/i,"");
    filesByPath.set(filePath,e);
    const base=path.posix.basename(filePath), same=filesByBase.get(base)||[]; same.push(e); filesByBase.set(base,same);
    for(const a of e.aliases) {
      if(routes.has(a)&&routes.get(a)!==e) diagnostics.push(diag("error","alias-collision",'Alias "'+a+'" collides with another note.',e.filename));
      else routes.set(a,e);
    }
  }

  function resolveNoteTarget(sourceEntry,rawTarget) {
    const raw=posix(noHash(String(rawTarget??""))).replace(/\.md$/i,"").replace(/^\.\//,"");
    if (!raw) return undefined;
    const route=routes.get(raw);
    if (route) return route;
    const relative=path.posix.normalize(path.posix.join(path.posix.dirname(sourceEntry.filename),raw));
    const exact=filesByPath.get(relative);
    if (exact) return exact;
    const candidates=filesByBase.get(path.posix.basename(raw))||[];
    const sameProject=candidates.filter((candidate)=>candidate.research===sourceEntry.research);
    if (sameProject.length===1) return sameProject[0];
    return candidates.length===1?candidates[0]:undefined;
  }

  const assetSourceFiles=files.filter((f)=>f.ext!==".md"&&path.posix.basename(f.rel)!==PROJECT_MANIFEST);
  const assetFiles=new Map(assetSourceFiles.map((f)=>[f.rel,f]));
  for(const e of entries) {
    for (const relation of e._relationshipsRaw) {
      const found=resolveNoteTarget(e,relation.target);
      if (!found) {
        diagnostics.push(diag("error","relationship-target-missing",'Relationship target "'+relation.target+'" does not resolve.',e.filename));
        continue;
      }
      if (found.slug===e.slug) {
        diagnostics.push(diag("warning","relationship-self",'Relationship "'+relation.type+'" points back to the same note.',e.filename));
        continue;
      }
      if (relation.type==="supersedes" && found.research!==e.research) {
        diagnostics.push(diag("warning","supersedes-cross-project",'supersedes should connect semantic versions inside the same research project; the relationship remains visible but is excluded from version lineage.',e.filename));
      }
      e.relationships.push({type:relation.type,target:found.slug,...(relation.note?{note:relation.note}:{})});
    }
    delete e._relationshipsRaw;
    const linked=new Set(), used=new Set();
    for(const ref of e._targets) {
      const t=ref.target;
      if(!t||t.startsWith("#")||/^(mailto:|tel:)/i.test(t)) continue;
      if(/^https?:\/\//i.test(t)) { if(/^http:\/\//i.test(t)) diagnostics.push(diag("warning","remote-http","Prefer HTTPS.",e.filename)); continue; }
      if(/^[a-z][a-z0-9+.-]*:/i.test(t)) { diagnostics.push(diag("error","url-scheme-unsupported",'Unsupported URL scheme in "'+t+'".',e.filename)); continue; }
      if(noHash(t).toLowerCase().endsWith(".md")) {
        const found=resolveNoteTarget(e,t);
        if(!found) diagnostics.push(diag("error","link-broken",'Internal link "'+t+'" does not resolve.',e.filename)); else if(found.slug!==e.slug) linked.add(found.slug);
        continue;
      }
      const resolved=assetPath(e.filename,t), ext=resolved?path.posix.extname(resolved).toLowerCase():"";
      if(!resolved) { diagnostics.push(diag("error","asset-path-invalid",'Asset "'+t+'" escapes progress/.',e.filename)); continue; }
      if(!ref.image&&!ext) continue;
      if(!config.allowedMediaExtensions.includes(ext)) diagnostics.push(diag("warning","asset-type-unsupported",'Asset type "'+(ext||"(none)")+'" is not allowed.',e.filename));
      if(!assetFiles.has(resolved)) diagnostics.push(diag("error","asset-missing",'Asset "'+t+'" does not exist.',e.filename)); else used.add(resolved);
    }
    if (e.source?.pdf) {
      const resolvedSource=assetPath(e.filename,e.source.pdf);
      if (!resolvedSource) diagnostics.push(diag("error","source-path-invalid",'Evidence source "'+e.source.pdf+'" escapes progress/.',e.filename));
      else if (path.posix.extname(resolvedSource).toLowerCase()!==".pdf") diagnostics.push(diag("error","source-not-pdf",'Evidence source must point to a .pdf file.',e.filename));
      else if (!assetFiles.has(resolvedSource)) diagnostics.push(diag("error","asset-missing",'Evidence source PDF "'+e.source.pdf+'" does not exist.',e.filename));
      else {
        e.source={...e.source,pdf:resolvedSource};
        used.add(resolvedSource);
      }
    }
    if (e.pdf && !/^https?:\/\//i.test(e.pdf)) {
      const extension=path.posix.extname(e.pdf).toLowerCase();
      if (extension!==".pdf") diagnostics.push(diag("error","paper-not-pdf",'Frontmatter pdf must point to a .pdf file, got "'+e.pdf+'".',e.filename));
      else if (!assetFiles.has(e.pdf)) diagnostics.push(diag("error","asset-missing",'PDF companion "'+e.pdf+'" does not exist.',e.filename));
      else used.add(e.pdf);
    }
    e.linkedSlugs=[...linked]; e.assets=[...used]; delete e._targets;
  }
  for(const e of entries) {
    e.backlinks=entries.filter((x)=>x.linkedSlugs.includes(e.slug)).map((x)=>x.slug);
    e.incomingRelationships=entries.flatMap((sourceEntry)=>
      sourceEntry.relationships
        .filter((relation)=>relation.target===e.slug)
        .map((relation)=>({type:relation.type,source:sourceEntry.slug,...(relation.note?{note:relation.note}:{})}))
    );
  }

  const graph={
    nodes:entries.map((e)=>({slug:e.slug,title:e.title,type:e.type,status:e.status,research:e.research,order:e.order})),
    edges:[
      ...entries.flatMap((e)=>e.relationships.map((relation)=>({source:e.slug,target:relation.target,type:relation.type,explicit:true}))),
      ...entries.flatMap((e)=>e.linkedSlugs
        .filter((target)=>!e.relationships.some((relation)=>relation.target===target))
        .map((target)=>({source:e.slug,target,type:"references",explicit:false})))
    ]
  };

  const health={
    unansweredQuestions:entries.filter((e)=>e.type==="question"&&!e.incomingRelationships.some((r)=>r.type==="answers")).map((e)=>e.slug),
    experimentsWithoutResults:entries.filter((e)=>e.type==="experiment"&&!e.relationships.some((r)=>r.type==="produces")).map((e)=>e.slug),
    resultsWithoutExperiment:entries.filter((e)=>e.type==="result"&&!e.incomingRelationships.some((r)=>r.type==="produces")).map((e)=>e.slug),
    decisionsWithoutBasis:entries.filter((e)=>e.type==="decision"&&!e.relationships.some((r)=>r.type==="based_on")).map((e)=>e.slug),
    literatureMissingPdf:entries.filter((e)=>e.type==="literature"&&!e.pdf).map((e)=>e.slug),
    literatureMissingDoi:entries.filter((e)=>e.type==="literature"&&!e.doi).map((e)=>e.slug),
    evidenceMissingSource:entries.filter((e)=>e.type==="evidence"&&!e.source?.pdf&&!e.source?.url&&!e.source?.doi&&!e.source?.paperId).map((e)=>e.slug),
    missingStableIds:entries.filter((e)=>!e.id).map((e)=>e.slug)
  };

  const referenced=new Set(entries.flatMap((e)=>e.assets));
  const assets=assetSourceFiles.map((f)=>{
    if(!config.allowedMediaExtensions.includes(f.ext)) diagnostics.push(diag("warning","asset-unapproved",'File type "'+(f.ext||"(none)")+'" is not approved.',f.rel));
    if(f.size>config.maxAssetBytes) diagnostics.push(diag("warning","asset-large","Asset exceeds the configured size threshold.",f.rel));
    if(config.allowedMediaExtensions.includes(f.ext)&&!referenced.has(f.rel)) diagnostics.push(diag("warning","asset-orphan","Asset is not referenced by any note.",f.rel));
    return {path:f.rel,extension:f.ext,size:f.size};
  });

  diagnostics.sort((a,b)=>(a.severity==="error"?0:1)-(b.severity==="error"?0:1)||(a.file||"").localeCompare(b.file||"")||a.code.localeCompare(b.code));
  const folderProjectsById=new Map(discovered.projects.map((project)=>[project.id,project]));
  const projectIds=[...new Set(entries.map((entry)=>entry.research))];
  const projects=[...new Set([...config.researchProjects.map((project)=>project.id),...projectIds])].map((id)=>{
    const metadata=configuredProjects.get(id)??{id,label:id.replace(/-/g," ").replace(/\b\w/g,(letter)=>letter.toUpperCase())};
    const folderMetadata=folderProjectsById.get(id);
    const projectEntries=entries.filter((entry)=>entry.research===id);
    const projectSlugs=new Set(projectEntries.map((entry)=>entry.slug));
    const projectDiagnostics=diagnostics.filter((item)=>item.file&&projectEntries.some((entry)=>entry.filename===item.file));
    return {
      ...metadata,
      ...(folderMetadata?{directory:folderMetadata.directory,autoIndexed:true}:{}),
      notes:projectEntries.length,
      active:projectEntries.filter((entry)=>!["complete","archived"].includes(entry.status??"")).length,
      questions:projectEntries.filter((entry)=>entry.type==="question").length,
      hypotheses:projectEntries.filter((entry)=>entry.type==="hypothesis").length,
      literature:projectEntries.filter((entry)=>entry.type==="literature").length,
      experiments:projectEntries.filter((entry)=>entry.type==="experiment").length,
      results:projectEntries.filter((entry)=>entry.type==="result").length,
      evidence:projectEntries.filter((entry)=>entry.type==="evidence").length,
      decisions:projectEntries.filter((entry)=>entry.type==="decision").length,
      words:projectEntries.reduce((sum,entry)=>sum+entry.words,0),
      relationships:graph.edges.filter((edge)=>edge.explicit&&projectSlugs.has(edge.source)).length,
      crossProjectRelationships:graph.edges.filter((edge)=>edge.explicit&&projectSlugs.has(edge.source)&&!projectSlugs.has(edge.target)).length,
      errors:projectDiagnostics.filter((item)=>item.severity==="error").length,
      warnings:projectDiagnostics.filter((item)=>item.severity==="warning").length,
      firstDate:projectEntries.map((entry)=>entry.date).filter(Boolean).sort()[0],
      latestDate:projectEntries.map((entry)=>entry.date).filter(Boolean).sort().at(-1)
    };
  });
  const workspace={schemaVersion:3,rootDir:root,progressRoot,config,signature,entries,assets,graph,health,projects,diagnostics,stats:{
    notes:entries.length,links:entries.reduce((n,e)=>n+e.linkedSlugs.length,0),relationships:graph.edges.filter((edge)=>edge.explicit).length,assets:assets.length,
    errors:diagnostics.filter((d)=>d.severity==="error").length,warnings:diagnostics.filter((d)=>d.severity==="warning").length
  }};
  cache.set(root,{signature,workspace}); return workspace;
}

export async function writeResearchArtifacts(options={}) {
  const root=path.resolve(options.rootDir||process.cwd()), w=await compileResearchWorkspace({...options,rootDir:root});
  const dir=path.join(root,"public","_research");
  const mediaDir=path.join(dir,"media");
  await fs.mkdir(dir,{recursive:true});
  await fs.rm(mediaDir,{recursive:true,force:true});
  await fs.mkdir(mediaDir,{recursive:true});

  for (const asset of w.assets) {
    if (!w.config.allowedMediaExtensions.includes(asset.extension)) continue;
    const source=path.join(w.progressRoot,...asset.path.split("/"));
    const destination=path.join(mediaDir,...asset.path.split("/"));
    await fs.mkdir(path.dirname(destination),{recursive:true});
    await fs.copyFile(source,destination);
  }

  const entries=w.entries.map((entry)=>Object.fromEntries(Object.entries(entry).filter(([key])=>key!=="content"&&key!=="text")));
  const search=w.entries.map((e)=>({slug:e.slug,order:e.order,title:e.title,summary:e.summary,type:e.type,status:e.status,research:e.research,date:e.date,tags:e.tags,authors:e.authors,year:e.year,doi:e.doi,pdf:e.pdf,source:e.source,relationships:e.relationships,headings:e.headings,text:e.text}));
  await Promise.all([
    fs.writeFile(path.join(dir,"manifest.json"),JSON.stringify({schemaVersion:3,signature:w.signature,stats:w.stats,projects:w.projects,entries,assets:w.assets,health:w.health,diagnostics:w.diagnostics},null,2)+"\n"),
    fs.writeFile(path.join(dir,"search.json"),JSON.stringify({schemaVersion:3,signature:w.signature,entries:search})+"\n"),
    fs.writeFile(path.join(dir,"graph.json"),JSON.stringify({schemaVersion:1,signature:w.signature,...w.graph},null,2)+"\n"),
    fs.writeFile(path.join(dir,"health.json"),JSON.stringify({schemaVersion:1,signature:w.signature,...w.health},null,2)+"\n")
  ]);
  return w;
}