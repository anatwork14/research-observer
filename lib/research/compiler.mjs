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
    return {config:{...defaults,...JSON.parse(raw)},raw};
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
    out.push({abs,rel,size:s.size,mtime:Math.trunc(s.mtimeMs),ext:path.extname(item.name).toLowerCase()});
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
  const progressRoot=path.resolve(root,config.progressDir||"progress");
  const files=await walk(progressRoot,progressRoot,diagnostics);
  const signature=crypto.createHash("sha256").update(configRaw).update(JSON.stringify(files.map((f)=>[f.rel,f.size,f.mtime]))).digest("hex");
  const hit=cache.get(root);
  if (!fresh && hit?.signature===signature) return hit.workspace;

  const noteFiles=files.filter((f)=>!f.rel.includes("/")&&f.ext===".md"&&NOTE.test(f.rel));
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
      order"çG—RÂ'G—R"Æf–ÆVæÖRÆF–væ÷7F–72’Â7FGW3×7G&–æufÇVR†FFç7FGW2Â'7FGW2"Æf–ÆVæÖRÆF–væ÷7F–72“°¢–b‡G—Rbb6öæf–ræÆÆ÷vVEG—W2æ–æ6ÇVFW2‡G—R’’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â'G—R×Væ¶æ÷vâ"ÂuVæ¶æ÷vâG—R"r·G—R²r"ârÆf–ÆVæÖR’“°¢–b‡7FGW2bb6öæf–ræÆÆ÷vVE7FGW6W2æ–æ6ÇVFW2‡7FGW2’’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â'7FGW2×Væ¶æ÷vâ"ÂuVæ¶æ÷vâ7FGW2"r·7FGW2²r"ârÆf–ÆVæÖR’“°¢6öç7BFw3ÖÆ—7EfÇVR†FFçFw2Â'Fw2"Æf–ÆVæÖRÆF–væ÷7F–72’ÂÆ–6W3ÖÆ—7EfÇVR†FFæÆ–6W2Â&Æ–6W2"Æf–ÆVæÖRÆF–væ÷7F–72“°¢6öç7Bv÷&G3×7G&—†6öçFVçB’ç7Æ—B‚õÇ2²ò’æf–ÇFW"„&ööÆVâ’æÆVæwF‚Â6ÇVsÖ–GÇÆf–ÆU6ÇVs°¢VçG&–W2çW6‚‡°¢f–ÆVæÖRÆf–ÆU6ÇVrÇ6ÇVrÆ–BÆÆ–6W3¥²ââææWr6WB…²âââ‡6ÇVrÓÖf–ÆU6ÇVsõ¶f–ÆU6ÇVuÓ¥µÒ’ÂââæÆ–6W5Ò•Òæf–ÇFW"‚‡‚“Óç‚Ó×6ÇVr’À¢÷&FW#¤çVÖ&W"†f–ÆVæÖRæÖF6‚„äõDR“òå³×ÇÃ’À¢F—FÆS§7G&–æufÇVR†FFçF—FÆRÂ'F—FÆR"Æf–ÆVæÖRÆF–væ÷7F–72—ÇÆf—'7D†VF–ær†6öçFVçB—ÇÇF—FÆTg&öÔf–ÆR†f–ÆVæÖR’À¢7VÖÖ'“§7G&–æufÇVR†FFç7VÖÖ'’Â'7VÖÖ'’"Æf–ÆVæÖRÆF–væ÷7F–72—ÇÇ7VÖÖ'”g&öÒ†6öçFVçB’À¢G—RÇ7FGW2ÆFFS¦FFUfÇVR†FFæFFRÆf–ÆVæÖRÆF–væ÷7F–72’ÇFw2Æ6öçFVçBÇFW‡C§7G&—†6öçFVçB’Çv÷&G2À¢&VF–ætÖ–çWFW3¤ÖF‚æÖ‚ƒÄÖF‚æ6V–Â‡v÷&G2ó##’’Æ†VF–æw3¦†VF–æw2†6öçFVçB’ÆÆ–æ¶VE6ÇVw3¥µÒÆ&6¶Æ–æ·3¥µÒÆ76WG3¥µÒÅ÷F&vWG3§F&vWG2†6öçFVçB¢Ò“°¢6öç7BãÖVçG&–W2æB‚Ó’æ÷&FW"Â6ÖSÖ÷&FW$ÖævWB†â—ÇÅµÓ²6ÖRçW6‚†f–ÆVæÖR“²÷&FW$Öç6WB†âÇ6ÖR“°¢Ð¢VçG&–W2ç6÷'B‚†Æ"“Óææ÷&FW"Ö"æ÷&FW'ÇÆæf–ÆVæÖRæÆö6ÆT6ö×&R†"æf–ÆVæÖR’“°¢f÷"†6öç7B¶âÆæÖW5Òöb÷&FW$Ö’–b†æÖW2æÆVæwFƒã’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â&÷&FW"ÖGWÆ–6FR"Â$÷&FW""¶â²"—26†&VB'’"¶æÖW2æ¦ö–â‚"Â"’²"â"’“° ¢6öç7B&÷WFW3ÖæWrÖ‚’Âf–ÆW4'•6ÇVsÖæWrÖ‚“°¢f÷"†6öç7BRöbVçG&–W2’°¢–b‡&÷WFW2æ†2†Rç6ÇVr’’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â&–BÖGWÆ–6FR"ÂtGWÆ–6FR–B÷6ÇVr"r¶Rç6ÇVr²r"ârÆRæf–ÆVæÖR’“°¢&÷WFW2ç6WB†Rç6ÇVrÆR“²f–ÆW4'•6ÇVrç6WB†Ræf–ÆU6ÇVrÆR“°¢f÷"†6öç7BöbRæÆ–6W2’°¢–b‡&÷WFW2æ†2†’bg&÷WFW2ævWB†’ÓÖR’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â&Æ–2Ö6öÆÆ—6–öâ"ÂtÆ–2"r¶²r"6öÆÆ–FW2v—F‚æ÷F†W"æ÷FRârÆRæf–ÆVæÖR’“°¢VÇ6R&÷WFW2ç6WB†ÆR“°¢Ð¢Ð ¢6öç7B76WDf–ÆW3ÖæWrÖ†f–ÆW2æf–ÇFW"‚†b“ÓæbæW‡BÓÒ"æÖB"’æÖ‚†b“Óå¶bç&VÂÆeÒ’“°¢f÷"†6öç7BRöbVçG&–W2’°¢6öç7BÆ–æ¶VCÖæWr6WB‚’ÂW6VCÖæWr6WB‚“°¢f÷"†6öç7B&VböbRå÷F&vWG2’°¢6öç7BC×&VbçF&vWC°¢–b‚GÇÇBç7F'G5v—F‚‚"2"—ÇÂõâ†Ö–ÇFó§ÇFVÃ¢’ö’çFW7B‡B’’6öçF–çVS°¢–b‚õæ‡GG3ó¥ÂõÂòö’çFW7B‡B’’²–b‚õæ‡GG¥ÂõÂòö’çFW7B‡B’’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â'&VÖ÷FRÖ‡GG"Â%&VfW"…EE2â"ÆRæf–ÆVæÖR’“²6öçF–çVS²Ð¢–b‚õå¶×¥Õ¶×£Ó’²âÕÒ£¢ö’çFW7B‡B’’²F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â'W&Â×66†VÖR×Vç7W÷'FVB"ÂuVç7W÷'FVBU$Â66†VÖR–â"r·B²r"ârÆRæf–ÆVæÖR’“²6öçF–çVS²Ð¢–b†æô†6‚‡B’çFôÆ÷vW$66R‚’æVæG5v—F‚‚"æÖB"’’°¢6öç7BF&vWC×F‚ç÷6—‚æ&6VæÖR‡÷6—‚†æô†6‚‡B’’’ç&WÆ6R‚õÂæÖBBö’Â""’Âf÷VæCÖf–ÆW4'•6ÇVrævWB‡F&vWB—ÇÇ&÷WFW2ævWB‡F&vWB“°¢–b‚f÷VæB’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â&Æ–æ²Ö'&ö¶Vâ"Ât–çFW&æÂÆ–æ²"r·B²r"FöW2æ÷B&W6öÇfRârÆRæf–ÆVæÖR’“²VÇ6R–b†f÷VæBç6ÇVrÓÖRç6ÇVr’Æ–æ¶VBæFB†f÷VæBç6ÇVr“°¢6öçF–çVS°¢Ð¢6öç7B&W6öÇfVCÖ76WEF‚†Ræf–ÆVæÖRÇB’ÂW‡C×&W6öÇfVC÷F‚ç÷6—‚æW‡FæÖR‡&W6öÇfVB’çFôÆ÷vW$66R‚“¢"#°¢–b‚&W6öÇfVB’²F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â&76WB×F‚Ö–çfÆ–B"Ât76WB"r·B²r"W66W2&öw&W72òârÆRæf–ÆVæÖR’“²6öçF–çVS²Ð¢–b‚&Vbæ–ÖvRbbW‡B’6öçF–çVS°¢–b‚6öæf–ræÆÆ÷vVDÖVF–W‡FVç6–öç2æ–æ6ÇVFW2†W‡B’’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â&76WB×G—R×Vç7W÷'FVB"Ât76WBG—R"r²†W‡GÇÂ"†æöæR’"’²r"—2æ÷BÆÆ÷vVBârÆRæf–ÆVæÖR’“°¢–b‚76WDf–ÆW2æ†2‡&W6öÇfVB’’F–væ÷7F–72çW6‚†F–r‚&W'&÷""Â&76WBÖÖ—76–ær"Ât76WB"r·B²r"FöW2æ÷BW†—7BârÆRæf–ÆVæÖR’“²VÇ6RW6VBæFB‡&W6öÇfVB“°¢Ð¢RæÆ–æ¶VE6ÇVw3Õ²ââæÆ–æ¶VEÓ²Ræ76WG3Õ²ââçW6VEÓ²FVÆWFRRå÷F&vWG3°¢Ð¢f÷"†6öç7BRöbVçG&–W2’Ræ&6¶Æ–æ·3ÖVçG&–W2æf–ÇFW"‚‡‚“Óç‚æÆ–æ¶VE6ÇVw2æ–æ6ÇVFW2†Rç6ÇVr’’æÖ‚‡‚“Óç‚ç6ÇVr“° ¢6öç7B&VfW&Væ6VCÖæWr6WB†VçG&–W2æfÆDÖ‚†R“ÓæRæ76WG2’“°¢6öç7B76WG3Öf–ÆW2æf–ÇFW"‚†b“ÓæbæW‡BÓÒ"æÖB"’æÖ‚†b“Óç°¢–b‚6öæf–ræÆÆ÷vVDÖVF–W‡FVç6–öç2æ–æ6ÇVFW2†bæW‡B’’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â&76WB×Væ&÷fVB"Âtf–ÆRG—R"r²†bæW‡GÇÂ"†æöæR’"’²r"—2æ÷B&÷fVBârÆbç&VÂ’“°¢–b†bç6—¦Sæ6öæf–ræÖ„76WD'—FW2’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â&76WBÖÆ&vR"Â$76WBW†6VVG2F†R6öæf–wW&VB6—¦RF‡&W6†öÆBâ"Æbç&VÂ’“°¢–b†6öæf–ræÆÆ÷vVDÖVF–W‡FVç6–öç2æ–æ6ÇVFW2†bæW‡B’bb&VfW&Væ6VBæ†2†bç&VÂ’’F–væ÷7F–72çW6‚†F–r‚'v&æ–ær"Â&76WBÖ÷'†â"Â$76WB—2æ÷B&VfW&Væ6VB'’ç’æ÷FRâ"Æbç&VÂ’“°¢&WGW&â·Fƒ¦bç&VÂÆW‡FVç6–öã¦bæW‡BÇ6—¦S¦bç6—¦WÓ°¢Ò“° ¢F–væ÷7F–72ç6÷'B‚†Æ"“Óâ†ç6WfW&—G“ÓÓÒ&W'&÷"#ó£’Ò†"ç6WfW&—G“ÓÓÒ&W'&÷"#ó£—ÇÂ†æf–ÆWÇÂ""’æÆö6ÆT6ö×&R†"æf–ÆWÇÂ""—ÇÆæ6öFRæÆö6ÆT6ö×&R†"æ6öFR’“°¢6öç7Bv÷&·76S×·66†VÖfW'6–öã£Ç&ö÷DF—#§&ö÷BÇ&öw&W75&ö÷BÆ6öæf–rÇ6–væGW&RÆVçG&–W2Æ76WG2ÆF–væ÷7F–72Ç7FG3§°¢æ÷FW3¦VçG&–W2æÆVæwF‚ÆÆ–æ·3¦VçG&–W2ç&VGV6R‚†âÆR“Óæâ¶RæÆ–æ¶VE6ÇVw2æÆVæwF‚Ã’Æ76WG3¦76WG2æÆVæwF‚À¢W'&÷'3¦F–væ÷7F–72æf–ÇFW"‚†B“ÓæBç6WfW&—G“ÓÓÒ&W'&÷""’æÆVæwF‚Çv&æ–æw3¦F–væ÷7F–72æf–ÇFW"‚†B“ÓæBç6WfW&—G“ÓÓÒ'v&æ–ær"’æÆVæwF€¢×Ó°¢66†Rç6WB‡&ö÷BÇ·6–væGW&RÇv÷&·76WÒ“²&WGW&âv÷&·76S°§Ð ¦W‡÷'B7–æ2gVæ7F–öâw&—FU&W6V&6„'F–f7G2†÷F–öç3×·Ò’°¢6öç7B&ö÷C×F‚ç&W6öÇfR†÷F–öç2ç&ö÷DF—'ÇÇ&ö6W72æ7vB‚’’ÂsÖv—B6ö×–ÆU&W6V&6…v÷&·76R‡²ââæ÷F–öç2Ç&ö÷DF—#§&ö÷GÒ“°¢6öç7BF—#×F‚æ¦ö–â‡&ö÷BÂ'V&Æ–2"Â%÷&W6V&6‚"“²v—Bg2æÖ¶F—"†F—"Ç·&V7W'6—fS§G'VWÒ“°¢6öç7BVçG&–W3×ræVçG&–W2æÖ‚‡¶6öçFVçBÇFW‡BÂââæWÒ“ÓæR“°¢6öç7B6V&6ƒ×ræVçG&–W2æÖ‚†R“Óâ‡·6ÇVs¦Rç6ÇVrÆ÷&FW#¦Ræ÷&FW"ÇF—FÆS¦RçF—FÆRÇ7VÖÖ'“¦Rç7VÖÖ'’ÇG—S¦RçG—RÇ7FGW3¦Rç7FGW2ÆFFS¦RæFFRÇFw3¦RçFw2Æ†VF–æw3¦Ræ†VF–æw2ÇFW‡C¦RçFW‡GÒ’“°¢v—B&öÖ—6RæÆÂ…°¢g2çw&—FTf–ÆR‡F‚æ¦ö–â†F—"Â&Öæ–fW7Bæ§6öâ"’Ä¥4ôâç7G&–æv–g’‡·66†VÖfW'6–öã£Ç6–væGW&S§rç6–væGW&RÇ7FG3§rç7FG2ÆVçG&–W2Æ76WG3§ræ76WG2ÆF–væ÷7F–73§ræF–væ÷7F–77ÒÆçVÆÂÃ"’²%Æâ"’À¢g2çw&—FTf–ÆR‡F‚æ¦ö–â†F—"Â'6V&6‚æ§6öâ"’Ä¥4ôâç7G&–æv–g’‡·66†VÖfW'6–öã£Ç6–væGW&S§rç6–væGW&RÆVçG&–W3§6V&6‡Ò’²%Æâ"¢Ò“°¢&WGW&âs°§Ð