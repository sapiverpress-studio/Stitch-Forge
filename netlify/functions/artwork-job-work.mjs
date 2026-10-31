/* A complete two-phase Ink/Stitch job runs off the browser request.
 * The client submits ONLY the bounded source packet. The private server runs
 * PES6, checks its receipt, then DST and the independent native audit.
 */
import {createHash} from 'node:crypto';
import {signed,JOB_ID,getJobs,getEnv,expired,HEADERS} from './lib/artwork-jobs.mjs';
import {createArtworkBridge} from './artwork-embroidery.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
function reject(what){throw Error(what);}
export function createWorker({jobs=getJobs,env=getEnv,bridge=createArtworkBridge,now=()=>Date.now()}={}){
 return async function work(request){
  if(request.method!=='POST')return new Response(null,{status:405,headers:HEADERS});
  let id,mac;try{
   const text=await request.text();if(text.length>400)throw Error();
   ({id,mac}=JSON.parse(text));
  }catch{return new Response(null,{status:400,headers:HEADERS});}
  if(!JOB_ID.test(id)||!signed(id,mac,env))return new Response(null,{status:403,headers:HEADERS});
  const store=jobs();
  const state=await store.get('state/'+id,{type:'json'});
  if(expired(state,now())||!['queued','running'].includes(state.status))return new Response(null,{status:404,headers:HEADERS});
  // Atomic, create-only claim: never run the same native job twice.
  const claim=await store.set('lock/'+id,'claimed',{onlyIfNew:true});
  if(!claim.modified)return new Response(null,{status:204,headers:HEADERS});
  const createdAt=state.createdAt;
  try{
   await store.setJSON('state/'+id,{status:'running',createdAt});
   const input=await store.get('input/'+id);
   if(!input||input.length>4000000)reject('Prepared artwork missing or oversized');
   const packet=JSON.parse(input),owner=env('STITCH_FORGE_ANALYSIS_TOKEN');
   if(!owner)reject('Worker credentials unavailable');
   const invoke=bridge({upstreamTimeoutMs:180000});
   async function phase(name,extra={}){
    const body=JSON.stringify({...packet,phase:name,...extra});
    const response=await invoke(new Request('https://internal.invalid/api/artwork-embroidery',{
     method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+owner},body
    }));
    if(!response.ok){
     let reason;try{reason=(await response.json()).error}catch{}
     reject(typeof reason==='string'?reason.slice(0,180):'Native '+name+' phase failed');
    }
    return response;
   }
   let repair=null,finished=false;
   for(let attempt=0;attempt<2;attempt++){
    const first=await (await phase('pes',repair?{repairReceipt:repair}:{})).json();
    if(first.requestId!==packet.requestId||first.receipt?.requestId!==packet.requestId||
       !/^[0-9a-f]{64}$/.test(first.receipt?.pesSha256||'')||
       !/^[0-9a-f]{64}$/.test(first.receipt?.svgSha256||'')||
       typeof first.pesBase64!=='string'||first.pesBase64.length>2000000)reject('Native PES receipt invalid');
    const pes=Buffer.from(first.pesBase64,'base64');
    if(pes.length<32||pes.toString('utf8',0,8)!=='#PES0060'||
       sha256(pes)!==first.receipt.pesSha256)reject('Native PES checksum invalid');
    const second=await phase('dst',{pesBase64:first.pesBase64,receipt:first.receipt,...(repair?{repairReceipt:repair}:{})});
    if(second.status===202){
     const requested=await second.json();
     if(attempt||requested.status!=='BOUNDED_NATIVE_REPAIR_REQUIRED'||requested.requestId!==packet.requestId||
        requested.repairReceipt?.requestId!==packet.requestId||!Array.isArray(requested.repairReceipt?.objectIds)||
        requested.repairReceipt.objectIds.length<1||requested.repairReceipt.objectIds.length>12)
      reject('Native source repair exceeded one bounded retry');
     repair=requested.repairReceipt;continue;
    }
    if(second.status!==200||!second.headers.get('content-type')?.startsWith('application/zip')||
       second.headers.get('x-stitch-forge-audit')!=='SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED')
     reject('Native audit missing');
    const payload=await second.arrayBuffer(),sha=second.headers.get('x-stitch-forge-sha256')||'';
    if(payload.byteLength<100||payload.byteLength>3000000||sha256(Buffer.from(payload))!==sha)
     reject('Native ZIP checksum or size invalid');
    await store.set('output/'+id,new Blob([payload]));
    await store.setJSON('state/'+id,{status:'done',createdAt,receipt:first.receipt,sha,
     audit:'SOURCE_CONTAINED_TRIAL_NOT_MACHINE_APPROVED'});
    await store.delete('input/'+id);
    finished=true;break;
   }
   if(!finished)reject('Two-phase native job did not complete');
  }catch(error){
   await store.setJSON('state/'+id,{status:'failed',createdAt,error:String(error?.message||error).slice(0,180)});
   await store.delete('input/'+id).catch(()=>{});
  }
  return new Response(null,{status:204,headers:HEADERS});
 };
}
export default createWorker();
export const config={path:'/api/artwork-job-work',background:true};
