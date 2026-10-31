/* Poll private native phase status; never expose raw packets or token. */
import {authorised,JOB_ID,getJobs,getEnv,expired,json,HEADERS} from './lib/artwork-jobs.mjs';
export function createStatus({jobs=getJobs,env=getEnv,now=()=>Date.now()}={}){
 return async function status(request){
  if(request.method!=='GET')return new Response(null,{status:405,headers:HEADERS});
  if(!authorised(request,env))return json(401,{error:'Owner access token required'});
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!JOB_ID.test(id))return json(404,{error:'Artwork job not found'});
  try{
   const record=await jobs().get('state/'+id,{type:'json'});
   if(!record)return json(404,{error:'Artwork job not found'});
   if(expired(record,now()))return json(410,{error:'Artwork job expired; submit a new job'});
   const state=record.status;
   if(!['queued','running','done','failed'].includes(state))return json(502,{error:'Invalid job state'});
   return json(200,{state,...(state==='failed'?{error:record.error||'Native processing failed'}:{}),...(state==='done'?{receipt:record.receipt}: {})});
  }catch{return json(503,{error:'Private artwork job status unavailable'});}
 };
}
export default createStatus();
export const config={path:'/api/artwork-job-status'};
