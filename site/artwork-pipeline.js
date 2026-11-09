/* Existing-app source -> private native worker -> decoded trial files.
 * No OpenAI call. Requests contain reduced source pixels and proposed labels.
 * Every result stays an unapproved engineering trial; no legacy writer fallback.
 */
(function(root){
'use strict';
const dep=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
const P=dep('StitchForgeSourceRegionProject','./source-region-project.js');
const A=dep('StitchForgeSourceObjectPlan','./source-object-plan.js');
const M=dep('StitchForgeMotifPrep','./motif-prep.js');
const L=dep('StitchForgeSourceMaskLedger','./source-mask-ledger.js');
const R=dep('StitchForgeAutoReconstruct','./auto-reconstruct.js');
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
function analysisSizes(imageWidthMm,originalWidth,originalHeight,texturePolicy='if_needed'){
 if(typeof imageWidthMm!=='number'||!Number.isFinite(imageWidthMm)||imageWidthMm<10||imageWidthMm>250||
    !Number.isInteger(originalWidth)||!Number.isInteger(originalHeight)||
    originalWidth<48||originalHeight<48||!['if_needed','off'].includes(texturePolicy))
  throw Error('Invalid physical analysis sizing');
 if(texturePolicy==='off')return [768];
 const longMm=imageWidthMm*Math.max(originalWidth,originalHeight)/originalWidth;
 return [...new Set([4,3.2,2.4,1.8].map(rate=>
  Math.min(768,Math.max(120,Math.round(longMm*rate)))))];
}
/** Treat the REQUESTED width as the visible foreground, not transparent canvas.
 * The existing source mask (not a secondary alpha-only heuristic) owns the
 * geometry. Keep source pixels, coordinates and whole-canvas proportions.
 * Explicitly reject unhoopable/small silhouettes instead of silently clipping.
 */
function visibleArtworkFrame(rgba,w,h,designWidthMm){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<48||h<48||w*h>750000||
    !rgba||rgba.length!==w*h*4||
    typeof designWidthMm!=='number'||!Number.isFinite(designWidthMm)||
    designWidthMm<10||designWidthMm>250)
  throw Error('Invalid requested visible-artwork dimensions');
 const mask=R.sourceForegroundMask(rgba,w,h);
 if(!mask||mask.length!==w*h)throw Error('Source foreground geometry unavailable');
 let x0=w,y0=h,x1=-1,y1=-1,pixels=0;
 for(let k=0;k<mask.length;k++)if(mask[k]){
  const x=k%w,y=Math.floor(k/w);
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  pixels++;
 }
 if(!pixels)throw Error('No visible foreground to size');
 const contentW=x1-x0+1,contentH=y1-y0+1;
 if(contentW<3||contentH<3)throw Error('Artwork is too narrow for a reliable physical-width measurement');
 const frameWidthMm=Number((designWidthMm*w/contentW).toFixed(6));
 if(frameWidthMm>250||frameWidthMm*h/w>296)
  throw Error('Visible design width '+designWidthMm+
   ' mm would make the complete embroidery frame larger than 250 × 296 mm; trim transparent margins or choose a smaller design width.');
 return {mode:'visible',requestedDesignWidthMm:designWidthMm,
  sourceForegroundBounds:{x:x0,y:y0,width:contentW,height:contentH},
  sourceForegroundPixels:pixels,
  imageWidthMm:frameWidthMm,
  estimatedVisibleHeightMm:Number((designWidthMm*contentH/contentW).toFixed(3)),
  estimatedVisibleWidthMm:designWidthMm,
  unmodifiedSourcePixels:true,
  physicalSewoutVerified:false};
}
async function pack(rgba,w,h,{imageWidthMm=80,originalWidth=w,originalHeight=h,texturePolicy='if_needed',maxWorkingParts=0,sizeMode='canvas',originalPngBytes=null,profile='detailed',approvedPalette=null}={}){
 if(!['if_needed','off'].includes(texturePolicy))throw Error('Invalid texture policy');
 if(!['visible','canvas'].includes(sizeMode))throw Error('Invalid physical artwork width mode');
 if(!['detailed','simple_motif','detailed_motif'].includes(profile))throw Error('Unsupported automatic digitising profile');
 if(profile!=='detailed'&&texturePolicy!=='off')
  throw Error('Automatic motif preparation must not silently simplify or drop approved source details');
 const sizing=sizeMode==='visible'?visibleArtworkFrame(rgba,w,h,imageWidthMm):
    {mode:'canvas',imageWidthMm,unmodifiedSourcePixels:true};
 const frameWidthMm=sizing.imageWidthMm;
 if(Number.isFinite(frameWidthMm)&&frameWidthMm*h/w>296)throw Error('Artwork height exceeds 296mm at this width; reduce the width before generating');
 if(!Number.isInteger(maxWorkingParts)||maxWorkingParts<0||maxWorkingParts>10000)
  throw Error('Invalid maximum working-part budget');
 let motifQuality=null;
 let draft;
 if(profile==='detailed_motif'){
  if(!Array.isArray(approvedPalette)||approvedPalette.length<1||approvedPalette.length>8||
      !approvedPalette.every((c,i)=>/^#[0-9A-F]{6}$/.test(c)&&(i===0||c>approvedPalette[i-1])))
   throw Error('Invalid approved illustration palette');
  const sha256=await P.fingerprint(rgba,w,h);
  const indexByRGB=new Map(approvedPalette.map((c,i)=>[parseInt(c.slice(1),16),i]));
  const masks=approvedPalette.map(()=>new Uint8Array(w*h));
  let foregroundPixels=0;
  for(let i=0;i<rgba.length;i+=4){
   if(!rgba[i+3])continue;
   const colour=indexByRGB.get((rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2]);
   if(rgba[i+3]!==255||colour===undefined)throw Error('Approved pixels differ from the illustration palette');
   masks[colour][i/4]=1;
   foregroundPixels++;
  }
  draft=P.validateDraft({schema:'stitch-forge-source-region-project-v1',
   source:{sha256,width:w,height:h,originalWidth,originalHeight},physical:{imageWidthMm:frameWidthMm},
   regions:masks.map((mask,i)=>({id:sha256.slice(0,12)+'-colour-'+(i+1),
     color:approvedPalette[i],ledger:L.ledgerFromMask(mask,w,h)})),foregroundPixels,
   quantisation:{pixelsBeyondRgb60:0,meanRgbDistance:0}});
 }else if(profile==='simple_motif'){
  if(!M)throw Error('Automatic simple-motif preparation unavailable');
  const motif=await M.prepare(rgba,w,h,{imageWidthMm:frameWidthMm,originalWidth,originalHeight});
  draft=motif.draft;motifQuality=motif.quality;
 }else draft=await P.createInspectionDraft(rgba,w,h,{imageWidthMm:frameWidthMm,originalWidth,originalHeight});
 let plan;
 try{plan=await A.build(draft,profile==='detailed_motif'?{maxRgbChange:0}:{});}
 catch(error){
  // A fully tracked graph can be too large to sign as a source plan even
  // when its region masks are valid. Fall back to a bounded, source-fingerprinted
  // palette partition; never truncate graph nodes or silently discard pixels.
  if(profile!=='detailed'||!draft.graph||!/Source-region project exceeds download budget/.test(error.message||''))throw error;
  draft=await P.createApproximationDraft(rgba,w,h,{imageWidthMm:frameWidthMm,originalWidth,originalHeight,
   reasonCode:'source_graph_serialisation_budget'});
  plan=await A.build(draft);
 }
 // Preserve exact foreground, original region accounting and high-contrast
 // features. Physical-scale texture grouping is only attempted when the user
 // enables simplification; neither colours nor shapes are silently dropped.
 if(texturePolicy==='if_needed'&&plan.summary.workingParts>1300){
  const reduced=await A.build(draft,{maxRgbChange:180,maxReachMm:2});
  if(reduced.summary.workingParts<plan.summary.workingParts&&
     reduced.summary.representedPixels===plan.summary.representedPixels&&
     !reduced.summary.protectedPartsRecoloured)plan=reduced;
 }
 if(maxWorkingParts&&plan.summary.workingParts>maxWorkingParts){
  const error=Error('Detailed artwork still contains '+plan.summary.workingParts+
   ' working colour components (limit '+maxWorkingParts+'); preparing at a physically appropriate resolution');
  error.code='SOURCE_DETAIL_BUDGET';error.workingParts=plan.summary.workingParts;
  throw error;
 }
 const labels=new Uint8Array(w*h),palette=plan.regions.map(r=>r.color);
 for(const [i,r] of plan.regions.entries())for(const c of r.ledger.components)for(const [y,x0,x1] of c.runs)labels.fill(i+1,y*w+x0,y*w+x1);
 const {sha256,width,height}=plan.source;
 if(originalPngBytes!==null&&(!(originalPngBytes instanceof Uint8Array)||
    originalPngBytes.length<100||originalPngBytes.length>2450000||
    ![137,80,78,71,13,10,26,10].every((n,i)=>originalPngBytes[i]===n)))
  throw Error('Original PNG must fit inside the bounded private source budget (2.45MB)');
 const fullSource=originalPngBytes?{sha256:await digest(originalPngBytes),bytes:originalPngBytes.length}:null;
 const header=JSON.stringify({schema:fullSource?'stitch-forge-artwork-request-v2':SCHEMA,
   source:{sha256,width,height,originalWidth,originalHeight},imageWidthMm:frameWidthMm,palette,
  foregroundPixels:plan.summary.sourcePixels,preparationSignature:plan.sourcePlanSignature,texturePolicy,...(fullSource?{originalPng:fullSource}:{})});
 const requestId=await digest(new TextEncoder().encode(header),new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.byteLength),labels);
 const rgbaGzip=b64(await transform(rgba,'gzip',true,3100000)),labelsGzip=b64(await transform(labels,'gzip',true,800000));
 const packet={header,rgbaGzip,labelsGzip,requestId,
   ...(fullSource?{originalPngBase64:b64(originalPngBytes)}:{})};
 if(new TextEncoder().encode(JSON.stringify(packet)).length>3900000)
  throw Error('Full-resolution PNG exceeds the current private submission budget; source data was not truncated');
 return {packet,draft,plan,sizing,profile,motifQuality};
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
async function backgroundJobError(response,message){
 let detail;try{detail=await response.json();}catch{}
 const error=Error(detail?.error||message+' (HTTP '+response.status+')');
 if(response.status===401)error.code='OWNER_TOKEN_REJECTED';
 if(response.status===503&&['OWNER_ACCESS_UNAVAILABLE','ARTWORK_TRIAL_DISABLED'].includes(detail?.code))error.code=detail.code;
 return error;
}
async function backgroundGenerate(packed,{token,signal,onProgress=()=>{},onAccepted=()=>{},
 fetchImpl=root.fetch.bind(root),isCurrent=()=>true}={}){
 if(!token||token.length>512)throw Error('Enter your private access token');
 const headers={'Content-Type':'application/json','Authorization':'Bearer '+token};
 if(!isCurrent())throw Error('Source changed before submission');
 const satinPlanSha=packed.finishPlanSha256;
 const job=packed.profile==='detailed_motif'?{...packed.packet,profile:'detailed_motif',
  ...(satinPlanSha?{finish:'black_satin_v1'}:{})}:packed.packet;
 const body=JSON.stringify(job);
 if(new TextEncoder().encode(body).length>4000000)throw Error('Artwork job exceeds the private submission limit');
 onProgress('Submitting private embroidery job…');
 const submit=await fetchImpl('/api/artwork-job-submit',{method:'POST',headers,body,signal,cache:'no-store'});
 if(submit.status!==202)throw await backgroundJobError(submit,'Background embroidery submission failed');
 const {jobId}=await submit.json();
 if(typeof jobId!=='string'||!(/^[a-f0-9-]{36}$/i).test(jobId))throw Error('Invalid background job reference');
 if(!isCurrent()||signal?.aborted)throw Error('Artwork changed or processing cancelled');
 onAccepted();
 let state=null;
 const started=Date.now(),maxWait=16*60*1000;
 for(;;){
  if(!isCurrent()||signal?.aborted)throw Error('Artwork changed or processing cancelled');
  if(Date.now()-started>maxWait)throw Error('Background embroidery exceeded the waiting limit; do not automatically charge for another analysis');
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},3000);
   function stop(){clearTimeout(timer);reject(Error('Background wait cancelled'));}
   if(signal?.aborted)stop();else signal?.addEventListener('abort',stop,{once:true});
  });
  const check=await fetchImpl('/api/artwork-job-status?id='+encodeURIComponent(jobId),
   {headers:{Authorization:'Bearer '+token},signal,cache:'no-store'});
  if(!check.ok)throw await backgroundJobError(check,'Background artwork status unavailable');
  state=await check.json();
  if(state.state==='failed')throw Error(state.error||'Native embroidery failed');
  if(state.state==='done')break;
  if(!['queued','running'].includes(state.state))throw Error('Invalid private job state');
  onProgress(state.state==='queued'?'Waiting for the private embroidery worker…':
   satinPlanSha?'Generating fills, adding black satin and checking PES/DST…':'Generating and auditing actual machine stitches…');
 }
 if(!isCurrent()||signal?.aborted)throw Error('Artwork changed before native result');
 onProgress('Downloading and independently verifying PES/DST…');
 const result=await fetchImpl('/api/artwork-job-result?id='+encodeURIComponent(jobId),
  {headers:{Authorization:'Bearer '+token},signal,cache:'no-store'});
 if(!result.ok)throw await backgroundJobError(result,'Background native result unavailable');
 if(result.headers.get('x-stitch-forge-audit')!==AUDIT||
    !result.headers.get('content-type')?.startsWith('application/zip'))throw Error('Independent native audit missing');
 const bytes=new Uint8Array(await result.arrayBuffer());
 if(await digest(bytes)!==result.headers.get('x-stitch-forge-sha256'))throw Error('Native ZIP checksum failed');
 const files=await readArchive(bytes),receipt=state.receipt;
 const report=JSON.parse(new TextDecoder().decode(files['machine-report.json']));
 const finish=report.satinFinish;
 const svgSha=await digest(files['native-artwork-input.svg']);
 const pesSha=await digest(files['artwork-trial.pes']);
 if(!receipt||receipt.requestId!==packed.packet.requestId||
    !/^[0-9a-f]{64}$/.test(receipt.svgSha256||'')||
    !/^[0-9a-f]{64}$/.test(receipt.pesSha256||'')||
    (satinPlanSha?(finish?.type!=='black_satin_v1'||finish.colour!=='#000000'||
     finish.planSha256!==satinPlanSha||finish.basePesSha256!==receipt.pesSha256||
     finish.baseSvgSha256!==receipt.svgSha256||!Number.isInteger(finish.needleStitches)||finish.needleStitches<3):
     (finish!==undefined||pesSha!==receipt.pesSha256||svgSha!==receipt.svgSha256)))
  throw Error('The machine files do not match the approved geometry and finish.');
 const preview=previewPacket(JSON.parse(new TextDecoder().decode(files['decoded-preview.json'])));
 const validCount=(n,limit=125000)=>Number.isInteger(n)&&n>=0&&n<=limit;
 if(report.requestId!==packed.packet.requestId||report.source?.sha256!==packed.draft.source.sha256||
    report.source?.width!==packed.draft.source.width||report.source?.height!==packed.draft.source.height||
    report.imageWidthMm!==packed.draft.physical.imageWidthMm||report.machineEligible!==false||
    report.physicalQualityVerified!==false||report.sourceBinding?.foregroundIndependentlyVerified!==true||
    report.workflow!==(satinPlanSha?'TWO_NATIVE_PHASES_WITH_SATIN_FINISH':'TWO_NATIVE_PHASES_NO_AI')||
    report.nativeInputSha256!==svgSha||
    preview.requestId!==packed.packet.requestId||
    Math.abs(preview.widthMm-report.imageWidthMm-4)>1e-6||
    Math.abs(preview.heightMm-packed.draft.physical.imageHeightMm-4)>1e-6||
    !Array.isArray(report.blockers)||report.blockers.length>30||
    !report.blockers.every(v=>/^[a-z_]{1,100}$/.test(v))||
    !validCount(report.unresolvedObjects)||!validCount(report.unresolvedPixels,750000)||
    !Array.isArray(report.decoded)||report.decoded.length!==2||
    new Set(report.decoded.map(v=>v.format)).size!==2||
    !report.decoded.every(v=>['pes','dst'].includes(v.format)&&validCount(v.needleStitches)&&
      v.needleStitches>=3&&validCount(v.colourChanges)&&v.colourChanges<12&&validCount(v.jumps)&&validCount(v.trims))||
    report.decoded.some(v=>v.needlePointsOutsideWorkingColour!==0||v.needleSegmentsOutsideWorkingColour!==0)||
    report.decoded[0].needleStitches!==report.decoded[1].needleStitches)
   throw Error('Background native report failed independent source, geometry or machine checks');
 if(!isCurrent()||signal?.aborted)throw Error('Artwork changed before native result acceptance');
 return {bytes,report,preview,geometry:files['native-artwork-input.svg'],sourceDraft:packed.draft};
}
async function generate(packed,{token,signal,onProgress=()=>{},onAccepted,fetchImpl=root.fetch.bind(root),isCurrent=()=>true,background=false}={}){
 if(background)return backgroundGenerate(packed,{token,signal,onProgress,onAccepted,fetchImpl,isCurrent});
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
const api=Object.freeze({pack,visibleArtworkFrame,analysisSizes,generate,readArchive,previewPacket,digest,AUDIT});root.StitchForgeArtworkPipeline=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
