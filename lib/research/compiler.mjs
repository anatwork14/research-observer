import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";

const NOTE = /^(\d+)_.*\.md$/i;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cache = new Map();
const defaults = {
  progressDir: "progress",
  warnOnMissingId: true,
  allowedTypes: ["note","question","hypothesis","literature","method","dataset","experiment","result","decision","milestone"],
  allowedStatuses: ["idea","investigating","experimenting","validating","complete","blocked","archived"],
  allowedMediaExtensions: [".png",".jpg",".jpeg",".gif",".webp",".avif",".svg",".bmp",".pdf",".mp4",".webm",".ogv",".ogg",".mp3",".wav",".m4a",".aac",".flac",".csv",".json",".txt"],
  maxAssetBytes: 262144000
};

const posix = (v) => v.split(path.sep).join("/");
const diag = (severity, code, message, file) => ({ severity, code, message, ...(file ? { file } : {}) });
const strip = (v) => v.replace(/```[\s\S]*?```/g," ").replace(/`([^`]+)`/g,"$1").replace(/!\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/[#>*_~|]/g," ").replace(/\s+/g," ").trim();
const firstHeading = (v) => v.match(/^#\s+(.+)$/m)?.[1]?.trim();
const titleFromFile = (v) => v.replace(/\.md$/i,"").replace(/^\d+_/,"").replace(/[_-]+/g," ").replace(/\b\w/g,(x)=>x.toUpperCase());
const summaryFrom = (v) => { const p=strip(v); return p.length>180?p.slice(0,177)+"â€¦":p; };
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
function dateValue(value, file, diagnostics) {
  if (value === undefined) return undefined;
  const v=value instanceof Date?value.toISOString().slice(0,10):typeof value==="string"?value.trim():"";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    diagnostics.push(diag("error","date-invalid","date must use YYYY-MM-DD.",file));
    return undefined;
  }
  return v;
}
function targets(content) {
  const out=[];
  for (const m of content.matchAll(/(!?)\[[^\]]*\]\(([^)]+)\)/g)) out.push({target:m[2].trim().replace(/^<|>$/g,"").split(/\s+["'(]/)[0],image:m[1]==="!"});
  for (const m of content.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) out.push({target:m[1].replace(/^<|>$/g,""),image:false});
  return out;
}
function headings(content) {
  return [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m)=>({level:m[1].length,title:m[2].replace(/[*_~`]/g,"").trim()}));
}
async function configAt(root, diagnostics) {
  try {
    const raw=await fs.readFile(path.join(root,"research-observer.config.json"),"utf8");
    const parsed=JSON.parse(raw);
    const config={...defaults,...parsed};
    for(const key of ["allowedTypes","allowedStatuses","allowedMediaExtensions"]) {
      if(!Array.isArray(config[key])||config[key].some((value)=>typeof value!=="string")) {
        diagnostics.push(diag("error","config-type",key+" must be a JSON array of strings.","research-observer.config.json"));
        config[key]=defaults[key];
      }
    }
    if(typeof config.warnOnMissingId!=="boolean") {
      diagnostics.push(diag("error","config-type","warnOnMissingId must be boolean.","research-observer.config.json"));
      config.warnOnMissingId=defaults.warnOnMissingId;
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
    if (e?.code==="ENOENT") return {config:defaults,raw:""};
    diagnostics.push(diag("error","config-invalid","Could not parse research-observer.config.json.","research-observer.config.json"));
    return {config:defaults,raw:""};
  }
}
async function walk(root, current=root, diagnostics=[]) {
  const out=[];
  let list=[];
  try { list=await fs.readdir(current,{withFileTypes:true}); } catch (e) { if(e?.code==="ENOENT") return out; throw e; }
  for (const item of list) {
    const abs=path.join(current,item.name), rel=posix(path.relative(root,abs));
    if (item.isSymbolicLink()) { diagnostics.push(diag("error","symlink-not-allowed","Symlinks are not allowed inside progress/.",rel)); continue; }
    if (item.isDirectory()) { out.push(...await walk(root,abs,diagnostics)); continue; }
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

export async function compileResearchWorkspace({rootDir=process.cwd(),fresh=false}={}) {
  const root=path.resolve(rootDir), diagnostics=[];
  const {config,raw:configRaw}=await configAt(root,diagnostics);
  let progressRoot=path.resolve(root,config.progressDir||"progress");
  if(progressRoot===root||!progressRoot.startsWith(root+path.sep)) {
    diagnostics.push(diag("error","config-progress-dir","progressDir must resolve to a directory inside the repository.","research-observer.config.json"));
    progressRoot=path.join(root,"progress");
  }
  const files=await walk(progressRoot,progressRoot,diagnostics);
  const signature=crypto.createHash("sha256").update(configRaw).update(JSON.stringify(files.map((f)=>[f.rel,f.size,f.mtime]))).digest("hex");
  const hit=cache.get(root);
  if (!fresh && hit?.signature===signature) return hit.workspace;

  const rootMarkdown=files.filter((f)=>!f.rel.includes("/")&&f.ext===".md");
  const noteFiles=rootMarkdown.filter((f)=>NOTE.test(f.rel));
  for(const file of rootMarkdown) {
    if(!NOTE.test(file.rel)) diagnostics.push(diag("warning","note-ignored","Markdown file is ignored because it does not match the numeric-prefix convention.",file.rel));
  }
  if(!noteFiles.length) diagnostics.push(diag("warning","workspace-empty","No ordered research notes were found in progress/."));
  const entries=[], orderMap=new Map();

  for (const f of noteFiles) {
    const raw=await fs.readFile(f.abs,"utf8");
    let parsed; try { parsed=matter(raw); } catch { diagnostics.push(diag("error","frontmatter-invalid","Frontmatter could not be parsed.",f.rel)); parsed={data:{},content:raw}; }
    const {data,content}=parsed, filename=f.rel, fileSlug=filename.replace(/\.md$/i,"");
    let id=stringValue(data.id,"id",filename,diagnostics);
    if (id&&!ID.test(id)) { diagnostics.push(diag("error","id-invalid","id must use lowercase kebab-case.",filename)); id=undefined; }
    if (!id&&config.warnOnMissingId) diagnostics.push(diag("warning","id-missing","Add a stable id so file renames do not change the canonical URL.",filename));
    const type=stringValue(data.type,"type",filename,diagnostics), status=stringValue(data.status,"status",filename,diagnostics);
    if(type&&!config.allowedTypes.includes(type)) diagnostics.push(diag("error","type-unknown",'Unknown type "'+type+'".',filename));
    if(status&&!config.allowedStatuses.includes(status)) diagnostics.push(diag("error","status-unknown",'Unknown status "'+status+'".',filename));
    const tags=listValue(data.tags,"tags",filename,diagnostics), aliases=listValue(data.aliases,"aliases",filename,diagnostics);
    const words=strip(content).split(/\s+/).filter(Boolean).length, slug=id||fileSlug;
    entries.push({
      filename,fileSlug,slug,id,aliases:[...new Set([...(slug!==fileSlug?[fileSlug]:[]),...aliases])].filter((x)=>x!==slug),
      order:Number(filename.match(NOTE)?.[1]||0),
      title:stringValue(data.title,"title",filename,diagnostics)||firstHeading(content)||titleFromFile(filename),
      summary:stringValue(data.summary,"summary",filename,diagnostics)||summaryFrom(content),
      type,status,date:dateValue(data.date,filename,diagnostics),tags,content,text:strip(content),words,
      readingMinutes:Math.max(1,Math.ceil(words/220)),headings:headings(content),linkedSlugs:[],backlinks:[],assets:[],_targets:targets(content)
    });
    const n=entries.at(-1).order, same=orderMap.get(n)||[]; same.push(filename); orderMap.set(n,same);
  }
  entries.sort((a,b)=>a.order-b.order||a.filename.localeCompare(b.filename));
  for(const [n,names] of orderMap) if(names.length>1) diagnostics.push(diag("warning","order-duplicate","Order "+n+" is shared by "+names.join(", ")+"."));

  const routes=new Map(), filesBySlug=new Map();
  for(const e of entries) {
    if(routes.has(e.slug)) diagnostics.push(diag("error","id-duplicate",'Duplicate id/slug "'+e.slug+'".',e.filename));
    routes.set(e.slug,e); filesBySlug.set(e.fileSlug,e);
    for(const a of e.aliases) {
      if(routes.has(a)&&routes.get(a)!==e) diagnostics.push(diag("error","alias-collision",'Alias "'+a+'" collides with another note.',e.filename));
      else routes.set(a,e);
    }
  }

  const assetFiles=new Map(files.filter((f)=>f.ext!==".md").map((f)=>[f.rel,f]));
  for(const e of entries) {
    const linked=new Set(), used=new Set();
    for(const ref of e._targets) {
      const t=ref.target;
      if(!t||t.startsWith("#")||/^(mailto:|tel:)/i.test(t)) continue;
      if(/^https?:\/\//i.test(t)) { if(/^http:\/\//i.test(t)) diagnostics.push(diag("warning","remote-http","Prefer HTTPS.",e.filename)); continue; }
      if(/^[a-z][a-z0-9+.-]*:/i.test(t)) { diagnostics.push(diag("error","url-scheme-unsupported",'Unsupported URL scheme in "'+t+'".',e.filename)); continue; }
      if(noHash(t).toLowerCase().endsWith(".md")) {
        const target=path.posix.basename(posix(noHash(t))).replace(/\.md$/i,""), found=filesBySlug.get(target)||routes.get(target);
        if(!found) diagnostics.push(diag("error","link-broken",'Internal link "'+t+'" does not resolve.',e.filename)); else if(found.slug!==e.slug) linked.add(found.slug);
        continue;
      }
      const resolved=assetPath(e.filename,t), ext=resolved?path.posix.extname(resolved).toLowerCase():"";
      if(!resolved) { diagnostics.push(diag("error","asset-path-invalid",'Asset "'+t+'" escapes progress/.',e.filename)); continue; }
      if(!ref.image&&!ext) continue;
      if(!config.allowedMediaExtensions.includes(ext)) diagnostics.push(diag("warning","asset-type-unsupported",'Asset type "'+(ext||"(none)")+'" is not allowed.',e.filename));
      if(!assetFiles.has(resolved)) diagnostics.push(diag("error","asset-missing",'Asset "'+t+'" does not exist.',e.filename)); else used.add(resolved);
    }
    e.linkedSlugs=[...linked]; e.assets=[...used]; delete e._targets;
  }
  for(const e of entries) e.backlinks=entries.filter((x)=>x.linkedSlugs.includes(e.slug)).map((x)=>x.slug);

  const referenced=new Set(entries.flatMap((e)=>e.assets));
  const assets=files.filter((f)=>f.ext!==".md").map((f)=>{
    if(!config.allowedMediaExtensions.includes(f.ext)) diagnostics.push(diag("warning","asset-unapproved",'File type "'+(f.ext||"(none)")+'" is not approved.',f.rel));
    if(f.size>config.maxAssetBytes) diagnostics.push(diag("warning","asset-large","Asset exceeds the configured size threshold.",f.rel));
    if(config.allowedMediaExtensions.includes(f.ext)&&!referenced.has(f.rel)) diagnostics.push(diag("warning","asset-orphan","Asset is not referenced by any note.",f.rel));
    return {path:f.rel,extension:f.ext,size:f.size};
  });

  diagnostics.sort((a,b)=>(a.severity==="error"?0:1)-(b.severity==="error"?0:1)||(a.file||"").localeCompare(b.file||"")||a.code.localeCompare(b.code));
  const workspace={schemaVersion:1,rootDir:root,progressRoot,config,signature,entries,assets,diagnostics,stats:{
    notes:entries.length,links:entries.reduce((n,e)=>n+e.linkedSlugs.length,0),assets:assets.length,
    errors:diagnostics.filter((d)=>d.severity==="error").length,warnings:diagnostics.filter((d)=>d.severity==="warning").length
  }};
  cache.set(root,{signature,workspace}); return workspace;
}

export async function writeResearchArtifacts(options={}) {
  const root=path.resolve(options.rootDir||process.cwd()), w=await compileResearchWorkspace({...options,rootDir:root});
  const dir=path.join(root,"public","_research"); await fs.mkdir(dir,{recursive:true});
  const entries=w.entries.map(({content,text,...e})=>e);
  const search=w.entries.map((e)=>({slug:e.slug,order:e.order,title:e.title,summary:e.summary,type:e.type,status:e.status,date:e.date,tags:e.tags,headings:e.headings,text:e.text}));
  await Promise.all([
    fs.writeFile(path.join(dir,"manifest.json"),JSON.stringify({schemaVersion:1,signature:w.signature,stats:w.stats,entries,assets:w.assets,diagnostics:w.diagnostics},null,2)+"\n"),
    fs.writeFile(path.join(dir,"search.json"),JSON.stringify({schemaVersion:1,signature:w.signature,entries:search})+"\n")
  ]);
  return w;
}
