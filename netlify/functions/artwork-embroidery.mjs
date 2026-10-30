/* Protected, stateless two-phase artwork bridge. Off until explicitly enabled.
 * Reduced original pixels are sent only to the owner's configured native worker.
 * No OpenAI call, background task, public storage or legacy-writer fallback.
 */
import {timingSafeEqual,createHash} from 'node:crypto';
import {acquireCloudRunIdToken,cloudRunAudience} from './lib/cloud-run-auth.mjs';
const AUDIT='SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED';
const HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status,error)=>new Response(JSON.stringify({error}),{status,headers:{...HEADERS,'Content-Type':'application/json'}});
const envValue=k=>globalThis.Netlify?.env?.get(k)??process.env[k];
function authorised(header,secret){if(!secret||!header?.startsWith('Bearer '))return false;const a=Buffer.from(header.slice(7)),b=Buffer.from(secret);return a.length===b.length&&timingSafeEqual(a,b);}
export async function boundedBytes(stream,maximum){
 if(!stream)throw Error('Missing body');const reader=stream.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maximum){await reader.cancel();throw Error('Body exceeds limit');}chunks.push(value);}
 return Buffer.concat(chunks,size);
}
export function createArtworkBridge({getEnv=envValue,fetchImpl=(...args)=>fetch(...args)}={}){
 return async function artworkEmbroidery(request){
  if(request.method!=='POST')return json(405,'POST only');
  if(!authorised(request.headers.get('authorization'),getEnv('STITCH_FORGE_ANALYSIS_TOKEN')))return json(401,'Owner access token required');
  if(getEnv('STITCH_FORGE_ARTWORK_TRIAL_ENABLED')!=='1')return json(503,'The artwork pipeline is not enabled. The native worker and app must be upgraded together; no OpenAI request was made.');
  const oldEndpoint=getEnv('STITCH_FORGE_ENGINE_URL')||'',workerToken=getEnv('STITCH_FORGE_WORKER_TOKEN');
  if(!workerToken||!/^https:\/\/[a-z0-9][a-z0-9.:-]+\/v1\/digitise$/i.test(oldEndpoint))return json(503,'Private native artwork worker is not configured');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json(415,'JSON required');
  if(Number(request.headers.get('content-length')||0)>4000000)return json(413,'Artwork exceeds the request budget');
  let data,obj;
  try{
   data=await boundedBytes(request.body,4000000);obj=JSON.parse(data.toString('utf8'));
   const fields=['header','rgbaGzip','labelsGzip','requestId','phase',...(obj.phase==='dst'?['receipt','pesBase64']:[]),...('repairReceipt' in obj?['repairReceipt']:[])];
   if(!obj||typeof obj!=='object'||Array.isArray(obj)||!['pes','dst'].includes(obj.phase)||Object.keys(obj).sort().join()!==fields.sort().join()||typeof obj.header!=='string'||obj.header.length>2000||!/^([0-9a-f]{64})$/.test(obj.requestId||''))throw Error();
  }catch{return json(422,'Invalid bounded artwork packet');}
  let idToken=null;
  const credential=getEnv('STITCH_FORGE_CLOUD_RUN_CALLER_JSON');
  if(new URL(oldEndpoint).hostname.endsWith('.run.app')){
   if(!credential)return json(503,'Private Cloud Run caller identity is unavailable');
   try{cloudRunAudience(oldEndpoint);idToken=await acquireCloudRunIdToken(oldEndpoint,credential,{fetchImpl});}
   catch{return json(502,'Private native worker identity is unavailable');}
  }else if(credential)return json(503,'Caller identity requires the approved Cloud Run endpoint');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),55000);
  try{
   const upstream=await fetchImpl(oldEndpoint.replace(/\/v1\/digitise$/,'/v1/artwork-trial'),{method:'POST',body:data,redirect:'error',signal:abort.signal,
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+workerToken,...(idToken?{'X-Serverless-Authorization':'Bearer '+idToken}:{})}});
   if(upstream.status===422){
    let code='SOURCE_OR_GEOMETRY_REJECTED';try{const value=JSON.parse((await boundedBytes(upstream.body,2000)).toString());if(['NATIVE_LENGTH_LIMIT','NATIVE_DENSITY_LIMIT','SOURCE_CONTAINMENT_FAILED','NATIVE_COLOUR_ORDER_FAILED','NATIVE_SEQUENCE_FAILED','NATIVE_RECEIPT_CHANGED','GEOMETRY_BUDGET_EXCEEDED'].includes(value.code))code=value.code;}catch{}
    return json(422,'Actual native/source checks refused the result ['+code+']');
   }
   if(!upstream.ok)return json([401,413,429,503,504].includes(upstream.status)?upstream.status:502,
    ({413:'Artwork exceeds worker budget',422:'Source, geometry or actual machine checks refused this artwork',429:'Native engine busy; try again after the current job',503:'Artwork worker is disabled, unavailable or needs upgrading',504:'Native phase timed out; no substitute machine files were generated'})[upstream.status]||'Native artwork worker rejected this request');
   const type=upstream.headers.get('content-type')||'';
   const bytes=await boundedBytes(upstream.body,obj.phase==='pes'?2100000:3000000);
   if(upstream.status===202&&obj.phase==='dst'&&!obj.repairReceipt){
    if(!type.startsWith('application/json')||bytes.length>3000)throw Error();const repair=JSON.parse(bytes.toString('utf8'));
    if(repair.status!=='BOUNDED_NATIVE_REPAIR_REQUIRED'||repair.requestId!==obj.requestId||repair.repairReceipt?.requestId!==obj.requestId||!Array.isArray(repair.repairReceipt?.objectIds)||repair.repairReceipt.objectIds.length>12||!/^([0-9a-f]{64})$/.test(repair.repairReceipt?.mac||''))throw Error();
    return new Response(bytes,{status:202,headers:{...HEADERS,'Content-Type':'application/json'}});
   }
   if(obj.phase==='pes'){
    if(!type.startsWith('application/json'))throw Error();const phase=JSON.parse(bytes.toString('utf8'));
    if(phase.requestId!==obj.requestId||phase.receipt?.requestId!==obj.requestId||typeof phase.pesBase64!=='string'||phase.pesBase64.length>2000000||!/^([0-9a-f]{64})$/.test(phase.receipt?.mac||''))throw Error();
    return new Response(bytes,{headers:{...HEADERS,'Content-Type':'application/json'}});
   }
   const hash=upstream.headers.get('x-stitch-forge-sha256');
   if(!type.startsWith('application/zip')||upstream.headers.get('x-stitch-forge-audit')!==AUDIT||!/^([0-9a-f]{64})$/.test(hash||'')||bytes.length<100||bytes.readUInt32LE(0)!==0x04034b50||createHash('sha256').update(bytes).digest('hex')!==hash)throw Error();
   return new Response(bytes,{headers:{...HEADERS,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="stitch-forge-artwork-TRIAL-NOT-APPROVED.zip"','X-Stitch-Forge-SHA256':hash,'X-Stitch-Forge-Audit':AUDIT}});
  }catch{return json(502,'Native artwork result failed its audit or connection check; no substitute file was produced');}
  finally{clearTimeout(timer);}
 };
}
export default createArtworkBridge();
export const config={path:'/api/artwork-embroidery'};
