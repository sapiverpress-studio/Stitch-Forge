/* Existing-app source -> private native worker -> decoded trial files.
 * No OpenAI call. Requests contain reduced source pixels and proposed labels.
 * Every result stays an unapproved engineering trial; no legacy writer fallback.
 */
(function(root){
'use strict';
const dep=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const P=dep('StitchForgeSourceRegionProject','./source-region-project.js');
const A=dep('StitchForgeSourceObjectPlan','./source-object-plan.js');
const SCHEMA='stitch-forge-artwork-request-v1',AUDIT='SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED';
const cryptoAPI=()=>root.crypto||(typeof require==='function'?require('node:crypto').webcrypto:null);
async function digest(...parts){const size=parts.reduce((n,p)=>n+p.length,0),bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}return [...new Uint8Array(await cryptoAPI().subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
function unb64(text,max){if(typeof text!=='string'||text.length>Math.ceil(max/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw Error('Invalid encoded file');return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
async function transform(bytes,format,compress,max){
 if(typeof window==='undefined'&&typeof require==='function'){
  const z=require('node:zlib'),out=compress?z.gzipSync(bytes):format==='deflate-raw'?z.inflateRawSync(bytes,{maxOutputLength:max}):z.gunzipSync(bytes,{maxOutputLength:max});
  if(out.length>max)throw Error('Compressed artwork or archive exceeds its budget');return new Uint8Array(out);
 }
 const Stream=compress?CompressionStream:DecompressionStream;
 const reader=new Blob([bytes]).stream().pipeThrough(new Stream(format)).getReader(),chunks=[];let count=0;
 for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>max){await reader.cancel();throw Error('Compressed artwork or archive exceeds its budget');}chunks.push(value);}
 const out=new Uint8Array(count);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;
}
async function pack(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h,texturePolicy='if_needed'}={}){
 if(!['if_needed','off'].includes(texturePolicy))throw Error('Invalid texture policy');
 if(Number.isFinite(imageWidthMm)&&imageWidthMm*h/w>296)throw Error('Artwork height exceeds 296mm at this width; reduce the width before generating');
 const draft=await P.createInspectionDraft(rgba,w,h,{imageWidthMm,originalWidth,originalHeight}),plan=await A.build(draft);
 const labels=new Uint8Array(w*h),palette=plan.regions.map(r=>r.color);
 for(const [i,r] of plan.regions.entries())for(const c of r.ledger.components)for(const [y,x0,x1] of c.runs)labels.fill(i+1,y*w+x0,y*w+x1);
 const {sha256,width,height}=plan.source;
 const header=JSON.stringify({schema:SCHEMA,source:{sha256,width,height,originalWidth,originalHeight},imageWidthMm,palette,
  foregroundPixels:plan.summary.sourcePixels,preparationSignature:plan.sourcePlanSignature,texturePolicy});
 const requestId=await digest(new TextEncoder().encode(header),new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),labels);
 const rgbaGzip=b64(await transform(rgba,'gzip',true,3100000)),labelsGzip=b64(await transform(labels,'gzip',true,800000));
 return {packet:{header,rgbaGzip,labelsGzip,requestId},draft,plan};
}
function crc32(bytes){let value=-1;for(const b of bytes){value^=b;for(let j=0;j<8;j++)value=(value>>>1)^(value&1?0xedb88320:0);}return (value^-1)>>>0;}
async function readArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<100||bytes.length>3000000)throw Error('Invalid native archive size');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0||view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==view.getUint16(end+10,true)||end+22+view.getUint16(end+20,true)!==bytes.length)throw Error('Broken or multi-volume native archive');
 const count=view.getUint16(end+10,true),centralSize=view.getUint32(end+12,true);let at=view.getUint32(end+16,true),total=0;
 if(count<4||count>12||at+centralSize!==end)throw Error('Native archive directory budget failed');
 const files={};
 for(let n=0;n<count;n++){
  if(at+46>end||view.getUint32(at,true)!==0x02014b50)throw Error('Broken native archive directory');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),packed=view.getUint32(at+20,true),size=view.getUint32(at+24,true),nl=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),offset=view.getUint32(at+42,true);
  if(flags&1||![0,8].includes(method)||(total+=size)>20000000||at+46+nl+extra+comment>end)throw Error('Native archive exceeds extraction budget');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(at+46,at+46+nl));
  if(!/^[a-zA-Z0-9._-]{1,100}$/.test(name)||name in files||offset+30>view.getUint32(end+16,true)||view.getUint32(offset,true)!==0x04034b50||view.getUint16(offset+8,true)!==method)throw Error('Unsafe native archive entry');
  const localNameLength=view.getUint16(offset+26,true),localExtra=view.getUint16(offset+28,true),start=offset+30+localNameLength+localExtra;
  if(new TextDecoder().decode(bytes.subarray(offset+30,offset+30+localNameLength))!==name||start+packed>view.getUint32(end+16,true))throw Error('Native archive entry overlaps directory');
  const encoded=bytes.subarray(start,start+packed),raw=method===0?encoded.slice():await transform(encoded,'deflate-raw',false,size);
  if(raw.length!==size||crc32(raw)!==crc)throw Error('Native archive checksum failed');files[name]=raw;at+=46+nl+extra+comment;
 }
 if(at!==end||!files['machine-report.json']||!files['decoded-preview.json']||!files['artwork-trial.pes']||!files['artwork-trial.dst'])throw Error('Native archive is incomplete');
 if(new TextDecoder().decode(files['artwork-trial.pes'].subarray(0,8))!=='#PES0060'||files['artwork-trial.dst'].length<515)throw Error('Native machine files are incomplete');
 return files;
}
function previewPacket(p){
 if(p?.schema!=='stitch-forge-decoded-preview-v1'||!Number.isFinite(p.widthMm)||!Number.isFinite(p.heightMm)||p.widthMm<10||p.widthMm>254||p.heightMm<4||p.heightMm>300||!Array.isArray(p.palette)||!p.palette.length||p.palette.length>12||!p.palette.every(c=>/^#[0-9A-F]{6}$/.test(c))||!Array.isArray(p.segments)||p.segments.length>125000)throw Error('Invalid decoded stitch preview');
 for(const line of p.segments)if(!Array.isArray(line)||line.length!==5||!line.slice(0,4).every(Number.isFinite)||line[0]<0||line[2]<0||line[1]<0||line[3]<0||line[0]>p.widthMm||line[2]>p.widthMm||line[1]>p.heightMm||line[3]>p.heightMm||!Number.isInteger(line[4])||line[4]<0||line[4]>=p.palette.length)throw Error('Decoded stitch preview leaves its physical bounds');
 return p;
}
async function generate(packed,{token,signal,onProgress=()=>{},fetchImpl=root.fetch.bind(root),isCurrent=()=>true}={}){
 if(!token||token.length>512)throw Error('Enter your private access token');
 const {packet}=packed;
 let repairReceipt=null;
 async function post(phase,extra={}){
  if(!isCurrent())throw Error('Source or size changed; stale native result discarded');
  const body=JSON.stringify({...packet,phase,...(repairReceipt?{repairReceipt}:{}),...extra});if(new TextEncoder().encode(body).length>4000000)throw Error('Artwork request exceeds the private worker budget');
  const response=await fetchImpl('/api/artwork-embroidery',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body,signal,cache:'no-store'});
  if(!response.ok){let detail;try{detail=await response.json();}catch{}throw Error(detail?.error||'Native artwork worker unavailable (HTTP '+response.status+')');}
  return response;
 }
 for(let attempt=0;attempt<2;attempt++){
 onProgress((attempt?'Regenerating affected source details. ':'')+'Generating native PES6 · phase 1 of 2…');
 const first=await (await post('pes')).json();
 if(first.requestId!==packet.requestId||first.receipt?.requestId!==packet.requestId||typeof first.receipt?.mac!=='string')throw Error('Native phase belongs to different artwork');
 const pes=unb64(first.pesBase64,1500000);
 if(await digest(pes)!==first.receipt.pesSha256||new TextDecoder().decode(pes.subarray(0,8))!=='#PES0060')throw Error('Native PES6 phase checksum failed');
 onProgress('Generating DST and independently checking the actual stitches · phase 2 of 2…');
 const response=await post('dst',{pesBase64:first.pesBase64,receipt:first.receipt});
 if(response.status===202){
  const repair=await response.json();
  if(attempt||repair.status!=='BOUNDED_NATIVE_REPAIR_REQUIRED'||repair.requestId!==packet.requestId||repair.repairReceipt?.requestId!==packet.requestId||!Array.isArray(repair.repairReceipt?.objectIds)||!repair.repairReceipt.objectIds.length||repair.repairReceipt.objectIds.length>12||!/^[a-f0-9]{64}$/.test(repair.repairReceipt?.mac||''))throw Error('Native source repair exceeded its one-pass bound');
  repairReceipt=repair.repairReceipt;onProgress('Native audit found a small unsafe fill. Regenerating affected source details once, then checking again…');continue;
 }
 if(response.headers.get('x-stitch-forge-audit')!==AUDIT||!response.headers.get('content-type')?.startsWith('application/zip'))throw Error('Native worker returned no source-contained trial audit');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(await digest(bytes)!==response.headers.get('x-stitch-forge-sha256'))throw Error('Native result checksum failed');
 const files=await readArchive(bytes),report=JSON.parse(new TextDecoder().decode(files['machine-report.json'])),preview=previewPacket(JSON.parse(new TextDecoder().decode(files['decoded-preview.json'])));
 if(!files['native-artwork-input.svg']||files['native-artwork-input.svg'].length>2000000||await digest(files['native-artwork-input.svg'])!==first.receipt.svgSha256||report.nativeInputSha256!==first.receipt.svgSha256)throw Error('Editable native input failed its phase/source binding');
 const validCount=(n,limit=125000)=>Number.isInteger(n)&&n>=0&&n<=limit;
 if(report.requestId!==packet.requestId||report.source?.sha256!==packed.draft.source.sha256||report.source?.width!==packed.draft.source.width||report.source?.height!==packed.draft.source.height||report.imageWidthMm!==packed.draft.physical.imageWidthMm||report.machineEligible!==false||report.physicalQualityVerified!==false||report.sourceBinding?.foregroundIndependentlyVerified!==true||report.workflow!=='TWO_NATIVE_PHASES_NO_AI'||preview.requestId!==packet.requestId||Math.abs(preview.widthMm-report.imageWidthMm-4)>1e-6||Math.abs(preview.heightMm-packed.draft.physical.imageHeightMm-4)>1e-6||!Array.isArray(report.blockers)||report.blockers.length>30||!report.blockers.every(s=>/^[a-z_]{1,100}$/.test(s))||!validCount(report.unresolvedObjects)||!validCount(report.unresolvedPixels,750000)||!Array.isArray(report.decoded)||report.decoded.length!==2||new Set(report.decoded.map(r=>r.format)).size!==2||!report.decoded.every(r=>['pes','dst'].includes(r.format)&&validCount(r.needleStitches)&&r.needleStitches>=3&&validCount(r.colourChanges)&&r.colourChanges<12&&validCount(r.jumps)&&validCount(r.trims))||report.decoded.some(r=>r.needlePointsOutsideWorkingColour!==0||r.needleSegmentsOutsideWorkingColour!==0)||report.decoded[0].needleStitches!==report.decoded[1].needleStitches)throw Error('Native report failed source binding, physical-size or containment checks');
 if(!isCurrent())throw Error('Source or size changed; stale native result discarded');
 return {bytes,report,preview,geometry:files['native-artwork-input.svg'],sourceDraft:packed.draft};
 }
 throw Error('Native source repair did not complete');
}
const api=Object.freeze({pack,generate,readArchive,previewPacket,digest,AUDIT});root.StitchForgeArtworkPipeline=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
