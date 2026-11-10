/* Poll private native phase status; never expose raw packets or token. */
import {authorised,JOB_ID,getJobs,getEnv,expired,json,HEADERS} from './lib/artwork-jobs.mjs';
const QUEUE_START_TIMEOUT_MS=120000;
const STARTUP_FAILURE='Background embroidery worker did not start. No embroidery file was produced.';
export function createStatus({jobs=getJobs,env=getEnv,now=()=>Date.now()}={}){
 return async function status(request){
  if(request.method!=='GET')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!JOB_ID.test(id))return json(404,{error:'Artwork job not found'});
  try{
   const store=jobs();
   let record=await store.get('state/'+id,{type:'json'});
   if(!record)return json(404,{error:'Artwork job not found'});
   if(expired(record,now()))return json(410,{error:'Artwork job expired; submit a new job'});
   // A background Function can return HTTP 202 at dispatch yet crash while
   // importing its code. After two minutes unstarted, atomically claim the
   // existing worker lock so a late invocation cannot process stale artwork.
   if(record.status==='queued'&&now()-record.createdAt>QUEUE_START_TIMEOUT_MS){
    const claim=await store.set('lock/'+id,'startup_timeout',{onlyIfNew:true});
    if(claim.modified){
     await store.setJSON('state/'+id,{status:'failed',createdAt:record.createdAt,error:STARTUP_FAILURE});
     await store.delete('input/'+id).catch(()=>{});
     return json(200,{state:'failed',error:STARTUP_FAILURE});
    }
    // The worker already owns the lock; it may be changing queued to running.
    record=await store.get('state/'+id,{type:'json'});
    if(!record)return json(404,{error:'Artwork job not found'});
   }
   const state=record.status;
   if(!['queued','running','done','failed'].includes(state))return json(502,{error:'Invalid job state'});
   return json(200,{state,...(state==='failed'?{error:record.error||'Native processing failed'}:{}),...(state==='done'?{receipt:record.receipt}: {})});
  }catch{return json(503,{error:'Private artwork job status unavailable'});}
 };
}
export default createStatus();
export const config={path:'/api/artwork-job-status'};
